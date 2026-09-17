// Stimmenkonto (Stimmenkonto, 16.09. abends): kein "eine Stimme je Wunsch" mehr —
// jeder POST legt EINE weitere Stimme an, solange Budget frei ist, Stapeln auf denselben
// Wunsch ist erlaubt. Das Budget des Plans wird VOR dem Anlegen geprüft — und zwar gegen
// die AKTIVEN, ZÄHLBAREN Stimmen: Wer aus einem größeren Plan zurückgewechselt ist, hat
// ruhende Stimmen stehen, die nicht gegen ihn zählen dürfen; wer für fertige, ausgeblendete
// oder zusammengelegte Wünsche gestimmt hat, hat diese Stimmen automatisch zurückbekommen.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { getSupabaseClient } from '@/lib/supabase'
import { kontoIdFuer, kontoGesperrt } from '@/lib/kontoserver'
import { pruefeZugang } from '@/lib/planpruefung'
import { stimmenAblehnung } from '@/lib/plantexte'
import { istPlan, type EffektiverPlan, type Plan, type ProfilFuerPlan } from '@/lib/plaene'
import { stimmenbudget, aktiveStimmen, stimmenJeWunsch, ohneVersteckte, type Stimme } from '@/lib/wuensche'
import { effektiverPlan } from '@/lib/plaene'

/**
 * Aktive Stimmenzahl EINES Wunsches — für die Antwort, damit die Liste sofort stimmt.
 * Ein fertiger Wunsch zählt seine Stimmen ROH weiter (siehe GET /api/wuensche): Er
 * liegt außerhalb der Budget-Rechnung, die Plan-Deckelung ergibt für ihn keinen Sinn
 * mehr — sie würde nur zufällig einen Teil seiner Stimmen als "inaktiv" markieren.
 */
async function zaehleWunsch(wunschId: string): Promise<number> {
  const service = getSupabaseClient()
  const { data: stimmenRoh, error } = await service
    .from('wunsch_stimmen').select('wunsch_id, user_id, created_at')
  if (error) { console.error('[stimme] zählen:', error.message); return 0 }
  const stimmenAlle = (stimmenRoh ?? []) as Stimme[]

  const { data: wunsch, error: wErr } = await service
    .from('wuensche').select('status').eq('id', wunschId).maybeSingle()
  if (wErr) console.error('[stimme] Wunsch laden:', wErr.message)
  if (wunsch?.status === 'fertig') {
    return stimmenAlle.filter(s => s.wunsch_id === wunschId).length
  }

  const { data: versteckteRoh, error: vErr } = await service
    .from('wuensche').select('id').or('status.in.(ausgeblendet,fertig),zusammengelegt_in.not.is.null')
  if (vErr) console.error('[stimme] versteckte Wünsche laden:', vErr.message)
  const stimmen = ohneVersteckte(stimmenAlle, ((versteckteRoh ?? []) as Array<{ id: string }>).map(w => String(w.id)))
  const ids = [...new Set(stimmen.map(s => String(s.user_id)))]
  const profile: Record<string, ProfilFuerPlan> = {}
  if (ids.length > 0) {
    const { data: p, error: pErr } = await service
      .from('betriebsprofil')
      .select('user_id, plan, trial_starts_at, abo_status, plan_gueltig_bis')
      .in('user_id', ids)
    if (pErr) console.error('[stimme] Profile:', pErr.message)
    for (const row of p ?? []) profile[String(row.user_id)] = row as ProfilFuerPlan
  }
  return stimmenJeWunsch(stimmen, profile)[wunschId] ?? 0
}

