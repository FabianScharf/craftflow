// Rechnungsmail nach jeder erfolgreichen Abbuchung — in CraftFlow-Gestaltung,
// mit dem Rechnungs-PDF von Stripe im Anhang (Fabian, 18.09.2026).
//
// WARUM NICHT DIE STRIPE-MAIL: Stripe verschickt in seinem eigenen Layout; gestalten
// lassen sich dort nur Logo und eine Akzentfarbe. Diese Mail trägt dieselbe Handschrift
// wie Willkommens- und Tag-3-Mail. Das PDF selbst kommt weiter von Stripe — dort
// entstehen die fortlaufenden Rechnungsnummern, und das soll auch so bleiben.
//
// ⚠️ Die Stripe-eigenen Rechnungsmails müssen im Dashboard AUS sein, solange diese
// hier läuft (Einstellungen → E-Mails von Kund/innen), sonst kommt alles doppelt.

import type Stripe from 'stripe'
import { stripe } from '@/lib/stripe'
import { getSupabaseClient } from '@/lib/supabase'
import { PLAN_LABELS, planFuerPreisId } from '@/lib/plaene'
import { rechnungsMail } from './vorlagen'
import { sendeMail, type Anhang } from './resend'

/** Merker in den Stripe-Metadaten: verhindert eine zweite Mail bei Wiederholungen. */
const MERKER = 'craftflow_mail_am'

/**
 * Lohnt sich eine Mail für diese Rechnung? Rein, damit die Entscheidung prüfbar bleibt.
 * Nein bei Nullbeträgen (Gutschein, 100-%-Rabatt) und bei allem, was schon eine Mail hat.
 */
export function verdientMail(rg: { amount_paid?: number | null; metadata?: Record<string, string> | null }): boolean {
  if ((rg.amount_paid ?? 0) <= 0) return false
  return !rg.metadata?.[MERKER]
}

/** PDF von Stripe holen und als Base64 zurückgeben. Fehler sind kein Grund, die Mail zu lassen. */
async function ladePdf(url: string | null | undefined, nummer: string): Promise<Anhang | null> {
  if (!url) return null
  try {
    const res = await fetch(url)
    if (!res.ok) { console.error('[rechnung] PDF nicht ladbar:', res.status); return null }
    const puffer = Buffer.from(await res.arrayBuffer())
    return { dateiname: `CraftFlow-Rechnung-${nummer}.pdf`, inhalt: puffer.toString('base64') }
  } catch (e) {
    console.error('[rechnung] PDF-Download:', e instanceof Error ? e.message : e)
    return null
  }
}

/** Anzeigename des Plans aus der ersten Rechnungszeile — leer, wenn nicht ermittelbar. */
function planName(rg: Stripe.Invoice): string {
  // Stripe hat den Ort der Preis-ID zwischen API-Fassungen verschoben. Beide Wege
  // prüfen ist billiger als eine Mail ohne Plan-Angabe.
  const zeile = rg.lines?.data?.[0] as unknown as {
    price?: { id?: string }
    pricing?: { price_details?: { price?: string } }
  } | undefined
  const preisId = zeile?.price?.id ?? zeile?.pricing?.price_details?.price ?? ''
  const plan = preisId ? planFuerPreisId(preisId) : null
  return plan ? PLAN_LABELS[plan] : ''
}

/**
 * Schickt die Rechnungsmail. Wirft nie — ein Fehler hier darf den Webhook nicht
 * scheitern lassen, sonst wiederholt Stripe das Ereignis endlos.
 */
export async function sendeRechnungsmail(rg: Stripe.Invoice): Promise<void> {
  try {
    if (!verdientMail(rg)) return

    const an = rg.customer_email
    if (!an) { console.error('[rechnung] keine Empfängeradresse, Rechnung', rg.id); return }

    const nummer = rg.number ?? rg.id ?? ''
    const zeile = rg.lines?.data?.[0]

    // Steuer aus der Differenz statt aus einem Feld: `tax` und `total_taxes` haben
    // zwischen den API-Fassungen die Plätze getauscht. Bei aufschlagender Steuer
    // (so ist der Satz angelegt) ist die Differenz immer der Steuerbetrag.
    const netto = rg.subtotal ?? 0
    const gesamt = rg.total ?? 0
    const steuer = Math.max(0, gesamt - netto)

    // Firmenname für die Anrede — fehlt er, grüßt die Mail neutral.
    let firma: string | null = null
    if (typeof rg.customer === 'string') {
      const { data } = await getSupabaseClient()
        .from('betriebsprofil').select('firma_name')
        .eq('stripe_customer_id', rg.customer).maybeSingle()
      firma = (data?.firma_name as string | null) ?? null
    }

    const anhang = await ladePdf(rg.invoice_pdf, nummer)

    const mail = rechnungsMail({
      nummer,
      planName: planName(rg),
      nettoCent: netto,
      steuerCent: steuer,
      gesamtCent: gesamt,
      vonSek: zeile?.period?.start ?? null,
      bisSek: zeile?.period?.end ?? null,
      rechnungUrl: rg.hosted_invoice_url ?? null,
      mitAnhang: anhang !== null,
      firma,
    })

    const ergebnis = await sendeMail(an, mail, anhang ? [anhang] : undefined)
    if (!ergebnis.ok) { console.error('[rechnung] Versand:', ergebnis.error); return }

    // Erst nach erfolgreichem Versand stempeln — sonst verhindert ein gescheiterter
    // Versuch für immer die Mail.
    if (rg.id) {
      await stripe.invoices.update(rg.id, {
        metadata: { ...(rg.metadata ?? {}), [MERKER]: new Date().toISOString() },
      })
    }
    console.log('[rechnung] Mail verschickt an', an, '· Rechnung', nummer)
  } catch (e) {
    console.error('[rechnung] unerwartet:', e instanceof Error ? e.message : e)
  }
}
