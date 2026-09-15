import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { getSupabaseClient } from '@/lib/supabase'
import { planFuerPreisId } from '@/lib/plaene'
import Stripe from 'stripe'

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
      await db.from('betriebsprofil')
        .update({ stripe_customer_id: session.customer as string, plan })
        .eq('user_id', userId)
    }
  }

  if (event.type === 'customer.subscription.updated') {
    const sub = event.data.object as Stripe.Subscription
    const userId = sub.metadata?.userId
    if (userId) {
      const priceId = sub.items.data[0]?.price.id ?? ''
      const plan = planFuerPreisId(priceId)
      if (!plan) {
        // Unbekannter Preis: NICHT still auf Solo — das war der Fehler vom 15.09.
        console.error('[stripe] unbekannte Preis-ID im Abo:', priceId, 'user', userId)
        return NextResponse.json({ received: true, warnung: 'unbekannte Preis-ID' })
      }
      await db.from('betriebsprofil').update({ plan }).eq('user_id', userId)
    }
  }

  if (event.type === 'customer.subscription.deleted') {
    const sub = event.data.object as Stripe.Subscription
    const userId = sub.metadata?.userId
    if (userId) {
      await db.from('betriebsprofil').update({ plan: 'solo' }).eq('user_id', userId)
    }
  }

  return NextResponse.json({ received: true })
}
