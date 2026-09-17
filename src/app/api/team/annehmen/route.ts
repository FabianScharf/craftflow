// POST /api/team/annehmen  { token }  — der Eingeladene tritt dem Betrieb bei.
//
// Der einzige Schreibvorgang der Teamfunktion, den NICHT der Inhaber macht. Er
// läuft über die Service-Role, weil der Beitretende auf der Zeile noch keine
// Rechte hat (RLS: „inhaber ändert team"). Deshalb prüft die Route selbst, und
// zwar vollständig:
//
//   1. Token existiert und die Einladung ist offen        → sonst 404
//   2. Die angemeldete Adresse IST die eingeladene        → sonst 403
//   3. Der Beitretende ist nicht schon irgendwo Mitglied  → sonst 409
//   4. Er ist noch kein eigener Betrieb (Ruling R4)       → sonst 409
//   5. Der Betrieb hat einen freien Nutzerplatz           → sonst 403
//
// Punkt 2 ist der Kern: Ohne ihn könnte jeder, der den Link in die Hände bekommt,
// mit einem eigenen Konto in einen fremden Betrieb spazieren.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { getSupabaseClient } from '@/lib/supabase'
import { normalisiereEmail, plaetzeFrei, TEAM_TEXTE } from '@/lib/team'
import { effektiverPlan, PLAN_LABELS, type Plan, type ProfilFuerPlan } from '@/lib/plaene'
import { istToken } from '../gemeinsam'

/**
 * Ruling R4: Ein Konto darf beitreten, wenn es kein Betriebsprofil hat ODER eines
 * ohne Projekte und ohne laufendes Abo. Sonst wäre die Annahme ein stiller
 * Datenverlust — die eigenen Projekte lägen unter der eigenen user_id, sichtbar
 * wäre ab dann der Betrieb des Inhabers.
 *
 * `abo_status` heißt in dieser Datenbank 'aktiv'/'beendet' (so schreibt es der
 * Stripe-Webhook, siehe plaene.ts). Die Stripe-Schreibweisen stehen zusätzlich in
 * der Liste, damit die Prüfung nicht an einer Wortwahl scheitert.
 */
