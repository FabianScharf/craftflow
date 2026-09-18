// Welche Stripe-Ereignisse unser Webhook braucht.
//
// ANLASS (18.09.2026): Die Rechnungsmail hing an `invoice.paid` — einem Ereignis, das
// der Endpunkt in Stripe gar nicht abonniert hatte. Der Code war fertig, der Zweig
// richtig, und trotzdem wäre nie eine Mail verschickt worden: Stripe hätte das
// Ereignis schlicht nie geschickt. Ein Fehler, den man im Code nicht sehen kann.
//
// Deshalb steht die Liste hier als einzige Quelle, und `tests/stripe-ereignisse.test.mjs`
// liest die Webhook-Route und vergleicht: Jeder `event.type === '…'`-Zweig MUSS hier
// stehen. Wer einen Zweig ergänzt und das Abonnement vergisst, bekommt einen roten
// Test statt eines Automatismus, der stumm nichts tut.
//
// Eintragen allein genügt nicht — die Liste muss auch an Stripe übertragen werden:
// Einstellungen → Admin → „Stripe prüfen“ (oder POST /api/admin/stripe-einrichtung).

export const WEBHOOK_EREIGNISSE = [
  /** Kauf abgeschlossen → Plan, Kundennummer und abo_status in die Datenbank. */
  'checkout.session.completed',
  /** Plan gewechselt, gekündigt, Zahlung offen → abo_status nachführen. */
  'customer.subscription.updated',
  /** Abo endgültig beendet → abo_status auf 'beendet'. */
  'customer.subscription.deleted',
  /** Abbuchung erfolgreich → Rechnungsmail in CraftFlow-Gestaltung mit PDF im Anhang. */
  'invoice.paid',
] as const

export type WebhookEreignis = typeof WEBHOOK_EREIGNISSE[number]

/** Welche Ereignisse am Endpunkt fehlen. Leer = alles abonniert. */
export function fehlendeEreignisse(abonniert: readonly string[]): string[] {
  // '*' abonniert alles — dann fehlt nichts.
  if (abonniert.includes('*')) return []
  return WEBHOOK_EREIGNISSE.filter(e => !abonniert.includes(e))
}

/** Die Liste, die an Stripe geschickt wird: Bestehendes bleibt, Fehlendes kommt dazu. */
export function ergaenzeEreignisse(abonniert: readonly string[]): string[] {
  if (abonniert.includes('*')) return [...abonniert]
  return [...new Set([...abonniert, ...WEBHOOK_EREIGNISSE])]
}
