import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createClient } from '@/utils/supabase/server'
import { kontoIdFuer, kontoGesperrt } from '@/lib/kontoserver'
import { TEAM_TEXTE } from '@/lib/team'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })
  const konto = await kontoIdFuer(supabase, user)
  const kontoSperre = kontoGesperrt(konto); if (kontoSperre) return kontoSperre
  // Die Rechnungsverwaltung des Betriebs-Abos ist Sache des Inhabers (Spec).
  if (!konto.istInhaber) return NextResponse.json({ error: TEAM_TEXTE.nurInhaber }, { status: 403 })
  const kontoId = konto.kontoId

  const { data } = await supabase
    .from('betriebsprofil')
    .select('stripe_customer_id')
    .eq('user_id', kontoId)
    .single()

  if (!data?.stripe_customer_id) {
    return NextResponse.json({ error: 'Kein Stripe-Konto verknüpft' }, { status: 400 })
  }

  const origin = req.headers.get('origin') ?? 'https://getcraftflow.de'
  // Audit 2026-09-17 (Minor 13): Ohne try/catch wurde ein Stripe-Fehler zu einer
  // nackten Next.js-500 ohne ein Wort Deutsch.
  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: data.stripe_customer_id,
      return_url: `${origin}/settings`,
    })
    return NextResponse.json({ url: session.url })
  } catch (e) {
    console.error('[stripe] Portal:', e)
    return NextResponse.json({ error: 'Die Rechnungsverwaltung lässt sich gerade nicht öffnen. Bitte später noch einmal versuchen.' }, { status: 502 })
  }
}
