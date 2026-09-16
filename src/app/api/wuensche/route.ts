// Wünsche-Community: Liste (mit aktiven Stimmen und eigenem Budget) und Anlegen.
//
// WARUM HIER EIN SERVICE-ROLE-CLIENT STEHT: Die Stimmenzahl je Wunsch ist die Summe
// der AKTIVEN Stimmen aller Nutzer — und ob eine Stimme aktiv ist, hängt am Plan
// ihres Urhebers. Weder fremde Stimmen noch fremde Betriebsprofile darf der
// angemeldete Nutzer selbst lesen (RLS), deshalb zählt der Server mit erhöhten
// Rechten und gibt nur Zahlen heraus — keine Nutzerdaten.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { getSupabaseClient } from '@/lib/supabase'
import { pruefeZugang } from '@/lib/planpruefung'
import type { ProfilFuerPlan } from '@/lib/plaene'
import {
  pruefeTexte, stimmenbudget, stimmenJeWunsch, ohneVersteckte, VORSCHLAEGE_JE_TAG, type Stimme,
} from '@/lib/wuensche'

const ADMIN_EMAIL = 'l.m.p.1@gmx.de'

/** Alle Stimmen + die Plan-Felder ihrer Urheber — die Grundlage jeder Zählung. */
async function ladeStimmenUndProfile(): Promise<{
  stimmen: Stimme[]; profile: Record<string, ProfilFuerPlan> ; fehler: string | null
}> {
  const service = getSupabaseClient()
  const { data: stimmenRoh, error: stimmenErr } = await service
    .from('wunsch_stimmen')
    .select('wunsch_id, user_id, created_at')
  if (stimmenErr) {
    console.error('[wuensche] Stimmen laden:', stimmenErr.message)
    return { stimmen: [], profile: {}, fehler: stimmenErr.message }
  }
  // Stimmen auf Ausgeblendetes/Zusammengelegtes zählen nicht (siehe ohneVersteckte).
  const { data: versteckteRoh, error: vErr } = await service
    .from('wuensche')
    .select('id')
    .or('status.eq.ausgeblendet,zusammengelegt_in.not.is.null')
  if (vErr) console.error('[wuensche] versteckte Wünsche laden:', vErr.message)
  const stimmen = ohneVersteckte((stimmenRoh ?? []) as Stimme[], (versteckteRoh ?? []).map(w => String(w.id)))
  const ids = [...new Set(stimmen.map(s => s.user_id))]
  if (ids.length === 0) return { stimmen, profile: {}, fehler: null }
  const { data: profileRoh, error: profilErr } = await service
    .from('betriebsprofil')
    .select('user_id, plan, trial_starts_at, abo_status, plan_gueltig_bis')
    .in('user_id', ids)
  if (profilErr) {
    console.error('[wuensche] Profile laden:', profilErr.message)
    return { stimmen, profile: {}, fehler: profilErr.message }
  }
  const profile: Record<string, ProfilFuerPlan> = {}
  for (const p of profileRoh ?? []) profile[String(p.user_id)] = p as ProfilFuerPlan
  return { stimmen, profile, fehler: null }
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })
  const zu = await pruefeZugang(supabase, user.id)
  if (zu) return zu

  const istAdmin = user.email === ADMIN_EMAIL
  // I-1: Ausgeblendete und zusammengelegte Wünsche verschwinden sonst unwiderruflich
  // auch aus Fabians eigener Liste (RLS blendet 'ausgeblendet' grundsätzlich aus, auch
  // vor ihm) — nur für den Admin und nur mit ?alle=1, über den Service-Role-Client.
  // Alle anderen (auch ein Admin ohne den Parameter) bekommen die normale Liste.
  const alle = istAdmin && new URL(req.url).searchParams.get('alle') === '1'

  const { data: wuensche, error: wErr } = alle
    ? await getSupabaseClient()
        .from('wuensche')
        .select('id, user_id, titel, beschreibung, status, zusammengelegt_in, created_at')
        .order('created_at', { ascending: false })
    : await supabase
        .from('wuensche')
        .select('id, user_id, titel, beschreibung, status, created_at')
        .neq('status', 'ausgeblendet')
        .is('zusammengelegt_in', null)
        .order('created_at', { ascending: false })
  if (wErr) return NextResponse.json({ error: wErr.message }, { status: 500 })

  const { stimmen, profile, fehler } = await ladeStimmenUndProfile()
  if (fehler) return NextResponse.json({ error: fehler }, { status: 500 })

  const zaehler = stimmenJeWunsch(stimmen, profile, new Date())
  const eigene = new Set(stimmen.filter(s => s.user_id === user.id).map(s => s.wunsch_id))

  const { data: eigenesProfil, error: pErr } = await supabase
    .from('betriebsprofil')
    .select('plan, trial_starts_at, abo_status, plan_gueltig_bis')
    .eq('user_id', user.id)
    .single()
  if (pErr) console.error('[wuensche] eigenes Profil:', pErr.message)
  const gesamt = stimmenbudget(eigenesProfil as ProfilFuerPlan | null)

  const liste = (wuensche ?? []).map(w => ({
    id: w.id, titel: w.titel, beschreibung: w.beschreibung, status: w.status,
    created_at: w.created_at,
    zusammengelegt_in: (w as { zusammengelegt_in?: string | null }).zusammengelegt_in ?? null,
    stimmen: zaehler[w.id] ?? 0,
    eigeneStimme: eigene.has(w.id),
    vonDir: w.user_id === user.id,
  })).sort((a, b) => b.stimmen - a.stimmen || b.created_at.localeCompare(a.created_at))

  return NextResponse.json({
    wuensche: liste,
    budget: { gesamt, benutzt: Math.min(eigene.size, gesamt) },
    istAdmin,
  })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })
  const zu = await pruefeZugang(supabase, user.id)
  if (zu) return zu

  const body = await req.json().catch(() => ({})) as { titel?: unknown; beschreibung?: unknown }
  const geprueft = pruefeTexte(body.titel, body.beschreibung)
  if (!geprueft.ok) return NextResponse.json({ error: geprueft.grund }, { status: 400 })

  // Spam-Bremse: höchstens drei neue Vorschläge je Nutzer und Tag.
  const seit = new Date(); seit.setHours(0, 0, 0, 0)
  const { count, error: zErr } = await supabase
    .from('wuensche')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .gte('created_at', seit.toISOString())
  if (zErr) return NextResponse.json({ error: zErr.message }, { status: 500 })
  if ((count ?? 0) >= VORSCHLAEGE_JE_TAG) {
    return NextResponse.json(
      { error: `Du kannst höchstens ${VORSCHLAEGE_JE_TAG} Vorschläge am Tag einreichen. Morgen geht es weiter.`, minPlan: null },
      { status: 403 },
    )
  }

  const { data: row, error } = await supabase
    .from('wuensche')
    .insert({ user_id: user.id, titel: geprueft.titel, beschreibung: geprueft.beschreibung })
    .select('id, titel, beschreibung, status, created_at')
    .single()
  if (error || !row) return NextResponse.json({ error: error?.message ?? 'Anlegen fehlgeschlagen' }, { status: 500 })

  return NextResponse.json(
    { wunsch: { ...row, stimmen: 0, eigeneStimme: false, vonDir: true } },
    { status: 201 },
  )
}
