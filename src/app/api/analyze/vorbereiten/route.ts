// Serverseitige Vorbereitung: Dateien des Projekts lesen, Text aus PDFs ziehen,
// alles zusammen in Blöcke teilen — und das Ergebnis als _vorbereitet.json in
// denselben privaten Bucket legen. /api/analyze/block holt sich daraus seinen Block.
//
// WARUM ALS DATEI UND NICHT IN EINER TABELLE: Die Blöcke gehören zum Projekt, liegen
// im selben Ordner wie seine Dateien und verschwinden mit ihm. Eine eigene Tabelle
// wäre eine zusätzliche Migration für Daten, die nur Minuten leben.
//
// Was nicht gelesen werden kann, wird GEMELDET (nichtVerarbeitet), nicht verschwiegen.

import { NextRequest, NextResponse } from 'next/server'
import { getDocumentProxy } from 'unpdf'
import { createClient } from '@/utils/supabase/server'
import { pruefeZugang, ladeEffektivenPlan } from '@/lib/planpruefung'
import { deckel, erlaubt, wendeDeckelAn } from '@/lib/plaene'
import { deckelAblehnung, bloeckeAblehnung } from '@/lib/plantexte'
import { zaehltGegenDeckel, istUuid } from '@/lib/upload'
import { teileInBloecke, blockInfos, zeilenAusTextstuecken, type Block } from '@/lib/bloecke'
import { kontoIdFuer, kontoGesperrt } from '@/lib/kontoserver'

export const maxDuration = 300

const BUCKET = 'projektdateien'
const VORBEREITET = '_vorbereitet.json'
const BILD_ENDUNGEN = ['.jpg', '.jpeg', '.png', '.webp']

export async function POST(req: NextRequest) {
  // Äußeres try/catch (Audit 2026-09-17, Minor 14): Ein unerwarteter Fehler — etwa in
  // `unpdf` bei einem kaputten PDF — kam bisher als rohe Next.js-500 ohne eine Zeile
  // Deutsch beim Nutzer an. Hier wird nichts reserviert, es gibt also nichts
  // freizugeben; es geht allein um eine lesbare Meldung.
  try {
    return await vorbereiten(req)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unbekannter Fehler'
    console.error('[vorbereiten] unhandled error:', msg)
    return NextResponse.json(
      { error: `Die Vorbereitung ist fehlgeschlagen: ${msg}` },
      { status: 500 },
    )
  }
}

