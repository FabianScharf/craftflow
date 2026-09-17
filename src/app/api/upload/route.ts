// Eine Datei je Aufruf — bewusst. Damit fällt die 4,5-MB-Wand von Vercel: Der
// Browser lädt dreißig Fotos in dreißig kleinen Anfragen hoch statt in einer großen,
// und jeder einzelne Fehlschlag ist sichtbar statt einer stummen 413.
//
// Der Bucket ist privat (docs/sql/2026-09-16-bloecke-storage.sql). Gelesen wird nur
// serverseitig bzw. über signierte URLs, die der Server erzeugt — nichts davon landet
// je in einer öffentlichen URL.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { pruefeZugang, pruefeFunktion, pruefeDeckel, ladeEffektivenPlan } from '@/lib/planpruefung'
import { pruefeDatei, zaehltGegenDeckel, bauePfad, istUuid } from '@/lib/upload'
import { kontoIdFuer, kontoGesperrt } from '@/lib/kontoserver'

export const maxDuration = 300

const BUCKET = 'projektdateien'

/**
 * Zählt die Dateien eines Projekts im Storage. Dateien mit führendem Unterstrich
 * sind interne Zwischenstände (`_vorbereitet.json`) und zählen nicht gegen den Deckel.
 *
 * Fail closed (Fix-Runde 1): Ein Fehler beim Listen darf nie als „0 Dateien" durchgehen —
 * sonst würde ein Storage-Fehler den Deckel unbemerkt aushebeln. `ok: false` heißt: der
 * Aufrufer lehnt ab, statt weiterzumachen.
 */
async function zaehleDateien(
  supabase: Awaited<ReturnType<typeof createClient>>, kontoId: string, projektId: string,
): Promise<{ ok: true; anzahl: number } | { ok: false }> {
  const { data, error } = await supabase.storage.from(BUCKET).list(`${kontoId}/${projektId}`, { limit: 200 })
  if (error) { console.error('[upload] list:', error.message); return { ok: false } }
  return { ok: true, anzahl: (data ?? []).filter(d => zaehltGegenDeckel(d.name)).length }
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })
  const konto = await kontoIdFuer(supabase, user)
  const sperreKonto = kontoGesperrt(konto)
  if (sperreKonto) return sperreKonto
  const kontoId = konto.kontoId
  const zu = await pruefeZugang(supabase, kontoId)
  if (zu) return zu
  const sperre = await pruefeFunktion(supabase, kontoId, 'dateien')
  if (sperre) return sperre

  const form = await req.formData()
  const file = form.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'Keine Datei' }, { status: 400 })

  const pruefung = pruefeDatei(file)
  if (!pruefung.ok) return NextResponse.json({ error: pruefung.error }, { status: 400 })

  // Ohne Projekt-Kennung zuerst einen Entwurf anlegen, damit jede Datei zu einem
  // Projekt gehört. Ohne diesen Schritt hinge die Datei im Nichts, sobald der
  // Nutzer den Browser schließt. Derselbe Insert wie in POST /api/projects.
  let projektId = String(form.get('projekt_id') ?? '').trim()
  if (projektId) {
    // Fix-Runde 1: `projekt_id` kam bisher ungeprüft aus dem Client — weder als
    // gültige UUID noch als Eigentum des Nutzers geprüft. Fail closed: Ein
    // Supabase-Fehler zählt hier wie „kein passendes Projekt gefunden".
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
      if (projErr) console.error('[upload] Projekt-Prüfung:', projErr.message)
      return NextResponse.json({ error: 'Ungültiges Projekt.' }, { status: 400 })
    }
  } else {
    const { data: row, error: pErr } = await supabase
      .from('projects')
      .insert({ user_id: kontoId, title: 'Entwurf', status: 'offen', data: {} })
      .select('id')
      .single()
    if (pErr || !row) {
      console.error('[upload] Projekt-Entwurf:', pErr?.message)
      return NextResponse.json({ error: pErr?.message ?? 'Projekt-Entwurf konnte nicht angelegt werden.' }, { status: 500 })
    }
    projektId = String(row.id)
  }

  const plan = await ladeEffektivenPlan(supabase, kontoId)
  const vorhanden = await zaehleDateien(supabase, kontoId, projektId)
  if (!vorhanden.ok) {
    return NextResponse.json({ error: 'Dateien konnten nicht gezählt werden.' }, { status: 500 })
  }
  const deckelSperre = pruefeDeckel(plan, 'dateien', vorhanden.anzahl)
  if (deckelSperre) return deckelSperre

  const pfad = bauePfad(kontoId, projektId, crypto.randomUUID(), file.name)
  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(pfad, await file.arrayBuffer(), {
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    })
  if (upErr) {
    console.error('[upload] upload:', upErr.message)
    return NextResponse.json({ error: upErr.message }, { status: 500 })
  }

  return NextResponse.json({ pfad, name: file.name, groesse: file.size, projekt_id: projektId })
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })
  const konto = await kontoIdFuer(supabase, user)
  const sperreKonto = kontoGesperrt(konto)
  if (sperreKonto) return sperreKonto
  const kontoId = konto.kontoId
  const zu = await pruefeZugang(supabase, kontoId)
  if (zu) return zu

  const { pfad } = await req.json().catch(() => ({})) as { pfad?: string }
  if (!pfad) return NextResponse.json({ error: 'Kein Pfad' }, { status: 400 })
  // Zweite Mauer neben der Storage-Policy: Wer einen fremden Pfad schickt, bekommt
  // 403 statt eines stillen Fehlschlags.
  if (!pfad.startsWith(`${kontoId}/`)) {
    return NextResponse.json({ error: 'Kein Zugriff auf diese Datei.' }, { status: 403 })
  }
  // Fix-Runde 1: das mittlere Pfadsegment ist die projekt_id — dieselbe Form-Prüfung
  // wie beim Hochladen, damit kein manipulierter Pfad (z. B. mit zusätzlichen "/")
  // ungeprüft an storage.remove() geht.
  const segmente = pfad.split('/')
  if (segmente.length !== 3 || !istUuid(segmente[1])) {
    return NextResponse.json({ error: 'Ungültiger Pfad.' }, { status: 400 })
  }

  const { error } = await supabase.storage.from(BUCKET).remove([pfad])
  if (error) {
    console.error('[upload] remove:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
