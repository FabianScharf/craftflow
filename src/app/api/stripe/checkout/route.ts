import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createClient } from '@/utils/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const { priceId } = await req.json() as { priceId: string }
  if (!priceId) return NextResponse.json({ error: 'priceId erforderlich' }, { status: 400 })

  const origin = req.headers.get('origin') ?? 'https://app.getcraftflow.de'

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    customer_email: user.email,
    allow_promotion_codes: true,
    billing_address_collection: 'required',
    success_url: `${origin}/settings?stripe=success`,
    cancel_url: `${origin}/settings?stripe=cancelled`,
    metadata: { userId: user.id },
    subscription_data: {
      metadata: { userId: user.id },
    },
  })

  return NextResponse.json({ url: session.url })
}
