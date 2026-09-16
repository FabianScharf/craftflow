import { NextRequest, NextResponse } from 'next/server'
import { normalizeKsId } from '@/lib/types'
import { createClient } from '@/utils/supabase/server'
import { regelBlockFuerNutzer, zaehleRegelnHoch } from '@/lib/bauweise'
import { preisBlockFuerNutzer } from '@/lib/preisspeicher'
import { deckel, type EffektiverPlan } from '@/lib/plaene'
import { ladeEffektivenPlan, pruefeZugang } from '@/lib/planpruefung'
import { deckelAblehnung } from '@/lib/plantexte'
import { aktuellerMonat, reserviereAngebot, gibAngebotFrei } from '@/lib/angebotszaehler'
import { stempelPreisfaktor, PREISFAKTOR_STANDARD, klemmePreisfaktor } from '@/lib/preisfaktor'
import { KEINE_FAKTOREN, type Faktoren } from '@/lib/zeitfaktoren'
import { ladeFaktoren, ladeKalibrierung } from '@/lib/kalibrierungsspeicher'
import { nutzungAusAntwort, nutzungAlsZeile } from '@/lib/kinutzung'
import { abzuschaltendeKostenstellen, lackBlockFuer } from '@/lib/kalibrierung'
import { SYSTEM_PROMPT, STUNDENSAETZE, validateAndFix, MAX_IMAGE_B64_BYTES } from './gemeinsam'

export const maxDuration = 300

