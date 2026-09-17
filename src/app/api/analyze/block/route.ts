// Die heutige Analyse, angewandt auf EINEN Block. Klein genug, dass der KI-Aufruf
// sicher unter den 300 s bleibt (Erfahrung: 8.000 Zeichen + 6 Bilder ≈ 60-120 s).
//
// Jeder Block reserviert ein Angebot (reserviere_angebot, VOR dem KI-Aufruf) und gibt
// es wieder frei, wenn keine Positionen herauskommen — dieselbe Regel wie in
// /api/analyze. Der Deckel wird damit auch bei sieben Blöcken korrekt geführt.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { pruefeZugang, ladeEffektivenPlan } from '@/lib/planpruefung'
import { deckel, erlaubt } from '@/lib/plaene'
import { deckelAblehnung, bloeckeAblehnung } from '@/lib/plantexte'
import { aktuellerMonat, reserviereAngebot, gibAngebotFrei } from '@/lib/angebotszaehler'
import { stempelPreisfaktor, klemmePreisfaktor, PREISFAKTOR_STANDARD, verwirfKiPreisfaktor } from '@/lib/preisfaktor'
import { BLOCK_REGEL, type Block } from '@/lib/bloecke'
import { SYSTEM_PROMPT, validateAndFix, MAX_IMAGE_B64_BYTES } from '../gemeinsam'
import { ladeFaktoren } from '@/lib/kalibrierungsspeicher'
import { KEINE_FAKTOREN, type Faktoren } from '@/lib/zeitfaktoren'
import { regelBlockFuerNutzer } from '@/lib/bauweise'
import { preisBlockFuerNutzer } from '@/lib/preisspeicher'
import { ladeKalibrierung } from '@/lib/kalibrierungsspeicher'
import { abzuschaltendeKostenstellen, lackBlockFuer } from '@/lib/kalibrierung'
import { normalizeKsId } from '@/lib/types'
import { bildMedientyp, istUuid } from '@/lib/upload'
import { kontoIdFuer, kontoGesperrt } from '@/lib/kontoserver'

export const maxDuration = 300

const BUCKET = 'projektdateien'
const VORBEREITET = '_vorbereitet.json'