const LAUFENDES_ABO = ['aktiv', 'active', 'trialing']

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const body = await req.json().catch(() => ({})) as { token?: string }
  if (!istToken(body.token)) {
    return NextResponse.json({ error: 'Diese Einladung gibt es nicht mehr.' }, { status: 404 })
  }
  const token = body.token

  const service = getSupabaseClient()
  const { data: zeile, error } = await service
    .from('betrieb_mitglieder')
    .select('id, inhaber_id, email, status')
    .eq('token', token)
    .eq('status', 'eingeladen')
    .maybeSingle()
  if (error) {
    console.error('[team/annehmen] Einladung laden:', error.message)
    return NextResponse.json({ error: 'Die Einladung ist gerade nicht abrufbar.' }, { status: 500 })
  }
  if (!zeile) return NextResponse.json({ error: 'Diese Einladung gibt es nicht mehr.' }, { status: 404 })

  // 2. Adressgleichheit — beide Seiten normalisiert, weil die Einladung
  // kleingeschrieben gespeichert ist und Supabase Adressen so liefert, wie sie
  // eingetippt wurden.
  if (normalisiereEmail(user.email ?? '') !== normalisiereEmail(zeile.email as string)) {
    return NextResponse.json({ error: TEAM_TEXTE.andereAdresse }, { status: 403 })
  }
  // Die Adressgleichheit trägt nur, wenn die Adresse dem Konto wirklich gehört.
  // Supabase bestätigt Registrierungen per Mail, also ist das heute immer erfüllt —
  // wäre die Bestätigung je abgeschaltet, könnte sich sonst jemand mit der Adresse
  // eines Kollegen anmelden und dessen Einladung annehmen.
  if (!user.email_confirmed_at) {
    return NextResponse.json({ error: 'Bitte bestätige zuerst deine E-Mail-Adresse über den Link in der Registrierungsmail.' }, { status: 403 })
  }
  // Ein Inhaber kann nicht in seinem eigenen Betrieb Mitarbeiter sein (Spec §1).
  if (zeile.inhaber_id === user.id) {
    return NextResponse.json({ error: 'Das ist dein eigener Betrieb.' }, { status: 409 })
  }

  // 3. Ein Mitarbeiter gehört zu genau EINEM Betrieb (Spec §1).
  const { data: schon, error: sErr } = await service
    .from('betrieb_mitglieder')
    .select('id')
    .eq('user_id', user.id)
    .eq('status', 'aktiv')
    .limit(1)
  if (sErr) {
    console.error('[team/annehmen] bestehende Mitgliedschaft:', sErr.message)
    return NextResponse.json({ error: 'Die Einladung ist gerade nicht abrufbar.' }, { status: 500 })
  }
  if ((schon ?? []).length > 0) {
    return NextResponse.json({ error: 'Du bist schon Mitarbeiter in einem Betrieb. Verlasse ihn zuerst.' }, { status: 409 })
  }

  // 4. Ruling R4
  const { data: eigenes, error: eErr } = await service
    .from('betriebsprofil')
    .select('abo_status')
    .eq('user_id', user.id)
    .maybeSingle()
  if (eErr) {
    console.error('[team/annehmen] eigenes Profil:', eErr.message)
    return NextResponse.json({ error: 'Die Einladung ist gerade nicht abrufbar.' }, { status: 500 })
  }
  if (eigenes && LAUFENDES_ABO.includes(String(eigenes.abo_status ?? ''))) {
    return NextResponse.json({ error: TEAM_TEXTE.eigenerBetrieb }, { status: 409 })
  }
  const { count, error: pjErr } = await service
    .from('projects')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
  if (pjErr) {
    console.error('[team/annehmen] eigene Projekte:', pjErr.message)
    return NextResponse.json({ error: 'Die Einladung ist gerade nicht abrufbar.' }, { status: 500 })
  }
  if ((count ?? 0) > 0) {
    return NextResponse.json({ error: TEAM_TEXTE.eigenerBetrieb }, { status: 409 })
  }

  // 5. Deckel des Betriebs — hier zählen NUR die aktiven Mitglieder. Die offenen
  // Einladungen (auch die eigene) sind beim Einladen schon eingerechnet worden;
  // sie hier nochmal zu zählen, würde die letzte Einladung nie annehmbar machen.
  const { data: profil, error: prErr } = await service
    .from('betriebsprofil')
    .select('firma_name, plan, trial_starts_at, abo_status, plan_gueltig_bis')
    .eq('user_id', zeile.inhaber_id as string)
    .maybeSingle()
  if (prErr) console.error('[team/annehmen] Profil des Betriebs:', prErr.message)
  const plan = effektiverPlan((profil ?? null) as ProfilFuerPlan | null)
  if (plan === 'gesperrt') {
    return NextResponse.json({ error: 'Der Betrieb hat aktuell keinen gültigen Zugang — sprich mit dem Inhaber.' }, { status: 403 })
  }
  const { count: aktive, error: aErr } = await service
    .from('betrieb_mitglieder')
    .select('id', { count: 'exact', head: true })
    .eq('inhaber_id', zeile.inhaber_id as string)
    .eq('status', 'aktiv')
  if (aErr) {
    console.error('[team/annehmen] aktive Mitglieder:', aErr.message)
    return NextResponse.json({ error: 'Die Einladung ist gerade nicht abrufbar.' }, { status: 500 })
  }
  if (plaetzeFrei(plan, aktive ?? 0, 0).voll) {
    return NextResponse.json({ error: TEAM_TEXTE.voll(PLAN_LABELS[plan as Plan] ?? plan) }, { status: 403 })
  }

  // `.eq('status', 'eingeladen')` bleibt in der Bedingung: Zwei gleichzeitige
  // Klicks auf denselben Link sollen nicht zweimal annehmen.
  const { data: fertig, error: uErr } = await service
    .from('betrieb_mitglieder')
    .update({ user_id: user.id, status: 'aktiv', angenommen_am: new Date().toISOString() })
    .eq('id', zeile.id as string)
    .eq('status', 'eingeladen')
    .select('id')
    .maybeSingle()
  if (uErr) {
    console.error('[team/annehmen] annehmen:', uErr.message)
    return NextResponse.json({ error: 'Die Einladung konnte nicht angenommen werden.' }, { status: 500 })
  }
  if (!fertig) return NextResponse.json({ error: 'Diese Einladung wurde schon angenommen.' }, { status: 409 })

  const name = ((profil?.firma_name ?? '') as string).trim()
  return NextResponse.json({ ok: true, betriebName: name || null })
}