export async function POST(req: NextRequest) {
  try {
    // Guard: Vercel limit ist 4.5 MB body
    const contentLength = Number(req.headers.get('content-length') ?? 0)
    console.log('[analyze] content-length:', contentLength, 'bytes')
    if (contentLength > 4_000_000) {
      console.error('[analyze] request too large:', contentLength)
      return NextResponse.json({ error: 'Anfrage zu groß – bitte weniger oder kleinere Bilder verwenden.' }, { status: 413 })
    }

    // Zugang UND Angebots-Deckel VOR dem teuren KI-Aufruf prüfen (Aufgabe 0) —
    // sonst kostet eine gesperrte oder ausgeschöpfte Anfrage trotzdem den vollen
    // Claude-Aufruf. Nutzer früh laden (statt wie bisher erst spät im try-Block
    // unten), damit diese Prüfung ganz am Anfang stehen kann. Kein Nutzer da
    // (z. B. Middleware-Lücke) → weiter wie bisher, keine Sperre.
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    // Für den Dateien-Deckel weiter unten (sobald rawImages feststeht) — hier schon
    // laden, damit der Plan nicht ein zweites Mal aus der DB geholt werden muss.
    let plan: EffektiverPlan | null = null
    // Gesetzt, sobald ein Angebot atomar reserviert wurde (reserviere_angebot,
    // Fix-Runde 16.09.) — Reservierung VOR dem KI-Aufruf statt Lesen+Vergleichen,
    // sonst könnten zwei gleichzeitige Anfragen denselben letzten Platz beide für
    // sich sehen (klassisches Race, TOCTOU). Wird in jedem Fehlerpfad NACH der
    // Reservierung wieder freigegeben (gibAngebotFrei) — außer beim echten Erfolg
    // (Positionen vorhanden), dann ist der reservierte Platz endgültig verbraucht.
    let reservierterMonat: string | null = null
    let reservierungFreigegeben = false
    const gibReservierungFrei = async () => {
      if (!user || !reservierterMonat || reservierungFreigegeben) return
      reservierungFreigegeben = true
      try { await gibAngebotFrei(supabase, reservierterMonat) }
      catch (e) { console.error('[usage] gibAngebotFrei (analyze):', e) }
    }
    if (user) {
      const zu = await pruefeZugang(supabase, user.id)
      if (zu) return zu
      plan = await ladeEffektivenPlan(supabase, user.id)
      // pruefeZugang hat 'gesperrt' bereits ausgeschlossen — plan ist hier ein echter Plan.
      if (plan !== 'gesperrt') {
        const limit = deckel(plan, 'angebote')
        const monat = aktuellerMonat()
        const reservierung = await reserviereAngebot(supabase, monat, limit)
        if (!reservierung.ok) {
          // limit ist hier nie null: reserviere_angebot lehnt nur bei einem
          // endlichen Limit ab (siehe docs/sql/2026-09-16-angebot-reservieren.sql).
          return NextResponse.json(
            { success: false, ...deckelAblehnung('angebote', plan, limit ?? 0) },
            { status: 403 },
          )
        }
        reservierterMonat = monat
      }
    }

    let { text, imageBase64, userKostenstellen, userMaterialgruppen, deaktivierteKostenstellen } = await req.json()
    const customKs = Array.isArray(userKostenstellen)
      ? (userKostenstellen as Array<{ code: string; bezeichnung: string; stundensatz: number; gruppe?: string | null }>)
      : []
    // Keyed by normalizeKsId(code), NOT k.bezeichnung and NOT raw k.code.
    // bezeichnung is free user-edited text and can diverge from the AI's
    // fixed kostenstelle vocabulary (e.g. code 03_01_Warenhandling saved
    // with bezeichnung "Warenwirtschaft" instead of "Warenhandling" —
    // confirmed via DB inspection 2026-07-04). code alone doesn't match
    // either (that was Vorfall #2). normalizeKsId(code) via LEGACY_KS_MAP
    // is the one stable mapping to the canonical name STUNDENSAETZE and the
    // AI both use.
    // Standard-KS per normalizeKsId(code). Eigene (nicht-Standard) KS zusätzlich
    // per bezeichnung keyen, weil die KI sie unter ihrer bezeichnung ausgibt —
    // so greift der deterministische vkStunde-Override in beiden Fällen.
    const customSaetze: Record<string, number> = {}
    const eigeneKs: Array<{ id: string; bezeichnung: string; stundensatz: number }> = []
    for (const k of customKs) {
      const id = normalizeKsId(k.code)
      customSaetze[id] = k.stundensatz
      if (!(id in STUNDENSAETZE)) {
        customSaetze[k.bezeichnung] = k.stundensatz
        eigeneKs.push({ id, bezeichnung: k.bezeichnung, stundensatz: k.stundensatz })
      }
    }
    // Vom Nutzer deaktivierte Kostenstellen — dürfen nirgends in der Kalkulation
    // auftauchen (auch nicht über Fixkosten-/Workshop-Floor-Fallbacks).
    // Wird im Auth-Block weiter unten aus den Betriebsfragen gefuellt.
    const ausBetrieb: string[] = []
    let lackBlock = ''
    const deaktiviert = new Set<string>(
      (Array.isArray(deaktivierteKostenstellen) ? deaktivierteKostenstellen as string[] : []).map(c => normalizeKsId(c))
    )

    const matGruppen = Array.isArray(userMaterialgruppen)
      ? (userMaterialgruppen as Array<{ name: string; aufschlag_prozent: number }>)
      : []

    const rawImages: string[] = Array.isArray(imageBase64)
      ? imageBase64.filter(Boolean)
      : imageBase64
      ? [imageBase64]
      : []

    // Dateien-Deckel je Projekt (Spec 2026-09-15, Aufgabe 5) — VOR dem KI-Aufruf.
    // PDF-Seiten werden im Browser zu Bildern, zählen also als Dateien: Aufwand = Bilder.
    if (user && plan) {
      const grenze = deckel(plan, 'dateien')
      if (grenze !== null && rawImages.length > grenze) {
        // Kein KI-Aufruf hier — die oben reservierte Angebots-Reservierung wieder
        // freigeben, sonst kostet eine abgelehnte Anfrage trotzdem das Kontingent.
        await gibReservierungFrei()
        return NextResponse.json(
          { success: false, ...deckelAblehnung('dateien', plan === 'gesperrt' ? 'solo' : plan, grenze) },
          { status: 403 },
        )
      }
    }

    // Bilder auf max. 4 MB base64 begrenzen; zu große still überspringen
    const images = rawImages.filter(img => {
      const size = img.length
      if (size > MAX_IMAGE_B64_BYTES) {
        console.error('[analyze] image dropped — too large:', Math.round(size / 1024), 'KB')
        return false
      }
      return true
    })

    console.log('[analyze] images:', images.length, '(raw:', rawImages.length, '), text len:', text?.length ?? 0)
    if (rawImages.length > 0 && images.length === 0 && text) {
      console.log('[analyze] alle Bilder gefiltert — fahre mit Text-only fort')
    }

    if (!text && images.length === 0) {
      await gibReservierungFrei()
      return NextResponse.json({ error: 'Kein Text oder Bild' }, { status: 400 })
    }

    const MAX_TEXT_CHARS = 10000
    if (text && text.length > MAX_TEXT_CHARS) {
      console.log('[analyze] text truncated from', text.length, 'to', MAX_TEXT_CHARS, 'chars')
      text = text.slice(0, MAX_TEXT_CHARS)
    }

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      await gibReservierungFrei()
      return NextResponse.json({ error: 'Kein API Key konfiguriert' }, { status: 500 })
    }

    const userContent: object[] = []

    if (images.length > 0) {
      for (const img of images) {
        const b64 = img.startsWith('data:') ? img.split(',')[1] : img
        userContent.push({
          type: 'image',
          source: { type: 'base64', media_type: 'image/jpeg', data: b64 },
        })
      }
      userContent.push({
        type: 'text',
        text: 'Das sind Fotos der Situation vor Ort. Berücksichtige alle.\n\nBeschreibung: "' + (text ?? '') + '"',
      })
    } else {
      userContent.push({ type: 'text', text: `Beschreibung: "${text}"` })
    }

    // Firmenstandort des eingeloggten Nutzers aus dem Betriebsprofil holen — die
    // Anfahrt/Montage MUSS von dort ausgehen, nicht vom Hersteller-Sitz Rodenbach.
    // Im selben Zug: gelernte Bauweise-Regeln dieses Nutzers (Bauweise-Vault),
    // serverseitig geladen, nicht vom Frontend geschickt — was das Frontend
    // nicht sendet, kann nicht manipuliert werden.
    let firmenStandort = ''
    let preisfaktorNutzer = PREISFAKTOR_STANDARD
    let regelBlock = ''
    let preisBlock = ''
    let regelIds: string[] = []
    let supabaseFuerZaehler: Awaited<ReturnType<typeof createClient>> | null = null
    let faktoren: Faktoren = KEINE_FAKTOREN
    try {
      // supabase/user bereits ganz oben geladen (Zugangsprüfung) — nicht doppelt holen.
      if (user) {
        // Ohne abgeschlossene Kalibrierung bleibt es bei 1,0 in allen vier Bereichen
        // — also bei den CraftFlow-Werten.
        try { faktoren = await ladeFaktoren(supabase, user.id) }
        catch (e) { console.error('[kalibrierung] Faktoren laden (analyze):', e) }
        // Die Betriebsfragen wirken hier: Kein CNC, keine Kantenanleimmaschine oder
        // keine eigene Montage schalten die jeweilige Kostenstelle ab. Die Arbeit
        // verschwindet dabei nicht, sie wandert zur Handarbeit.
        try {
          const kal = await ladeKalibrierung(supabase, user.id)
          for (const ks of abzuschaltendeKostenstellen(kal)) ausBetrieb.push(ks)
          lackBlock = lackBlockFuer(kal)
        } catch (e) { console.error('[kalibrierung] Kostenstellen (Betrieb):', e) }
        const { data: profil, error: profilErr } = await supabase
          .from('betriebsprofil')
          .select('strasse, plz, ort, preisfaktor')
          .eq('user_id', user.id)
          .single()
        if (profilErr) console.error('[analyze] Betriebsprofil:', profilErr.message)
        if (profil) {
          const ortLine = [profil.plz, profil.ort].filter(Boolean).join(' ')
          firmenStandort = [profil.strasse, ortLine].filter(Boolean).join(', ')
        }
        // Der Preisfaktor geht NIE in den Prompt — er wird erst nach der Antwort
        // auf die Positionen gestempelt (Spec: Vault beeinflusst keine Preise).
        preisfaktorNutzer = klemmePreisfaktor(profil?.preisfaktor) ?? PREISFAKTOR_STANDARD
        try {
          const r = await regelBlockFuerNutzer(supabase, user.id)
          regelBlock = r.block
          regelIds = r.ids
          supabaseFuerZaehler = supabase
        } catch (e) { console.error('[learn] Regeln laden (analyze):', e) }
        // Getrennter Block: Bauweise-Regeln dürfen nie Preise setzen, Preise nie
        // Bauweise — und der Ausfall des einen darf den anderen nicht mitreißen.
        //
        // GEFUNDEN AM 2026-09-07: Das Laden der Preisliste stand INNERHALB des
        // try-Blocks der Bauweise-Regeln. Ein Fehler beim Laden der Regeln liess
        // damit stillschweigend auch die fixierten Einkaufspreise verschwinden —
        // die Kalkulation haette dann mit geschaetzten Preisen weitergerechnet,
        // ohne dass es jemand merkt. In optimize war es von Anfang an getrennt.
        //
        // Fixierte Einkaufspreise gehören GERADE hierher: Ein neues Angebot
        // entsteht über diese Route. Nur im Optimieren zu wirken hiesse, die
        // Preise erst nach dem Schaetzen zu korrigieren statt vorher richtig zu
        // rechnen.
        try { preisBlock = await preisBlockFuerNutzer(supabase, user.id) }
        catch (e) { console.error('[preise] Preise laden (analyze):', e) }
      }
    } catch { /* kein Profil / nicht eingeloggt → Default-Verhalten */ }

    // Erst hier, weil die Kalibrierung im Block darueber geladen wird. Serverseitig,
    // damit es auch dann greift, wenn der Browser die Liste nicht mitschickt.
    for (const ks of ausBetrieb) deaktiviert.add(normalizeKsId(ks))

    let systemPrompt = SYSTEM_PROMPT
    const standardLines = customKs
      .filter(k => normalizeKsId(k.code) in STUNDENSAETZE)
      .map(k => `${normalizeKsId(k.code)} → ${k.stundensatz} €/h`)
    if (standardLines.length > 0) {
      systemPrompt += '\n\n## ECHTE STUNDENSÄTZE DIESES NUTZERS (verbindlich, ersetzen die Beispielsätze oben):\n' + standardLines.join('\n')
    }
    if (deaktiviert.size > 0) {
      systemPrompt += '\n\n## DIESE KOSTENSTELLEN NICHT VERWENDEN (Betrieb bietet sie nicht an):\n' +
        [...deaktiviert].join(', ') +
        '\nNiemals in "arbeitszeit" aufnehmen. Die zugehörige Arbeit entfällt oder wird von einer erlaubten Kostenstelle mit übernommen — aber die genannten Kostenstellen selbst tauchen NIE auf.'
    }
    if (eigeneKs.length > 0) {
      systemPrompt += '\n\n## ZUSÄTZLICH ERLAUBTE EIGENE KOSTENSTELLEN DIESES NUTZERS:\n' +
        eigeneKs.map(k => `${k.bezeichnung} (${k.stundensatz} €/h)`).join('\n') +
        '\nDu darfst diese ZUSÄTZLICH zu den 15 Standard-Kostenstellen verwenden — aber NUR, wenn eine Tätigkeit inhaltlich dazu passt und NICHT bereits von einer Standard-Kostenstelle abgedeckt ist. Schreibe als "kostenstelle" exakt diese Bezeichnung.' +
        '\nGEGEN DOPPELZÄHLUNG: Ordne jede Tätigkeit GENAU EINER Kostenstelle zu. Dieselbe Arbeit nie zweimal (z. B. Politur entweder unter Oberfläche ODER unter der eigenen Kostenstelle, niemals beides). Verteile die vorhandene Zeit, erfinde keine zusätzliche.'
    }
    if (matGruppen.length > 0) {
      const lines = matGruppen.map(m => `${m.name} → ${m.aufschlag_prozent}%`)
      systemPrompt += '\n\n## ECHTE MATERIALAUFSCHLÄGE DIESES NUTZERS (verbindlich, ersetzen die pauschalen 30% oben):\n' +
        lines.join('\n') + '\nOrdne jedes Material der passenden Gruppe zu und verwende deren Aufschlag als "aufschlag" (z.B. 25% → 0.25).'
    }
    if (firmenStandort) {
      systemPrompt += '\n\n## FIRMENSTANDORT DES NUTZERS (verbindlich für Anfahrt & Fahrtzeit):\n' + firmenStandort +
        '\nBerechne Anfahrt und Fahrtzeit (Kostenstellen Montage & Lieferung) IMMER von diesem Standort zum Kunden — NIEMALS ab Rodenbach. Rodenbach ist nur der Sitz des Software-Herstellers und für die Anfahrt völlig irrelevant.'
    }
    // MUSS ganz am Ende stehen: der Block trägt einen Vorrang-Satz und muss
    // nach dem allgemeinen Fachwissen kommen, sonst gewinnt weiter die
    // generische Vorgabe (z. B. 6 mm HPL-Rückwand).
    systemPrompt += regelBlock
    // Ohne eigene Lackierkabine wird Lackieren zugekauft — nie geschaetzt.
    systemPrompt += lackBlock
    systemPrompt += preisBlock

    const model = 'claude-sonnet-4-6'
    // PROMPT-CACHING (2026-09-15): Der feste Wissensblock (rund 9.500 Token) ist bei
    // jeder Anfrage identisch und wurde bisher jedes Mal voll bezahlt. Als eigener
    // Block mit cache_control kostet er ab dem zweiten Aufruf innerhalb von fuenf
    // Minuten nur noch ein Zehntel — fuer alle Nutzer gemeinsam, weil der Cache je
    // API-Schluessel gilt. Alles Nutzerspezifische (Saetze, Regeln, Standort) steht
    // DAHINTER, sonst wuerde jeder Nutzer den Cache des anderen ungueltig machen.
    const nutzerBlock = systemPrompt.slice(SYSTEM_PROMPT.length)
    const systemBloecke: Array<{ type: 'text'; text: string; cache_control?: { type: 'ephemeral' } }> = [
      { type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
    ]
    if (nutzerBlock.trim()) systemBloecke.push({ type: 'text', text: nutzerBlock })
    const reqBody = JSON.stringify({
      model,
      max_tokens: 16000, // thinking (5k) + output (8k) + puffer
      temperature: 1,    // extended thinking erfordert temperature = 1
      thinking: { type: 'enabled', budget_tokens: 5000 },
      system: systemBloecke,
      messages: [{ role: 'user', content: userContent }],
    })
    console.log('[analyze] calling Claude model:', model, '(extended thinking) — body size:', Math.round(reqBody.length / 1024), 'KB')

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'interleaved-thinking-2025-05-14',
      },
      body: reqBody,
    })

    if (!response.ok) {
      const err = await response.text()
      console.error('[analyze] Claude error:', response.status, err)
      await gibReservierungFrei()
      return NextResponse.json(
        { success: false, error: `Claude ${response.status}: ${err}` },
        { status: 502 }
      )
    }
    try { if (supabaseFuerZaehler && regelIds.length > 0) zaehleRegelnHoch(supabaseFuerZaehler, regelIds) }
    catch (e) { console.error('[learn] zaehleRegelnHoch:', e) }

    const data = await response.json()
    // Verbrauch mitschreiben: Nachweis fuer das Caching und Grundlage des Kostenzaehlers.
    // NUR ins Log — Fabian (15.09.): Kostenzahlen sind ausnahmslos fuer ihn bestimmt,
    // kein Nutzer bekommt sie zu sehen. Deshalb steht `nutzung` nie in der Antwort.
    const nutzung = nutzungAusAntwort((data as { usage?: unknown }).usage)
    console.log(nutzungAlsZeile('analyze', model, nutzung))
    // Extended thinking liefert mehrere Content-Blöcke — wir nehmen nur den text-Block
    const contentBlocks = (data as { content?: Array<{ type: string; text?: string }> }).content ?? []
    const rawText = contentBlocks.find(b => b.type === 'text')?.text ?? ''
    console.log('[analyze] Claude response — blocks:', contentBlocks.length, ', text length:', rawText.length)
    // Robuste JSON-Extraktion: findet das erste vollständige {...} Objekt auch wenn
    // die KI Freitext davor/danach schreibt oder doppelte Klammern produziert.
    function extractJson(raw: string): string {
      // 1. Backticks und Code-Fences entfernen
      let s = raw.replace(/```json|```/g, '').trim()
      // 2. Erstes { suchen
      const start = s.indexOf('{')
      if (start === -1) return s
      s = s.slice(start)
      // 3. Passendes schließendes } suchen (korrektes Bracket-Matching)
      let depth = 0
      let end = -1
      for (let i = 0; i < s.length; i++) {
        if (s[i] === '{') depth++
        else if (s[i] === '}') { depth--; if (depth === 0) { end = i; break } }
      }
      return end !== -1 ? s.slice(0, end + 1) : s
    }

    const clean = extractJson(rawText)

    try {
      const parsed = JSON.parse(clean)
      const validated = 'fragen' in parsed ? parsed : validateAndFix(parsed as Record<string, unknown>, text ?? '', customSaetze, matGruppen, deaktiviert, faktoren)
      // Preisfaktor des Betriebs auf die frisch entstandenen Positionen stempeln.
      // Nach validateAndFix, damit der deterministische vkStunde-/aufschlag-Override
      // unberuehrt bleibt — der Faktor ist reine Nachrechnung auf den Endpreis.
      const positionenRoh = (validated as { positionen?: unknown }).positionen
      if (Array.isArray(positionenRoh)) {
        (validated as { positionen: unknown }).positionen =
          stempelPreisfaktor(positionenRoh as Array<{ preisfaktor?: number }>, preisfaktorNutzer)
      }
      // Angebot zählt bei der Analyse, nicht mehr beim PDF-Export (Fabian, 16.09.) —
      // das ist der teure Schritt, hier entsteht die Kalkulation. Aber NUR bei einem
      // echten Angebot (Positionen vorhanden): Eine reine Rückfrage ({"fragen":[...]},
      // keine "positionen") ist kein Angebot und darf das Kontingent nicht kosten —
      // sonst würde ein Klärungsdialog über mehrere Runden den Deckel leerkaufen
      // (Fix-Runde 1, Controller 16.09.). Der Platz wurde oben bereits reserviert
      // (reserviereAngebot, VOR dem KI-Aufruf) — kein Hochzählen mehr hier. Ohne
      // Positionen wird die Reservierung wieder freigegeben (gibAngebotFrei).
      const hatPositionen = Array.isArray((validated as { positionen?: unknown }).positionen)
        && (validated as { positionen: unknown[] }).positionen.length > 0
      if (!hatPositionen) await gibReservierungFrei()
      return NextResponse.json({ success: true, data: validated })
    } catch {
      console.error('[analyze] JSON parse failed, raw:', rawText.slice(0, 300))
      await gibReservierungFrei()
      return NextResponse.json(
        { success: false, error: 'JSON Parse Fehler', raw: rawText.slice(0, 300) },
        { status: 500 }
      )
    }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unbekannter Fehler'
    console.error('[analyze] unhandled error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
