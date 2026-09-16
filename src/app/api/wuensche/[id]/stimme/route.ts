// Eine Stimme je Wunsch und Nutzer (Primärschlüssel in der Tabelle). Das Budget des
// Plans wird VOR dem Anlegen geprüft — und zwar gegen die AKTIVEN Stimmen, nicht
// gegen die Rohzahl: Wer aus einem größeren Plan zurückgewechselt ist, hat inaktive
// Stimmen stehen, die nicht gegen ihn zählen dürfen.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { getSupabaseClient } from '@/lib/supabase'
import { pruefeZugang } from '@/lib/planpruefung'
import { stimmenAblehnung } from '@/lib/plantexte'
import { istPlan, type EffektiverPlan, type Plan, type ProfilFuerPlan } from '@/lib/plaene'
import { stimmenbudget, aktiveStimmen, stimmenJeWunsch, ohneVersteckte, type Stimme } from '@/lib/wuensche'
import { effektiverPlan } from '@/lib/plaene'

/** Aktive Stimmenzahl EINES Wunsches — für die Antwort, damit die Liste sofort stimmt. */
async function zaehleWunsch(wunschId: string): Promise<number> {
  const service = getSupabaseClient()
  const { data: stimmen, error } = await service
    .from('wunsch_stimmen').select('wunsch_id, user_id, created_at')
  if (error) { console.error('[stimme] zählen:', error.message); return 0 }
  const ids = [...new Set((stimmen ?? []).map(s => String(s.user_id)))]
  const profile: Record<string, ProfilFuerPlan> = {}
  if (ids.length > 0) {
    const { data: p, error: pErr } = await service
      .from('betriebsprofil')
      .select('user_id, plan, trial_starts_at, abo_status, plan_gueltig_bis')
      .in('user_id', ids)
    if (pErr) console.error('[stimme] Profile:', pErr.message)
    for (const row of p ?? []) profile[String(row.user_id)] = row as ProfilFuerPlan
  }
  return stimmenJeWunsch((stimmen ?? []) as Stimme[], profile)[wunschId] ?? 0
}

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })
  const zu = await pruefeZugang(supabase, user.id)
  if (zu) return zu

  const { data: wunsch, error: wErr } = await supabase
    .from('wuensche').select('id, status').eq('id', id).maybeSingle()
  if (wErr) return NextResponse.json({ error: wErr.message }, { status: 500 })
  if (!wunsch) return NextResponse.json({ error: 'Diesen Wunsch gibt es nicht mehr.' }, { status: 404 })

  const { data: profil, error: pErr } = await supabase
    .from('betriebsprofil')
    .select('plan, trial_starts_at, abo_status, plan_gueltig_bis')
    .eq('user_id', user.id).single()
  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 })

  const { data: eigene, error: eErr } = await supabase
    .from('wunsch_stimmen').select('wunsch_id, user_id, created_at').eq('user_id', user.id)
  if (eErr) return NextResponse.json({ error: eErr.message }, { status: 500 })
  const bereitsFuerDiesen = (eigene ?? []).some(s => s.wunsch_id === id)
  if (bereitsFuerDiesen) {
    return NextResponse.json({ ok: true, stimmen: await zaehleWunsch(id) })
  }

  const budget = stimmenbudget(profil as ProfilFuerPlan)
  // Stimmen auf ausgeblendete/zusammengelegte Wünsche belegen kein Budget (ohneVersteckte).
  const { data: versteckteRoh } = await getSupabaseClient()
    .from('wuensche').select('id').or('status.eq.ausgeblendet,zusammengelegt_in.not.is.null')
  const zaehlbar = ohneVersteckte((eigene ?? []) as Stimme[], ((versteckteRoh ?? []) as Array<{ id: string }>).map(w => String(w.id)))
  const benutzt = aktiveStimmen(zaehlbar, { [user.id]: profil as ProfilFuerPlan }).length
  if (benutzt >= budget) {
    const plan: EffektiverPlan = effektiverPlan(profil as ProfilFuerPlan)
    const fuerText: Plan = istPlan(plan) ? plan : 'solo'
    return NextResponse.json(stimmenAblehnung(fuerText), { status: 403 })
  }

  const { error } = await supabase.from('wunsch_stimmen').insert({ wunsch_id: id, user_id: user.id })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, stimmen: await zaehleWunsch(id) })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })
  const zu = await pruefeZugang(supabase, user.id)
  if (zu) return zu

  const { error } = await supabase
    .from('wunsch_stimmen').delete().eq('wunsch_id', id).eq('user_id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, stimmen: await zaehleWunsch(id) })
}