export async function POST(req: NextRequest) {
  // Außerhalb des try deklariert, damit der äußerste catch (unerwarteter Fehler nach
  // der Reservierung, z. B. beim Bilder-Download oder Claude-Fetch) die Reservierung
  // ebenfalls wieder freigeben kann — nicht nur die erwarteten Fehlerpfade weiter unten.
  let supabase: Awaited<ReturnType<typeof createClient>> | null = null
  let reserviertMonat: string | null = null
  let freigegeben = false
  const gibFrei = async () => {
    if (freigegeben || !reserviertMonat || !supabase) return
    freigegeben = true
    try { await gibAngebotFrei(supabase, reserviertMonat) }
    catch (e) { console.error('[analyze/block] gibAngebotFrei:', e) }
  }
  try {
    supabase = await createClient()
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })
    const konto = await kontoIdFuer(supabase, user)
    const sperre = kontoGesperrt(konto)
    if (sperre) return sperre
    const kontoId = konto.kontoId
    const zu = await pruefeZugang(supabase, kontoId)
    if (zu) return zu

    const body = await req.json().catch(() => ({})) as {
      projekt_id?: string; blockNr?: number; kontext?: string
      userKostenstellen?: Array<{ code: string; bezeichnung: string; stundensatz: number }>
      userMaterialgruppen?: Array<{ name: string; aufschlag_prozent: number }>
      deaktivierteKostenstellen?: string[]
    }
    const projektId = String(body.projekt_id ?? '').trim()
    const blockNr = Number(body.blockNr)
    if (!projektId || !Number.isFinite(blockNr) || blockNr < 1) {
      return NextResponse.json({ error: 'Projekt oder Blocknummer fehlt' }, { status: 400 })
    }

    // Fix-Runde 1 (Review-Important): `projekt_id` kam bisher ungeprüft aus dem Client —
    // weder als gültige UUID noch als Eigentum des Nutzers geprüft. Gleiches Muster wie
    // in /api/upload und /api/analyze/vorbereiten, VOR der Angebots-Reservierung, damit
    // ein ungültiges Projekt nichts reserviert. Fail closed: ein Supabase-Fehler zählt
    // wie „kein passendes Projekt".
    if (!istUuid(projektId)) {
      return NextResponse.json({ error: 'Ungültiges Projekt.' }, { status: 400 })
    }
    const { data: projektRow, error: projErr } = await supabase
      .from('projects')
      .select('id')
      .eq('id', projektId)
      .eq('user_id', kontoId)
      .single()
    if (projErr || !projektRow) {
      if (projErr) console.error('[analyze/block] Projekt-Prüfung:', projErr.message)
      return NextResponse.json({ error: 'Ungültiges Projekt.' }, { status: 400 })
    }

    // Die vorbereiteten Blöcke liegen im Projektordner (Task C2).
    const ordner = `${kontoId}/${projektId}`
    const { data: blob, error: dlErr } = await supabase.storage.from(BUCKET).download(`${ordner}/${VORBEREITET}`)
    if (dlErr || !blob) {
      return NextResponse.json({ error: 'Die Vorbereitung fehlt. Bitte „Vorbereiten“ erneut ausführen.' }, { status: 409 })
    }
    const vorbereitet = JSON.parse(await blob.text()) as { bloecke: Block[] }
    const bloecke = vorbereitet.bloecke ?? []
    const block = bloecke.find(b => b.nr === blockNr)
    if (!block) return NextResponse.json({ error: `Block ${blockNr} gibt es nicht.` }, { status: 404 })

    const plan = await ladeEffektivenPlan(supabase, kontoId)
    if (bloecke.length > 1 && !erlaubt(plan, 'bloecke')) {
      return NextResponse.json(bloeckeAblehnung(), { status: 403 })
    }

    // Ein Angebot je Block — reserviert VOR dem KI-Aufruf.
    const monat = aktuellerMonat()
    const limit = deckel(plan, 'angebote')
    const reservierung = await reserviereAngebot(supabase, monat, limit)
    if (!reservierung.ok) {
      return NextResponse.json(
        { success: false, ...deckelAblehnung('angebote', plan === 'gesperrt' ? 'solo' : plan, limit ?? 0) },
        { status: 403 },
      )
    }
    reserviertMonat = monat

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) { await gibFrei(); return NextResponse.json({ error: 'Kein API Key konfiguriert' }, { status: 500 }) }

    // Bilder dieses Blocks aus dem privaten Bucket holen und als base64 anhängen.
    // Medientyp kommt aus den echten Bytes (Magic Bytes), nicht pauschal "image/jpeg" —
    // Claude lehnt sonst z. B. ein PNG mit falsch deklariertem Typ komplett ab (Fix-Runde 1,
    // Live-Test 2026-09-16). Nie stumm: ein nicht erkennbares Bild landet in "hinweise".
    const bilder: Array<{ b64: string; mediaType: 'image/png' | 'image/jpeg' | 'image/webp' }> = []
    const hinweise: string[] = []
    for (const pfad of block.bilder ?? []) {
      const { data: bild, error } = await supabase.storage.from(BUCKET).download(pfad)
      if (error || !bild) {
        console.error('[analyze/block] Bild:', pfad, error?.message)
        hinweise.push(`${pfad}: konnte nicht geladen werden — übersprungen`)
        continue
      }
      const buf = Buffer.from(await bild.arrayBuffer())
      const mediaType = bildMedientyp(new Uint8Array(buf), pfad)
      if (!mediaType) {
        console.error('[analyze/block] Bild: unbekannter Medientyp:', pfad)
        hinweise.push(`${pfad}: unbekannter Bildtyp — übersprungen`)
        continue
      }
      const b64 = buf.toString('base64')
      if (b64.length > MAX_IMAGE_B64_BYTES) {
        console.error('[analyze/block] Bild zu groß:', pfad)
        hinweise.push(`${pfad}: zu groß — übersprungen`)
        continue
      }
      bilder.push({ b64, mediaType })
    }

    // Nutzerspezifisches wie in /api/analyze — serverseitig geladen.
    const customKs = Array.isArray(body.userKostenstellen) ? body.userKostenstellen : []
    const customSaetze: Record<string, number> = {}
    for (const k of customKs) { customSaetze[normalizeKsId(k.code)] = k.stundensatz; customSaetze[k.bezeichnung] = k.stundensatz }
    const matGruppen = Array.isArray(body.userMaterialgruppen) ? body.userMaterialgruppen : []
    const deaktiviert = new Set<string>((body.deaktivierteKostenstellen ?? []).map(c => normalizeKsId(c)))

    let faktoren: Faktoren = KEINE_FAKTOREN
    try { faktoren = await ladeFaktoren(supabase, kontoId) }
    catch (e) { console.error('[analyze/block] Faktoren:', e) }
    let lackBlock = ''
    try {
      const kal = await ladeKalibrierung(supabase, kontoId)
      for (const ks of abzuschaltendeKostenstellen(kal)) deaktiviert.add(normalizeKsId(ks))
      lackBlock = lackBlockFuer(kal)
    } catch (e) { console.error('[analyze/block] Kalibrierung:', e) }
    let regelBlock = ''
    try { regelBlock = (await regelBlockFuerNutzer(supabase, kontoId)).block }
    catch (e) { console.error('[analyze/block] Regeln:', e) }
    let preisBlock = ''
    try { preisBlock = await preisBlockFuerNutzer(supabase, kontoId) }
    catch (e) { console.error('[analyze/block] Preise:', e) }

    const { data: profil, error: profilErr } = await supabase
      .from('betriebsprofil').select('strasse, plz, ort, preisfaktor').eq('user_id', kontoId).single()
    if (profilErr) console.error('[analyze/block] Betriebsprofil:', profilErr.message)
    const preisfaktorNutzer = klemmePreisfaktor(profil?.preisfaktor) ?? PREISFAKTOR_STANDARD
    const standort = profil
      ? [profil.strasse, [profil.plz, profil.ort].filter(Boolean).join(' ')].filter(Boolean).join(', ')
      : ''

    let nutzerBlock = ''
    if (Object.keys(customSaetze).length > 0) {
      nutzerBlock += '\n\n## ECHTE STUNDENSÄTZE DIESES NUTZERS (verbindlich):\n' +
        customKs.map(k => `${normalizeKsId(k.code)} → ${k.stundensatz} €/h`).join('\n')
    }
    if (deaktiviert.size > 0) {
      nutzerBlock += '\n\n## DIESE KOSTENSTELLEN NICHT VERWENDEN:\n' + [...deaktiviert].join(', ')
    }
    if (matGruppen.length > 0) {
      nutzerBlock += '\n\n## ECHTE MATERIALAUFSCHLÄGE DIESES NUTZERS (verbindlich):\n' +
        matGruppen.map(m => `${m.name} → ${m.aufschlag_prozent}%`).join('\n')
    }
    if (standort) {
      nutzerBlock += '\n\n## FIRMENSTANDORT DES NUTZERS (verbindlich für Anfahrt & Fahrtzeit):\n' + standort
    }
    nutzerBlock += regelBlock + lackBlock + preisBlock

    // Reihenfolge der System-Blöcke ist funktional: zuerst das feste Fachwissen
    // (zwischengespeichert), dann die feste Blockregel (ebenfalls zwischengespeichert),
    // erst danach alles Nutzerspezifische — sonst macht jeder Nutzer den Cache des
    // anderen ungültig.
    const systemBloecke: Array<{ type: 'text'; text: string; cache_control?: { type: 'ephemeral' } }> = [
      { type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
      { type: 'text', text: BLOCK_REGEL, cache_control: { type: 'ephemeral' } },
    ]
    if (nutzerBlock.trim()) systemBloecke.push({ type: 'text', text: nutzerBlock })

    const userContent: object[] = []
    for (const { b64, mediaType } of bilder) {
      userContent.push({ type: 'image', source: { type: 'base64', media_type: mediaType, data: b64 } })
    }
    const kontext = String(body.kontext ?? '').trim()
    userContent.push({
      type: 'text',
      text: `${kontext ? kontext + '\n\n' : ''}## BLOCK ${blockNr} VON ${bloecke.length}\n${block.text || '(nur Fotos in diesem Block)'}`,
    })

    const model = 'claude-sonnet-4-6'
    let response: Response
    try {
      response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-beta': 'interleaved-thinking-2025-05-14',
        },
        body: JSON.stringify({
          model, max_tokens: 16000, temperature: 1,
          thinking: { type: 'enabled', budget_tokens: 5000 },
          system: systemBloecke,
          messages: [{ role: 'user', content: userContent }],
        }),
        // I-4 (Controller-Review 16.09.): Vercel maxDuration = 300 s killt die
        // Funktion sonst OHNE dass dieser catch-Zweig läuft — gibFrei() würde nie
        // aufgerufen, das reservierte Angebot bliebe für den Monat verbraucht.
        // Eigenes Limit knapp darunter, damit der Fall hier landet statt im
        // harten Vercel-Timeout.
        signal: AbortSignal.timeout(260_000),
      })
    } catch (e: unknown) {
      const istTimeout = e instanceof Error && (e.name === 'AbortError' || e.name === 'TimeoutError')
      console.error('[analyze/block] Claude fetch fehlgeschlagen:', e)
      await gibFrei()
      if (istTimeout) {
        return NextResponse.json({
          success: false,
          error: 'Dieser Block hat zu lange gedauert (über 4 Minuten). Bitte das Projekt in kleinere Dateien teilen und erneut versuchen.',
          blockNr, hinweise,
        }, { status: 504 })
      }
      throw e
    }
    if (!response.ok) {
      const err = await response.text()
      console.error('[analyze/block] Claude error:', response.status, err)
      await gibFrei()
      return NextResponse.json({ success: false, error: `Claude ${response.status}: ${err}`, hinweise }, { status: 502 })
    }

    const data = await response.json() as {
      content?: Array<{ type: string; text?: string }>
      stop_reason?: string
      usage?: Record<string, unknown>
    }
    // Nur ins Log, NIE in die API-Antwort — Kosten/Token gehen den Client nichts an.
    console.log('[analyze/block] stop_reason:', data.stop_reason, 'usage:', JSON.stringify(data.usage ?? {}))
    if (data.stop_reason === 'max_tokens') {
      // Live-Test 2026-09-16: max_tokens 16000 (inkl. 5.000 Denken) reicht für ~30
      // Positionen nicht — die Antwort brach mitten im JSON ab. Ein Parse-Versuch
      // würde nur denselben "JSON Parse Fehler" liefern, ohne die echte Ursache zu
      // nennen. MAX_POSITIONEN_JE_BLOCK in bloecke.ts verhindert das inzwischen beim
      // Vorbereiten — dieser Zweig bleibt als Netz für alle anderen Fälle.
      await gibFrei()
      return NextResponse.json({
        success: false,
        error: 'Die Antwort für diesen Block wurde zu lang und abgeschnitten. Bitte das Projekt in kleinere Dateien teilen oder erneut versuchen.',
        blockNr, hinweise,
      }, { status: 500 })
    }
    const rawText = (data.content ?? []).find(b => b.type === 'text')?.text ?? ''
    const start = rawText.indexOf('{')
    const clean = start === -1 ? rawText : rawText.slice(start, rawText.lastIndexOf('}') + 1)

    try {
      const parsed = JSON.parse(clean) as Record<string, unknown>
      const validated = 'fragen' in parsed
        ? parsed
        : validateAndFix(parsed, block.text ?? '', customSaetze, matGruppen, deaktiviert, faktoren)
      const positionen = (validated as { positionen?: unknown }).positionen
      if (Array.isArray(positionen)) {
        // I-6: einen von der KI selbst erfundenen Faktor verwerfen, bevor der
        // Betrieb seinen stempelt — hier entstehen die Positionen frisch aus der
        // KI-Antwort, ein "vorhandener" Faktor kann also nur erfunden sein.
        (validated as { positionen: unknown }).positionen =
          stempelPreisfaktor(verwirfKiPreisfaktor(positionen) as Array<{ preisfaktor?: number }>, preisfaktorNutzer)
      }
      const hatPositionen = Array.isArray(positionen) && positionen.length > 0
      if (!hatPositionen) await gibFrei()
      return NextResponse.json({ success: true, data: validated, blockNr, bloeckeGesamt: bloecke.length, hinweise })
    } catch {
      console.error('[analyze/block] JSON parse failed, raw:', rawText.slice(0, 300))
      await gibFrei()
      return NextResponse.json({ success: false, error: 'JSON Parse Fehler', blockNr, hinweise }, { status: 500 })
    }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unbekannter Fehler'
    console.error('[analyze/block] unhandled error:', msg)
    await gibFrei()
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
