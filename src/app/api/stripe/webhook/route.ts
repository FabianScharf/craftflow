import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { getSupabaseClient } from '@/lib/supabase'
import Stripe from 'stripe'

const PRICE_PLAN: Record<string, string> = {
  'price_1TmSblRvozvhvO9J3EKljmMh': 'solo',
  'price_1TmScDRvozvhvO9J9tvsywrG': 'starter',
  'price_1TmScSRvozvhvO9J0RF42acJ': 'pro',
  'price_1TmSchRvozvhvO9JOduoM8KU': 'enterprise',
}

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
      const plan = PRICE_PLAN[sub.items.data[0]?.price.id] ?? 'solo'
      await db.from('betriebsprofil')
        .update({ stripe_customer_id: session.customer as string, plan })
        .eq('user_id', userId)
    }
  }

  if (event.type === 'customer.subscription.updated') {
    const sub = event.data.object as Stripe.Subscription
    const userId = sub.metadata?.userId
    if (userId) {
      const plan = PRICE_PLAN[sub.items.data[0]?.price.id] ?? 'solo'
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
