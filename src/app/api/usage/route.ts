import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { deckel, effektiverPlan } from '@/lib/plaene'
import { deckelAblehnung } from '@/lib/plantexte'
import { pruefeZugang } from '@/lib/planpruefung'
import { aktuellerMonat, ladeAngebotsstand, reserviereAngebot } from '@/lib/angebotszaehler'
import { kontoIdFuer, kontoGesperrt } from '@/lib/kontoserver'

// GET — aktuellen Verbrauch + Limit zurückgeben
export async function GET() {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })
  const konto = await kontoIdFuer(supabase, user)
  const sperre = kontoGesperrt(konto)
  if (sperre) return sperre
  const kontoId = konto.kontoId

  const { data: profil, error: profilErr } = await supabase
    .from('betriebsprofil')
    .select('plan, trial_starts_at, abo_status, plan_gueltig_bis')
    .eq('user_id', kontoId)
    .single()
  // Faellt in der Praxis fail-closed auf 'gesperrt' — aber bisher unbemerkt und
  // ungeloggt (Audit 2026-09-17, Minor 11).
  if (profilErr) console.error('[usage] Betriebsprofil:', profilErr.message)

  const plan = effektiverPlan(profil)
  const limit = deckel(plan, 'angebote')
  const { count } = await ladeAngebotsstand(supabase, kontoId)

  return NextResponse.json({
    plan,
    limit,
    count,
    remaining: limit === null ? null : Math.max(0, limit - count),
    erlaubt: limit === null || count < limit,
  })
}

// POST — Zähler um 1 erhöhen (nur wenn Limit noch nicht erreicht).
// Wird vom Browser nicht mehr aufgerufen (das Zählen passiert seit Fix-Runde
// 16.09. in /api/analyze über dieselbe reserviereAngebot()) — auf die atomare
// Reservierung umgestellt statt entfernt, damit ein externer Aufrufer (falls
// es je einen gab/gibt) denselben race-freien Deckel bekommt wie /api/analyze.
export async function POST() {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })
  const konto = await kontoIdFuer(supabase, user)
  const sperre = kontoGesperrt(konto)
  if (sperre) return sperre
  const kontoId = konto.kontoId

  const zu = await pruefeZugang(supabase, kontoId)
  if (zu) return zu

  const { data: profil, error: profilErr } = await supabase
    .from('betriebsprofil')
    .select('plan, trial_starts_at, abo_status, plan_gueltig_bis')
    .eq('user_id', kontoId)
    .single()
  // Faellt in der Praxis fail-closed auf 'gesperrt' — aber bisher unbemerkt und
  // ungeloggt (Audit 2026-09-17, Minor 11).
  if (profilErr) console.error('[usage] Betriebsprofil:', profilErr.message)

  const plan = effektiverPlan(profil)
  const limit = deckel(plan, 'angebote')
  const monat = aktuellerMonat()
  const reservierung = await reserviereAngebot(supabase, monat, limit)

  if (!reservierung.ok) {
    // plan ist hier praktisch nie 'gesperrt' (pruefeZugang hat das oben schon
    // ausgeschlossen) — Solo als Fallback-Text, gleiches Muster wie pruefeDeckel.
    return NextResponse.json(
      { limit, count: reservierung.count, ...deckelAblehnung('angebote', plan === 'gesperrt' ? 'solo' : plan, limit ?? 0) },
      { status: 403 },
    )
  }

  return NextResponse.json({
    ok: true, count: reservierung.count, limit,
    remaining: limit === null ? null : Math.max(0, limit - reservierung.count),
  })
}
