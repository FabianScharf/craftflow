import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { getSupabaseClient } from '@/lib/supabase'
import { planFuerPreisId } from '@/lib/plaene'
import Stripe from 'stripe'
import { sendeRechnungsmail } from '@/lib/mail/rechnung'

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature') ?? ''
  const secret = process.env.STRIPE_WEBHOOK_SECRET ?? ''

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, secret)
  } catch {
    return NextResponse.json({ error: 'Webhook-Signatur ungültig' }, { status: 400 })
  }

  const db = getSupabaseClient()

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    const userId = session.metadata?.userId
    if (userId && session.customer && session.subscription) {
      const sub = await stripe.subscriptions.retrieve(session.subscription as string)
      const priceId = sub.items.data[0]?.price.id ?? ''
      const plan = planFuerPreisId(priceId)
      if (!plan) {
        // Unbekannter Preis: NICHT still auf Solo — das war der Fehler vom 15.09.
        console.error('[stripe] unbekannte Preis-ID im Abo:', priceId, 'user', userId)
        return NextResponse.json({ received: true, warnung: 'unbekannte Preis-ID' })
      }
      // abo_status: 'aktiv' — sonst bliebe effektiverPlan() nach der Testphase
      // bei 'gesperrt' stehen, obwohl gerade bezahlt wurde (Aufgabe 0).
      await db.from('betriebsprofil')
        .update({ stripe_customer_id: session.customer as string, plan, abo_status: 'aktiv' })
        .eq('user_id', userId)
    }
  }

  if (event.type === 'customer.subscription.updated') {
    const sub = event.data.object as Stripe.Subscription
    const userId = sub.metadata?.userId
    if (userId) {
      const priceId = sub.items.data[0]?.price.id ?? ''
      const plan = planFuerPreisId(priceId)

      // 'past_due' zählt bewusst noch als aktiv (Aufgabe 0, Controller): eine
      // ausstehende Zahlung soll den Zugang nicht sofort sperren, Stripe versucht
      // in dieser Phase noch selbst abzubuchen.
      //
      // Jeder andere Status (canceled, unpaid, paused, incomplete_expired, …)
      // MUSS abo_status explizit auf 'beendet' setzen (Fix-Runde, 16.09.): Ohne
      // das blieb ein vorher aktives Abo nach Kündigung/Zahlungsausfall auf
      // 'aktiv' stehen — effektiverPlan() hätte den Nutzer nie gesperrt. Der Plan
      // selbst bleibt stehen (Fabians Regel).
      const aboStatus = ['active', 'trialing', 'past_due'].includes(sub.status) ? 'aktiv' : 'beendet'

      // Audit 2026-09-17 (Minor): Bei unbekannter Preis-ID kehrte diese Stelle
      // FRÜHER zurück, bevor abo_status geschrieben war — eine Kündigung auf einem
      // Altpreis wäre auf 'aktiv' stehen geblieben. Jetzt wird der Status immer
      // gesetzt; nur der PLAN bleibt unangetastet, wenn der Preis unbekannt ist
      // (nie still auf Solo — das war der Fehler vom 15.09.). Antwort bleibt 200:
      // Stripe würde einen Fehler sonst endlos wiederholen.
      const update: Record<string, unknown> = { abo_status: aboStatus }
      if (plan) update.plan = plan
      else console.error('[stripe] unbekannte Preis-ID im Abo:', priceId, 'user', userId, '— Plan unverändert')
      await db.from('betriebsprofil').update(update).eq('user_id', userId)
      if (!plan) return NextResponse.json({ received: true, warnung: 'unbekannte Preis-ID' })
    }
  }

  if (event.type === 'customer.subscription.deleted') {
    const sub = event.data.object as Stripe.Subscription
    const userId = sub.metadata?.userId
    if (userId) {
      // Plan bleibt stehen (Fabians Regel) — er zählt ohne aktives Abo ab jetzt
      // nicht mehr (effektiverPlan() prüft abo_status, s. plaene.ts).
      await db.from('betriebsprofil').update({ abo_status: 'beendet' }).eq('user_id', userId)
    }
  }

  // Rechnung bezahlt → Mail in CraftFlow-Gestaltung mit dem PDF im Anhang.
  // Läuft ganz am Ende und wirft nie: Die Datenbank-Arbeit oben ist wichtiger als
  // die Mail, und ein Fehler hier würde Stripe das Ereignis endlos wiederholen lassen.
  if (event.type === 'invoice.paid') {
    await sendeRechnungsmail(event.data.object as Stripe.Invoice)
  }

  return NextResponse.json({ received: true })
}
