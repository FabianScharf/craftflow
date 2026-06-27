import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { TRIAL_DAYS } from '@/hooks/usePlan'

export const PLAN_LIMITS: Record<string, number | null> = {
  solo:       3,
  starter:    15,
  pro:        50,
  enterprise: null,
}

function currentMonat() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function isInTrial(trialStartsAt: string | null): boolean {
  if (!trialStartsAt) return false
  const end = new Date(trialStartsAt).getTime() + TRIAL_DAYS * 86400_000
  return Date.now() < end
}

// GET — aktuellen Verbrauch + Limit zurückgeben
export async function GET() {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const { data: profil } = await supabase
    .from('betriebsprofil')
    .select('plan, trial_starts_at')
    .eq('user_id', user.id)
    .single()

  const inTrial = isInTrial(profil?.trial_starts_at ?? null)
  const plan = inTrial ? 'enterprise' : (profil?.plan ?? 'solo') as string
  const limit: number | null = plan in PLAN_LIMITS ? PLAN_LIMITS[plan]! : 3
  const monat = currentMonat()

  const { data: usage } = await supabase
    .from('plan_usage')
    .select('angebote_count')
    .eq('user_id', user.id)
    .eq('monat', monat)
    .single()

  const count = usage?.angebote_count ?? 0

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

  const { data: profil } = await supabase
    .from('betriebsprofil')
    .select('plan, trial_starts_at')
    .eq('user_id', user.id)
    .single()

  const inTrial = isInTrial(profil?.trial_starts_at ?? null)
  const plan = inTrial ? 'enterprise' : (profil?.plan ?? 'solo') as string
  const limit: number | null = plan in PLAN_LIMITS ? PLAN_LIMITS[plan]! : 3
  const monat = currentMonat()

  const { data: usage } = await supabase
    .from('plan_usage')
    .select('angebote_count')
    .eq('user_id', user.id)
    .eq('monat', monat)
    .single()

  const count = usage?.angebote_count ?? 0

  if (limit !== null && count >= limit) {
    return NextResponse.json({ error: 'Limit erreicht', limit, count }, { status: 403 })
  }

  await supabase
    .from('plan_usage')
    .upsert({ user_id: user.id, monat, angebote_count: count + 1 }, { onConflict: 'user_id,monat' })

  return NextResponse.json({ ok: true, count: count + 1, limit, remaining: limit === null ? null : limit - count - 1 })
}