/** Wie viele eigene Zeilen der Nutzer gerade auf diesem Wunsch liegen hat (für die Antwort). */
async function zaehleEigene(supabase: Awaited<ReturnType<typeof createClient>>, wunschId: string, userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('wunsch_stimmen')
    .select('id', { count: 'exact', head: true })
    .eq('wunsch_id', wunschId).eq('user_id', userId)
  if (error) { console.error('[stimme] eigene zählen:', error.message); return 0 }
  return count ?? 0
}

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })
  const konto = await kontoIdFuer(supabase, user)
  const sperre = kontoGesperrt(konto); if (sperre) return sperre
  const kontoId = konto.kontoId
  const zu = await pruefeZugang(supabase, kontoId)
  if (zu) return zu

  const { data: wunsch, error: wErr } = await supabase
    .from('wuensche').select('id, status, zusammengelegt_in').eq('id', id).maybeSingle()
  if (wErr) return NextResponse.json({ error: wErr.message }, { status: 500 })
  if (!wunsch) return NextResponse.json({ error: 'Diesen Wunsch gibt es nicht mehr.' }, { status: 404 })
  if (wunsch.status === 'fertig' || wunsch.status === 'ausgeblendet' || wunsch.zusammengelegt_in) {
    return NextResponse.json({ error: 'Dieser Wunsch nimmt keine Stimmen mehr an.' }, { status: 400 })
  }

  // R3: Budget und Plan hängen am Betrieb (Konto), nicht am einzelnen Login.
  const { data: profil, error: pErr } = await supabase
    .from('betriebsprofil')
    .select('plan, trial_starts_at, abo_status, plan_gueltig_bis')
    .eq('user_id', kontoId).single()
  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 })

  const { data: eigene, error: eErr } = await supabase
    .from('wunsch_stimmen').select('wunsch_id, user_id, created_at').eq('user_id', kontoId)
  if (eErr) return NextResponse.json({ error: eErr.message }, { status: 500 })

  const budget = stimmenbudget(profil as ProfilFuerPlan)
  // Stimmen auf fertige/ausgeblendete/zusammengelegte Wünsche belegen kein Budget (ohneVersteckte).
  const { data: versteckteRoh } = await getSupabaseClient()
    .from('wuensche').select('id').or('status.in.(ausgeblendet,fertig),zusammengelegt_in.not.is.null')
  const zaehlbar = ohneVersteckte((eigene ?? []) as Stimme[], ((versteckteRoh ?? []) as Array<{ id: string }>).map(w => String(w.id)))
  const benutzt = aktiveStimmen(zaehlbar, { [kontoId]: profil as ProfilFuerPlan }).length
  if (benutzt >= budget) {
    const plan: EffektiverPlan = effektiverPlan(profil as ProfilFuerPlan)
    const fuerText: Plan = istPlan(plan) ? plan : 'solo'
    return NextResponse.json(stimmenAblehnung(fuerText), { status: 403 })
  }

  const { error } = await supabase.from('wunsch_stimmen').insert({ wunsch_id: id, user_id: kontoId })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({
    ok: true, stimmen: await zaehleWunsch(id), eigeneStimmen: await zaehleEigene(supabase, id, kontoId),
  })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })
  const konto = await kontoIdFuer(supabase, user)
  const sperre = kontoGesperrt(konto); if (sperre) return sperre
  const kontoId = konto.kontoId
  const zu = await pruefeZugang(supabase, kontoId)
  if (zu) return zu

  // Genau EINE eigene Stimme zurücknehmen — die NEUESTE eigene Zeile auf diesem Wunsch.
  const { data: neueste, error: nErr } = await supabase
    .from('wunsch_stimmen')
    .select('id')
    .eq('wunsch_id', id).eq('user_id', kontoId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (nErr) return NextResponse.json({ error: nErr.message }, { status: 500 })
  if (!neueste) return NextResponse.json({ error: 'Du hast hier keine Stimme.' }, { status: 404 })

  const { error } = await supabase.from('wunsch_stimmen').delete().eq('id', neueste.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({
    ok: true, stimmen: await zaehleWunsch(id), eigeneStimmen: await zaehleEigene(supabase, id, kontoId),
  })
}