async function vorbereiten(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })
  const konto = await kontoIdFuer(supabase, user)
  const sperre = kontoGesperrt(konto)
  if (sperre) return sperre
  const kontoId = konto.kontoId
  const zu = await pruefeZugang(supabase, kontoId)
  if (zu) return zu

  const { projekt_id: projektId, text } = await req.json().catch(() => ({})) as
    { projekt_id?: string; text?: string }
  if (!projektId) return NextResponse.json({ error: 'Kein Projekt' }, { status: 400 })

  // Fix-Runde 1 (Review-Important): `projekt_id` kam bisher ungeprüft aus dem Client —
  // weder als gültige UUID noch als Eigentum des Nutzers geprüft. Gleiches Muster wie
  // in /api/upload. Fail closed: ein Supabase-Fehler zählt wie „kein passendes Projekt".
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
    if (projErr) console.error('[vorbereiten] Projekt-Prüfung:', projErr.message)
    return NextResponse.json({ error: 'Ungültiges Projekt.' }, { status: 400 })
  }

  const ordner = `${kontoId}/${projektId}`
  // Fix-Runde 1 (Review-Critical): list() sortiert standardmäßig nach Namen, und die
  // Namen beginnen mit einer zufälligen UUID (bauePfad) — ohne explizite Sortierung nach
  // created_at käme Text/Bilder in Zufallsreihenfolge, nicht in Upload-Reihenfolge.
  const { data: dateien, error: listErr } = await supabase.storage
    .from(BUCKET)
    .list(ordner, { limit: 200, sortBy: { column: 'created_at', order: 'asc' } })
  if (listErr) return NextResponse.json({ error: listErr.message }, { status: 500 })
  // _vorbereitet.json selbst zählt nicht gegen den Deckel (dieselbe Regel wie beim Upload).
  const nutzdateien = (dateien ?? []).filter(d => zaehltGegenDeckel(d.name))

  const plan = await ladeEffektivenPlan(supabase, kontoId)
  const grenze = deckel(plan, 'dateien')
  // Deckel 0 (Solo) bleibt eine Ablehnung: Dort gibt es keinen Datei-Upload, den man
  // kappen könnte — Funktionsfrage, keine Mengenfrage.
  if (grenze === 0 && nutzdateien.length > 0) {
    return NextResponse.json(
      { ...deckelAblehnung('dateien', plan === 'gesperrt' ? 'solo' : plan, grenze) },
      { status: 403 },
    )
  }
  // Wechsel nach unten (Audit 2026-09-17, I10): dieselbe Regel wie bei Bauweise-
  // Regeln, Materialpreisen und Wunsch-Stimmen — die ÄLTESTEN N bleiben aktiv, der
  // Rest ruht. Nichts wird gelöscht, ein Upgrade wirkt sofort. Vorher wurde die
  // ganze Vorbereitung verweigert, sobald eine Datei zu viel am Projekt hing.
  const hinweise: string[] = []
  const mitDeckel = wendeDeckelAn(
    nutzdateien.map(d => ({ ...d, created_at: String(d.created_at ?? '') })),
    grenze,
  )
  const aktiveDateien = mitDeckel.filter(d => d.aktivDurchPlan)
  const ruhende = mitDeckel.filter(d => !d.aktivDurchPlan)
  if (ruhende.length > 0) {
    hinweise.push(
      `Dein Plan erlaubt ${grenze} ${grenze === 1 ? 'Datei' : 'Dateien'} je Projekt. ` +
      `Nicht berücksichtigt ${ruhende.length === 1 ? 'wurde' : 'wurden'}: ` +
      `${ruhende.map(d => d.name).join(', ')}.`,
    )
  }

  const nichtVerarbeitet: Array<{ name: string; grund: string }> = []
  const bildPfade: string[] = []
  let gesamtText = String(text ?? '').trim()

  for (const d of aktiveDateien) {
    const pfad = `${ordner}/${d.name}`
    const endung = d.name.slice(d.name.lastIndexOf('.')).toLowerCase()
    if (BILD_ENDUNGEN.includes(endung)) { bildPfade.push(pfad); continue }
    if (endung !== '.pdf') {
      nichtVerarbeitet.push({ name: d.name, grund: 'kein Bild und kein PDF' })
      continue
    }
    const { data: blob, error: dlErr } = await supabase.storage.from(BUCKET).download(pfad)
    if (dlErr || !blob) {
      nichtVerarbeitet.push({ name: d.name, grund: 'konnte nicht geladen werden' })
      continue
    }
    try {
      // Seitenweise mit pdf.js statt `extractText(bytes, { mergePages: true })`: Das
      // lieferte im Live-Test einen kompletten mehrseitigen Text als EINE Zeile ohne
      // jedes `\n` — siehe Doku bei `zeilenAusTextstuecken` in bloecke.ts.
      const pdf = await getDocumentProxy(new Uint8Array(await blob.arrayBuffer()))
      const seiten: string[] = []
      for (let seite = 1; seite <= pdf.numPages; seite++) {
        const tc = await (await pdf.getPage(seite)).getTextContent()
        const stuecke = (tc.items as Array<{ str?: string; transform?: number[]; hasEOL?: boolean }>)
          .filter(it => typeof it.str === 'string')
          .map(it => ({ str: it.str as string, y: it.transform?.[5] ?? 0, eol: it.hasEOL }))
        seiten.push(zeilenAusTextstuecken(stuecke))
      }
      const pdfText = seiten.join('\n\n')
      const sauber = String(pdfText ?? '').trim()
      if (!sauber) {
        // Gescannte PDFs haben keinen Text. Das ist kein Fehler, aber der Nutzer
        // muss es wissen — sonst wundert er sich über fehlende Positionen.
        nichtVerarbeitet.push({ name: d.name, grund: 'kein lesbarer Text (gescannt?) — bitte als Foto hochladen' })
        continue
      }
      gesamtText = gesamtText ? `${gesamtText}\n\n--- ${d.name} ---\n${sauber}` : `--- ${d.name} ---\n${sauber}`
    } catch (e) {
      nichtVerarbeitet.push({ name: d.name, grund: e instanceof Error ? e.message : 'nicht lesbar' })
    }
  }

  const bloecke: Block[] = teileInBloecke(gesamtText, bildPfade)
  if (bloecke.length === 0) {
    return NextResponse.json({ error: 'Kein Text und keine Bilder — es gibt nichts zu analysieren.' }, { status: 400 })
  }
  if (bloecke.length > 1 && !erlaubt(plan, 'bloecke')) {
    return NextResponse.json(bloeckeAblehnung(), { status: 403 })
  }

  const inhalt = JSON.stringify({ erstellt: new Date().toISOString(), bloecke })
  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(`${ordner}/${VORBEREITET}`, new TextEncoder().encode(inhalt), {
      contentType: 'application/json', upsert: true,
    })
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })

  return NextResponse.json({ bloecke: blockInfos(bloecke), nichtVerarbeitet, hinweise })
}
