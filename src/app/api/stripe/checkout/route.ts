import { NextRequest, NextResponse } from 'next/server'
import { stripe, umsatzsteuerSatzId } from '@/lib/stripe'
import { createClient } from '@/utils/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const { priceId } = await req.json() as { priceId: string }
  if (!priceId) return NextResponse.json({ error: 'priceId erforderlich' }, { status: 400 })

  const origin = req.headers.get('origin') ?? 'https://app.getcraftflow.de'

  // Nettopreis + 19 % USt, auf der Rechnung ausgewiesen (Fabian, 15.09.: Weg 1, fester
  // Satz). Ohne tax_rates zoege Stripe den Nettopreis als Endbetrag ein.
  const steuersatz = await umsatzsteuerSatzId()

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1, tax_rates: [steuersatz] }],
    customer_email: user.email,
    allow_promotion_codes: true,
    billing_address_collection: 'required',
    // Unternehmen koennen ihre USt-IdNr. angeben — sie erscheint auf der Rechnung.
    tax_id_collection: { enabled: true },
    success_url: `${origin}/settings?stripe=success`,
    cancel_url: `${origin}/settings?stripe=cancelled`,
    metadata: { userId: user.id },
    subscription_data: {
      metadata: { userId: user.id },
    },
  })

  return NextResponse.json({ url: session.url })
}
