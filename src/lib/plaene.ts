// DIE Quelle für Pläne, Deckel und Funktionen. Alles andere liest hier.
//
// ANLASS (2026-09-15): Nach dem Sommer-Update hatte jeder Plan alle Funktionen, nur die
// Angebote je Monat waren gedeckelt — und die standen an drei Stellen im Code. Der
// Stripe-Webhook kannte zudem nur den alten Preis-Satz: ein Kauf über die
// Einstellungen (neuer Satz) wäre auf Solo gelandet.
//
// Reine Daten und Funktionen ohne Importe — `npm run test` führt sie direkt aus.
// Die Zahlen sind Fabians Preisliste (Spec 2026-09-15, Abschnitt 3). Wer sie ändert,
// ändert tests/plaene.test.mjs mit — bewusst, nicht nebenbei.

export type Plan = 'solo' | 'starter' | 'pro' | 'enterprise'
export const PLAN_REIHE: Plan[] = ['solo', 'starter', 'pro', 'enterprise']
export const PLAN_RANK: Record<Plan, number> = { solo: 1, starter: 2, pro: 3, enterprise: 4 }
export const PLAN_LABELS: Record<Plan, string> = { solo: 'Solo', starter: 'Starter', pro: 'Pro', enterprise: 'Enterprise' }
export const TRIAL_DAYS = 14

export type Funktion =
  | 'spracheingabe' | 'pdf' | 'assistent'          // jeder Plan
  | 'dateien' | 'export' | 'kalibrierung' | 'bauweise' | 'materialpreise' | 'gestaltung' | 'lieferanten'  // ab Starter
  | 'bloecke' | 'lernschleife' | 'auswertung' | 'smtp'   // ab Pro
  | 'ausschreibung' | 'internetsuche' | 'gaeb'          // Enterprise

export type DeckelArt = 'angebote' | 'optimierenRunden' | 'dateien' | 'bauweiseRegeln' | 'materialpreise' | 'nutzer'

export type PlanDefinition = {
  preisNetto: number
  untertitel: string
  deckel: Record<DeckelArt, number | null>   // null = unbegrenzt
  funktionen: Funktion[]
}

const BASIS: Funktion[] = ['spracheingabe', 'pdf', 'assistent']
const STARTER: Funktion[] = [...BASIS, 'dateien', 'export', 'kalibrierung', 'bauweise', 'materialpreise', 'gestaltung', 'lieferanten']
const PRO: Funktion[] = [...STARTER, 'bloecke', 'lernschleife', 'auswertung', 'smtp']
const ENTERPRISE: Funktion[] = [...PRO, 'ausschreibung', 'internetsuche', 'gaeb']

export const PLAENE: Record<Plan, PlanDefinition> = {
  solo: {
    preisNetto: 7, untertitel: 'Für Einzelkämpfer',
    deckel: { angebote: 3, optimierenRunden: 5, dateien: 0, bauweiseRegeln: 0, materialpreise: 0, nutzer: 1 },
    funktionen: BASIS,
  },
  starter: {
    preisNetto: 29, untertitel: 'Für kleine Betriebe',
    deckel: { angebote: 15, optimierenRunden: 10, dateien: 5, bauweiseRegeln: 5, materialpreise: 20, nutzer: 1 },
    funktionen: STARTER,
  },
  pro: {
    preisNetto: 49, untertitel: 'Mein eigener Kalkulator',
    deckel: { angebote: 50, optimierenRunden: 20, dateien: 25, bauweiseRegeln: null, materialpreise: null, nutzer: 3 },
    funktionen: PRO,
  },
  enterprise: {
    preisNetto: 79, untertitel: 'Ausschreibungen und große Betriebe',
    deckel: { angebote: 150, optimierenRunden: 40, dateien: 60, bauweiseRegeln: null, materialpreise: null, nutzer: null },
    funktionen: ENTERPRISE,
  },
}

/** Aktueller Preis-Satz in Stripe (Einstellungen → „Mein Plan"). */
export const PREIS_IDS: Record<Plan, string> = {
  solo: 'price_1Tn1xzRvozvhvO9JJ3og0R3w',
  starter: 'price_1Tn1y0RvozvhvO9JK7pRRRht',
  pro: 'price_1Tn1y0RvozvhvO9J4QXMCzje',
  enterprise: 'price_1Tn1y1RvozvhvO9JYlX8lp4z',
}
/** Älterer Satz — noch gültig in Stripe, könnte in laufenden Abos stecken. */
const PREIS_IDS_ALT: Record<string, Plan> = {
  price_1TmSblRvozvhvO9J3EKljmMh: 'solo',
  price_1TmScDRvozvhvO9J9tvsywrG: 'starter',
  price_1TmScSRvozvhvO9J0RF42acJ: 'pro',
  price_1TmSchRvozvhvO9JOduoM8KU: 'enterprise',
}

