// Den passenden Umsatzsteuersatz aus einer Stripe-Liste auswaehlen.
//
// ANLASS (2026-09-15): Der Checkout uebergab nur Preis und Menge — ohne Steuer. Stripe
// haette exakt 49 EUR eingezogen und keine USt ausgewiesen; der Nettopreis waere
// faktisch brutto gewesen. CraftFlow verkauft nur an Unternehmen: Nettopreis, 19 %
// obendrauf, ausgewiesen auf der Rechnung. Fabian hat Weg 1 gewaehlt (fester Satz).
//
// Reine Funktion ohne Importe — `npm run test` fuehrt sie direkt aus.

export const UST_PROZENT = 19
export const UST_NAME = 'Umsatzsteuer'

export type SteuersatzKandidat = {
  id: string
  active: boolean
  inclusive: boolean
  percentage: number
  display_name?: string | null
  country?: string | null
}

/**
 * Der Satz muss aktiv sein, 19 % haben und AUFSCHLAGEND sein (inclusive = false) —
 * ein inklusiver Satz wuerde die 19 % aus dem Preis herausrechnen statt aufzuschlagen.
 * Bevorzugt wird der von CraftFlow angelegte Satz (Name + Land DE), sonst irgendein
 * passender. Nichts Passendes → null, dann legt der Aufrufer einen an.
 */
export function waehleSteuersatz(kandidaten: SteuersatzKandidat[]): string | null {
  const passend = kandidaten.filter(k => k.active && !k.inclusive && k.percentage === UST_PROZENT)
  const eigener = passend.find(k => k.display_name === UST_NAME && (k.country ?? 'DE') === 'DE')
  return (eigener ?? passend[0])?.id ?? null
}
