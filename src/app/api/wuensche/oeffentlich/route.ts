// Für die Roadmap auf www.getcraftflow.de. Öffentlich (PUBLIC_PATHS), ohne Login,
// OHNE Nutzerdaten: nur Titel, Beschreibung, Status, die Zahl der aktiven Stimmen
// und der letzte Änderungszeitpunkt. Seit 17.09. auch offene Vorschläge (OEFFENTLICHE_STATUS). Fünf Minuten Cache am Rand — die Seite muss
// nicht sekundengenau sein, und jeder Aufruf kostet sonst zwei Datenbankabfragen.

import { NextResponse } from 'next/server'
import { getSupabaseClient } from '@/lib/supabase'
import type { ProfilFuerPlan } from '@/lib/plaene'
import { OEFFENTLICHE_STATUS, stimmenJeWunsch, type Stimme } from '@/lib/wuensche'

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

  return NextResponse.json({ wuensche: liste }, {
    headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
  })
}
