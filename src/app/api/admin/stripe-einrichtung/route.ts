// Stripe-Einrichtung prüfen und in Ordnung bringen — Einstellungen → Admin.
//
// ANLASS (Fabian, 18.09.2026): „Wie bekommen wir das in den Stripe-Automatismus?“
// Die Rechnungsmail hängt am Ereignis `invoice.paid`. Ein Webhook-Endpunkt schickt
// aber nur, was er abonniert hat — der Code allein genügt nicht.
//
// Was hier geht und was nicht:
//   ✅ Webhook-Abonnement lesen und ergänzen (Stripe-Schnittstelle kann das)
//   ✅ Branding und Steuernummer LESEN, um zu melden, was fehlt
//   ❌ Branding, Logo und die Kunden-Mail-Schalter SETZEN — die liegen ausschließlich
//      im Dashboard. Deshalb meldet GET sie als Aufgabe, statt sie stumm zu übergehen.
//
// Gleiche Bauart wie die anderen Admin-Routen: E-Mail des Logins entscheidet.

import { NextRequest, NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { createClient } from '@/utils/supabase/server'
import { ADMIN_EMAIL } from '@/lib/admin'
import { stripe } from '@/lib/stripe'
import { WEBHOOK_EREIGNISSE, fehlendeEreignisse, ergaenzeEreignisse } from '@/lib/stripe-ereignisse'

async function wache() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user || user.email !== ADMIN_EMAIL) return null
  return user
}

type EndpunktStand = {
  id: string
  url: string
  status: string
  abonniert: number
  fehlend: string[]
}

/** Alle Webhook-Endpunkte mit ihrem Abonnement-Stand. */
async function endpunkte(): Promise<EndpunktStand[]> {
  const liste = await stripe.webhookEndpoints.list({ limit: 30 })
  return liste.data.map(e => ({
    id: e.id,
    url: e.url,
    status: e.status ?? 'unbekannt',
    abonniert: e.enabled_events?.length ?? 0,
    fehlend: fehlendeEreignisse(e.enabled_events ?? []),
  }))
}

export async function GET() {
  if (!await wache()) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  try {
    const eps = await endpunkte()

    // Branding und Steuernummer nur lesen — setzen geht hier nicht.
    // Ohne ID liefert Stripe das eigene Konto — die Typen der Bibliothek kennen
    // diese Kurzform nicht, die Schnittstelle schon.
    const konto = await (stripe.accounts.retrieve as unknown as () => Promise<Stripe.Account>)()
    const branding = konto.settings?.branding
    const offeneAufgaben: string[] = []
    if (!branding?.logo && !branding?.icon) {
      offeneAufgaben.push('Logo im Dashboard hinterlegen (Einstellungen → Branding) — sonst trägt das Rechnungs-PDF kein CraftFlow-Zeichen.')
    }
    if (!branding?.primary_color) {
      offeneAufgaben.push('Akzentfarbe im Dashboard setzen (Einstellungen → Branding), CraftFlow-Kupfer #C8885A.')
    }
    const steuerId = (konto as unknown as { company?: { tax_id?: string | null } }).company?.tax_id
    if (!steuerId) {
      offeneAufgaben.push('USt-IdNr. DE459348681 in den Unternehmensangaben eintragen — § 14 UStG verlangt sie auf jeder Rechnung.')
    }
    offeneAufgaben.push('Die Stripe-eigenen Rechnungsmails AUS lassen (Einstellungen → E-Mails von Kund/innen) — CraftFlow verschickt sie selbst.')

    return NextResponse.json({
      noetigeEreignisse: WEBHOOK_EREIGNISSE,
      endpunkte: eps,
      allesAbonniert: eps.every(e => e.fehlend.length === 0),
      branding: {
        logo: Boolean(branding?.logo || branding?.icon),
        farbe: branding?.primary_color ?? null,
        steuerId: steuerId ?? null,
      },
      offeneAufgaben,
    })
  } catch (e) {
    console.error('[stripe-einrichtung] lesen:', e)
    return NextResponse.json({ error: 'Stripe antwortet gerade nicht.' }, { status: 502 })
  }
}

/** Ergänzt die fehlenden Ereignisse an allen Endpunkten. Bestehendes bleibt unangetastet. */
export async function POST(req: NextRequest) {
  if (!await wache()) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  try {
    const eps = await endpunkte()
    const zuTun = eps.filter(e => e.fehlend.length > 0)
    if (zuTun.length === 0) {
      return NextResponse.json({ geaendert: [], meldung: 'Alle Ereignisse waren bereits abonniert.' })
    }

    const geaendert: Array<{ url: string; ergaenzt: string[] }> = []
    for (const e of zuTun) {
      const aktuell = await stripe.webhookEndpoints.retrieve(e.id)
      const neu = ergaenzeEreignisse(aktuell.enabled_events ?? []) as Stripe.WebhookEndpointUpdateParams.EnabledEvent[]
      await stripe.webhookEndpoints.update(e.id, { enabled_events: neu })
      geaendert.push({ url: e.url, ergaenzt: e.fehlend })
      console.log('[stripe-einrichtung] ergänzt an', e.url, '→', e.fehlend.join(', '))
    }
    return NextResponse.json({
      geaendert,
      meldung: `${geaendert.length} Endpunkt(e) ergänzt. Ab jetzt meldet Stripe auch bezahlte Rechnungen.`,
    })
  } catch (e) {
    console.error('[stripe-einrichtung] schreiben:', e)
    return NextResponse.json({ error: 'Die Ereignisse ließen sich nicht ergänzen.' }, { status: 502 })
  }
}
