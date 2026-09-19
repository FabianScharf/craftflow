// Für die Werkstatt auf www.getcraftflow.de. Öffentlich (PUBLIC_PATHS), ohne Login,
// OHNE Nutzerdaten: nur Titel, Beschreibung, Status, die Zahl der aktiven Stimmen
// und der letzte Änderungszeitpunkt. Seit 17.09. auch offene Vorschläge (OEFFENTLICHE_STATUS). Fünf Minuten Cache am Rand — die Seite muss
// nicht sekundengenau sein, und jeder Aufruf kostet sonst zwei Datenbankabfragen.

import { NextResponse } from 'next/server'
import { getSupabaseClient } from '@/lib/supabase'
import type { ProfilFuerPlan } from '@/lib/plaene'
import { OEFFENTLICHE_STATUS, stimmenJeWunsch, type Stimme } from '@/lib/wuensche'
import {
  fuerDieWebsite, type KommentarZeile, type NameArt, type OeffentlicherKommentar, type Profil,
} from '@/lib/kommentare'

export async function GET() {
  const service = getSupabaseClient()

  const { data: wuensche, error: wErr } = await service
    .from('wuensche')
    .select('id, titel, beschreibung, status, updated_at, created_at')
    .in('status', OEFFENTLICHE_STATUS)
    .is('zusammengelegt_in', null)
    .order('created_at', { ascending: false })
  if (wErr) {
    console.error('[wuensche/oeffentlich] laden:', wErr.message)
    return NextResponse.json({ error: 'Liste nicht verfügbar' }, { status: 500 })
  }

  const { data: stimmenRoh, error: sErr } = await service
    .from('wunsch_stimmen').select('wunsch_id, user_id, created_at')
  if (sErr) {
    console.error('[wuensche/oeffentlich] Stimmen:', sErr.message)
    return NextResponse.json({ error: 'Liste nicht verfügbar' }, { status: 500 })
  }
  const stimmen = (stimmenRoh ?? []) as Stimme[]
  const ids = [...new Set(stimmen.map(s => s.user_id))]
  const profile: Record<string, ProfilFuerPlan> = {}
  if (ids.length > 0) {
    const { data: p, error: pErr } = await service
      .from('betriebsprofil')
      .select('user_id, plan, trial_starts_at, abo_status, plan_gueltig_bis')
      .in('user_id', ids)
    if (pErr) console.error('[wuensche/oeffentlich] Profile:', pErr.message)
    for (const row of p ?? []) profile[String(row.user_id)] = row as ProfilFuerPlan
  }
  const zaehler = stimmenJeWunsch(stimmen, profile, new Date())

  const liste = (wuensche ?? [])
    .map(w => ({
      id: w.id as string,
      titel: w.titel as string,
      beschreibung: w.beschreibung as string,
      status: w.status as string,
      stimmen: zaehler[w.id] ?? 0,
      updated_at: w.updated_at as string,
    }))
    .sort((a, b) => b.stimmen - a.stimmen || a.titel.localeCompare(b.titel, 'de'))

  // Kommentare zu genau diesen Wünschen. Sie gehen OHNE Freigabeschritt nach
  // draußen (Fabians Entscheidung 19.09.) — geprüft wird beim Schreiben.
  //
  // Was hier herausgeht, ist ausschließlich ein NAME, nie eine user_id: Welcher
  // Name das ist, entscheidet jeder Betrieb selbst unter Einstellungen →
  // Wünsche. Die Zuordnung passiert beim Lesen, damit ein späterer Wechsel auf
  // „nur die Region" auch für alte Kommentare gilt.
  const sichtbareIds = new Set(liste.map(w => w.id))
  const kommentare = await ladeKommentare(service, [...sichtbareIds])

  return NextResponse.json({ wuensche: liste, kommentare }, {
    headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
  })
}

/** Alle Kommentare zu den übergebenen Wünschen, fertig für die Website. */
async function ladeKommentare(
  service: ReturnType<typeof getSupabaseClient>,
  wunschIds: string[],
): Promise<OeffentlicherKommentar[]> {
  if (wunschIds.length === 0) return []
  const { data, error } = await service
    .from('wunsch_kommentare')
    .select('id, wunsch_id, user_id, text, vom_entwickler, created_at')
    .in('wunsch_id', wunschIds)
    .order('created_at', { ascending: true })
  if (error) {
    // Kein Abbruch: Die Wünsche selbst sind wichtiger als die Kommentare
    // darunter. Lieber eine Seite ohne Gespräch als gar keine Seite.
    console.error('[wuensche/oeffentlich] Kommentare:', error.message)
    return []
  }
  const zeilen = (data ?? []) as KommentarZeile[]
  const ids = [...new Set(zeilen.map(z => z.user_id))]
  const nameArten: Record<string, NameArt | null> = {}
  const profile: Record<string, Profil> = {}
  if (ids.length > 0) {
    const { data: p, error: pErr } = await service
      .from('betriebsprofil')
      .select('user_id, wunsch_name_art, firma_name, inhaber, plz, ort')
      .in('user_id', ids)
    if (pErr) console.error('[wuensche/oeffentlich] Namen:', pErr.message)
    for (const row of p ?? []) {
      const id = String(row.user_id)
      nameArten[id] = (row.wunsch_name_art ?? null) as NameArt | null
      profile[id] = row as Profil
    }
  }
  return fuerDieWebsite(zeilen, nameArten, profile)
}
