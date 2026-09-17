import { NextRequest, NextResponse } from 'next/server'
import { stripe, umsatzsteuerSatzId } from '@/lib/stripe'
import { createClient } from '@/utils/supabase/server'
import { kontoIdFuer, kontoGesperrt } from '@/lib/kontoserver'
import { TEAM_TEXTE } from '@/lib/team'
import { planFuerPreisId } from '@/lib/plaene'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })
  const konto = await kontoIdFuer(supabase, user)
  const kontoSperre = kontoGesperrt(konto); if (kontoSperre) return kontoSperre
  // Ein Abo betrifft den ganzen Betrieb — nur der Inhaber darf es buchen (Spec).
  if (!konto.istInhaber) return NextResponse.json({ error: TEAM_TEXTE.nurInhaber }, { status: 403 })
  const kontoId = konto.kontoId

  const { priceId } = await req.json() as { priceId: string }
  if (!priceId) return NextResponse.json({ error: 'priceId erforderlich' }, { status: 400 })

  // Audit 2026-09-17 (I9): Die Preis-Kennung kam ungeprüft aus dem Browser und ging
  // direkt an Stripe. Jeder Preis des Stripe-Kontos war damit buchbar — Alt-Sätze,
  // Testpreise, versehentlich angelegte Beträge. planFuerPreisId kennt beide gültigen
  // Sätze (aktueller und alter) und ist die einzige Quelle dafür.
  const gebuchterPlan = planFuerPreisId(priceId)
  if (!gebuchterPlan) {
    console.error('[stripe] unbekannte Preis-ID im Checkout:', priceId, 'user', user.id)
    return NextResponse.json({ error: 'Dieser Plan ist nicht buchbar. Bitte die Seite neu laden und erneut wählen.' }, { status: 400 })
  }

  const origin = req.headers.get('origin') ?? 'https://app.getcraftflow.de'

  // Audit 2026-09-17 (Minor 13): Ohne try/catch wurde ein Stripe-Fehler zu einer
  // nackten Next.js-500 ohne ein Wort Deutsch.
  try {
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
      metadata: { userId: kontoId },
      subscription_data: {
        metadata: { userId: kontoId },
      },
    })

    return NextResponse.json({ url: session.url })
  } catch (e) {
    console.error('[stripe] Checkout:', e)
    return NextResponse.json({ error: 'Der Bezahlvorgang lässt sich gerade nicht öffnen. Bitte später noch einmal versuchen.' }, { status: 502 })
  }
}
