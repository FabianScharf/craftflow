import Stripe from 'stripe'
import { waehleSteuersatz, UST_NAME, UST_PROZENT } from '@/lib/steuersatz'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

// Je Lambda-Instanz einmal nachschlagen; der Satz aendert sich praktisch nie.
let steuersatzCache: string | null = null

/**
 * ID des Umsatzsteuersatzes (19 %, aufschlagend) — wird bei Bedarf in Stripe angelegt,
 * damit Fabian nichts von Hand im Dashboard tun muss. Siehe src/lib/steuersatz.ts.
 */
export async function umsatzsteuerSatzId(): Promise<string> {
  if (steuersatzCache) return steuersatzCache
  const liste = await stripe.taxRates.list({ active: true, limit: 100 })
  const gefunden = waehleSteuersatz(liste.data)
  if (gefunden) { steuersatzCache = gefunden; return gefunden }
  const neu = await stripe.taxRates.create({
    display_name: UST_NAME,
    percentage: UST_PROZENT,
    inclusive: false,
    country: 'DE',
    description: 'Deutsche Umsatzsteuer, wird auf den Nettopreis aufgeschlagen',
  })
  console.log('[stripe] Steuersatz angelegt:', neu.id)
  steuersatzCache = neu.id
  return neu.id
}
