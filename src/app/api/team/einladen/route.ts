// POST /api/team/einladen  { email }  — Inhaber lädt einen Mitarbeiter ein.
//
// Reihenfolge der Prüfungen ist Absicht: Inhaber → Zugang (Plan) → Adresse →
// Deckel → Zeile → Mail. Jede Ablehnung nennt ihren Grund; eine stumme Ablehnung
// wäre hier besonders teuer, weil der Inhaber sonst auf eine Mail wartet, die
// nie kommt (Lehre „KI-Werkzeuge: stille Fehler").

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { kontoIdFuer, kontoGesperrt } from '@/lib/kontoserver'
import { emailGueltig, normalisiereEmail, plaetzeFrei, TEAM_TEXTE } from '@/lib/team'
import { PLAN_LABELS, type Plan } from '@/lib/plaene'
import { ladeEffektivenPlan, pruefeZugang } from '@/lib/planpruefung'
import { ladeBetriebName, ladeMitglieder, schickeEinladung } from '../gemeinsam'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const konto = await kontoIdFuer(supabase, user)
  const sperre = kontoGesperrt(konto)
  if (sperre) return sperre
  if (!konto.istInhaber) return NextResponse.json({ error: TEAM_TEXTE.nurInhaber }, { status: 403 })
  const kontoId = konto.kontoId

  // Nach der Testphase ohne Abo wird nicht eingeladen. Diese Prüfung zuerst, weil
  // `plaetzeFrei('gesperrt', …)` sonst mit „Dein Plan …" antworten würde — und für
  // 'gesperrt' gibt es kein Plan-Label.
  const zu = await pruefeZugang(supabase, kontoId)
  if (zu) return zu

  const body = await req.json().catch(() => ({})) as { email?: string }
  if (!emailGueltig(body.email ?? '')) {
    return NextResponse.json({ error: 'Bitte eine vollständige E-Mail-Adresse angeben.' }, { status: 400 })
  }
  const email = normalisiereEmail(body.email!)
  if (email === normalisiereEmail(user.email ?? '')) {
    return NextResponse.json({ error: 'Das ist deine eigene Adresse — du bist der Inhaber des Betriebs.' }, { status: 400 })
  }

  const alle = await ladeMitglieder(supabase, kontoId)
  if (!alle) return NextResponse.json({ error: 'Die Teamliste ist gerade nicht abrufbar.' }, { status: 500 })

  const vorhanden = alle.find(m => m.email === email)
  if (vorhanden?.status === 'aktiv') {
    return NextResponse.json({ error: 'Diese Adresse gehört schon zu deinem Team.' }, { status: 409 })
  }
  if (vorhanden?.status === 'eingeladen') {
    return NextResponse.json({ error: 'Diese Adresse ist schon eingeladen. Du kannst die Einladung erneut senden.' }, { status: 409 })
  }

  // Deckel: Inhaber + aktive + offene Einladungen. Offene zählen mit, damit nicht
  // drei Einladungen den Deckel sprengen, sobald alle drei angenommen werden.
  const plan = await ladeEffektivenPlan(supabase, kontoId)
  const aktive = alle.filter(m => m.status === 'aktiv').length
  const offene = alle.filter(m => m.status === 'eingeladen').length
  if (plaetzeFrei(plan, aktive, offene).voll) {
    return NextResponse.json({ error: TEAM_TEXTE.voll(PLAN_LABELS[plan as Plan] ?? plan) }, { status: 403 })
  }

  // Wiedereinladung eines entfernten Mitglieds: dieselbe Zeile, NEUER Token — der
  // alte Link darf nach dem Entfernen nie wieder funktionieren. `user_id` bleibt
  // stehen (Historie); `annehmen` setzt sie ohnehin neu.
  let id: string
  let token: string
  if (vorhanden) {
    const { data, error } = await supabase
      .from('betrieb_mitglieder')
      .update({ status: 'eingeladen', token: crypto.randomUUID(), eingeladen_am: new Date().toISOString(), angenommen_am: null })
      .eq('id', vorhanden.id)
      .eq('inhaber_id', kontoId)
      .select('id, token')
      .single()
    if (error || !data) {
      console.error('[team/einladen] Wiedereinladung:', error?.message)
      return NextResponse.json({ error: 'Die Einladung konnte nicht angelegt werden.' }, { status: 500 })
    }
    id = data.id as string
    token = data.token as string
  } else {
    const { data, error } = await supabase
      .from('betrieb_mitglieder')
      .insert({ inhaber_id: kontoId, email })
      .select('id, token')
      .single()
    if (error || !data) {
      console.error('[team/einladen] Einladung anlegen:', error?.message)
      return NextResponse.json({ error: 'Die Einladung konnte nicht angelegt werden.' }, { status: 500 })
    }
    id = data.id as string
    token = data.token as string
  }

  const versand = await schickeEinladung({
    an: email,
    betriebName: await ladeBetriebName(supabase, kontoId),
    einladerEmail: user.email ?? '',
    token,
  })
  if (!versand.ok) {
    // 502, nicht 500: Die Zeile steht, nur der Versand hat gehakt. Der Inhaber
    // sieht den Grund und kann „Erneut senden" drücken.
    console.error('[team/einladen] Mailversand:', versand.error)
    return NextResponse.json({ error: `Die Einladung ist angelegt, aber die E-Mail ging nicht raus: ${versand.error}`, id }, { status: 502 })
  }

  return NextResponse.json({ ok: true, id })
}
