import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { deckel, effektiverPlan } from '@/lib/plaene'
import { pruefeZugang } from '@/lib/planpruefung'
import { ladeAngebotsstand, zaehleAngebotHoch } from '@/lib/angebotszaehler'

// GET — aktuellen Verbrauch + Limit zurückgeben
export async function GET() {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const { data: profil } = await supabase
    .from('betriebsprofil')
    .select('plan, trial_starts_at, abo_status, plan_gueltig_bis')
    .eq('user_id', user.id)
    .single()

  const plan = effektiverPlan(profil)
  const limit = deckel(plan, 'angebote')
  const { count } = await ladeAngebotsstand(supabase, user.id)

  return NextResponse.json({
    plan,
    limit,
    count,
    remaining: limit === null ? null : Math.max(0, limit - count),
    erlaubt: limit === null || count < limit,
  })
}

// POST — Zähler um 1 erhöhen (nur wenn Limit noch nicht erreicht)
export async function POST() {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const zu = await pruefeZugang(supabase, user.id)
  if (zu) return zu

  const { data: profil } = await supabase
    .from('betriebsprofil')
    .select('plan, trial_starts_at, abo_status, plan_gueltig_bis')
    .eq('user_id', user.id)
    .single()

  const plan = effektiverPlan(profil)
  const limit = deckel(plan, 'angebote')
  const { count, monat } = await ladeAngebotsstand(supabase, user.id)

  if (limit !== null && count >= limit) {
    return NextResponse.json({ error: 'Limit erreicht', limit, count }, { status: 403 })
  }

  await zaehleAngebotHoch(supabase, user.id, monat, count)

  return NextResponse.json({ ok: true, count: count + 1, limit, remaining: limit === null ? null : limit - count - 1 })
}
