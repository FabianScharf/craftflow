import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createClient } from '@/utils/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const { data } = await supabase
    .from('betriebsprofil')
    .select('stripe_customer_id')
    .eq('user_id', user.id)
    .single()

  if (!data?.stripe_customer_id) {
    return NextResponse.json({ error: 'Kein Stripe-Konto verknüpft' }, { status: 400 })
  }

  const origin = req.headers.get('origin') ?? 'https://getcraftflow.de'
  const session = await stripe.billingPortal.sessions.create({
    customer: data.stripe_customer_id,
    return_url: `${origin}/settings`,
  })

  return NextResponse.json({ url: session.url })
}