export function planFuerPreisId(priceId: string): Plan | null {
  for (const p of PLAN_REIHE) if (PREIS_IDS[p] === priceId) return p
  return PREIS_IDS_ALT[priceId] ?? null
}

export function istPlan(v: unknown): v is Plan {
  return typeof v === 'string' && (PLAN_REIHE as string[]).includes(v)
}

export function erlaubt(plan: Plan, f: Funktion): boolean {
  return PLAENE[plan].funktionen.includes(f)
}

export function mindestPlan(f: Funktion): Plan {
  return PLAN_REIHE.find(p => erlaubt(p, f)) ?? 'enterprise'
}

export function deckel(plan: Plan, art: DeckelArt): number | null {
  return PLAENE[plan].deckel[art]
}

/**
 * Regel beim Wechsel nach unten (Fabian, 15.09.): Die ältesten N bleiben aktiv, alle
 * weiteren werden inaktiv gestellt. Nichts wird gelöscht. Wird BEIM LESEN angewandt —
 * ein Upgrade wirkt sofort, ohne Skript. Reihenfolge der Eingabe bleibt erhalten.
 */
export function wendeDeckelAn<T extends { created_at: string }>(
  eintraege: T[], grenze: number | null,
): Array<T & { aktivDurchPlan: boolean }> {
  if (grenze === null) return eintraege.map(e => ({ ...e, aktivDurchPlan: true }))
  const erlaubte = new Set(
    [...eintraege].sort((a, b) => a.created_at.localeCompare(b.created_at)).slice(0, Math.max(0, grenze)),
  )
  return eintraege.map(e => ({ ...e, aktivDurchPlan: erlaubte.has(e) }))
}

/** Testphase = Enterprise (exakte Zeitgrenze wie in /api/usage), sonst gespeicherter Plan, sonst Solo. */
export function effektiverPlan(
  profil: { plan?: string | null; trial_starts_at?: string | null } | null | undefined,
  jetzt: Date = new Date(),
): Plan {
  const start = profil?.trial_starts_at ? new Date(profil.trial_starts_at).getTime() : NaN
  if (Number.isFinite(start) && jetzt.getTime() < start + TRIAL_DAYS * 86400_000) return 'enterprise'
  return istPlan(profil?.plan) ? profil!.plan as Plan : 'solo'
}

/** Sätze für Plan-Kacheln (App) und Preistabelle (Website) — eine Wortwahl für beide. */
export function merkmaleFuerAnzeige(plan: Plan): string[] {
  const d = PLAENE[plan].deckel
  const z = (n: number | null, einzahl: string, mehrzahl: string) =>
    n === null ? `${mehrzahl} unbegrenzt` : `${n} ${n === 1 ? einzahl : mehrzahl}`
  const zeilen: string[] = [
    plan === 'enterprise' ? `Fair Use: ${d.angebote} Angebote pro Monat` : `${d.angebote} Angebote pro Monat`,
    `${d.optimierenRunden} Optimieren-Runden je Angebot`,
    d.dateien === 0 ? 'Ohne Datei-Upload' : `${d.dateien} Dateien je Projekt (Fotos, PDFs)`,
    'Spracheingabe, KI-Kalkulation, PDF-Angebot, Hilfe-Assistent',
  ]
  if (erlaubt(plan, 'bloecke')) zeilen.push('Große Projekte in Blöcken')
  if (erlaubt(plan, 'ausschreibung')) zeilen.push('Ausschreibungs-Modus (GAEB, Stapel)')
  if (erlaubt(plan, 'kalibrierung')) zeilen.push('Betriebskalibrierung')
  if (erlaubt(plan, 'bauweise')) zeilen.push(z(d.bauweiseRegeln, 'Bauweise-Regel', 'Bauweise-Regeln'))
  if (erlaubt(plan, 'lernschleife')) zeilen.push('Lernschleife aus gewonnenen Angeboten')
  if (erlaubt(plan, 'materialpreise')) zeilen.push(z(d.materialpreise, 'Materialpreis', 'Materialpreise'))
  zeilen.push(erlaubt(plan, 'gestaltung') ? 'Textbausteine, Briefpapier, Schriftwahl, CI-Farben' : 'Standardlayout fürs Angebot')
  if (erlaubt(plan, 'lieferanten')) zeilen.push(erlaubt(plan, 'internetsuche') ? 'Lieferanten und Anfragen, mit Internet-Suche' : 'Lieferanten und Anfragen')
  if (erlaubt(plan, 'auswertung')) zeilen.push('Auswertung')
  if (erlaubt(plan, 'smtp')) zeilen.push('Eigener Mailversand (SMTP)')
  zeilen.push(z(d.nutzer, 'Nutzer', 'Nutzer'))
  return zeilen
}
