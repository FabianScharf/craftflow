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
// 'gesperrt' = Testphase vorbei, kein aktives Abo, kein gültiger Nicht-Solo-Plan.
// Kein Funktion, kein Deckel — s. erlaubt()/deckel() unten.
export type EffektiverPlan = Plan | 'gesperrt'
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

export function erlaubt(plan: EffektiverPlan, f: Funktion): boolean {
  if (plan === 'gesperrt') return false
  return PLAENE[plan].funktionen.includes(f)
}

export function mindestPlan(f: Funktion): Plan {
  return PLAN_REIHE.find(p => erlaubt(p, f)) ?? 'enterprise'
}

export function deckel(plan: EffektiverPlan, art: DeckelArt): number | null {
  if (plan === 'gesperrt') return 0
  return PLAENE[plan].deckel[art]
}

/**
 * Nächster Plan in der Reihe, der von `art` mehr erlaubt als `plan` (null = kein
 * solcher Plan). Für die Anzeige: "Inaktiv durch Plan — ab {…} wieder aktiv" in den
 * Deckel-Listen (Bauweise, Materialpreise) und für die 403-Texte (plantexte.ts).
 */
export function naechsterPlanMitMehr(art: DeckelArt, plan: Plan): Plan | null {
  const aktuell = deckel(plan, art)
  // `aktuell === null` heißt: der Plan ist bei dieser Deckel-Art schon unbegrenzt —
  // dann kann kein höherer Plan noch mehr geben, egal was dessen Deckel zeigt.
  if (aktuell === null) return null
  return PLAN_REIHE.find(p => PLAN_RANK[p] > PLAN_RANK[plan] && (deckel(p, art) === null || (deckel(p, art) as number) > aktuell)) ?? null
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

export type ProfilFuerPlan = {
  plan?: string | null
  trial_starts_at?: string | null
  /** Von Stripe gesetzt: 'aktiv' | 'beendet' | null (nie bezahlt / Gutschein/Admin). */
  abo_status?: string | null
  /** Ablauf eines Gutschein-/Admin-Plans. null = unbefristet. */
  plan_gueltig_bis?: string | null
}

/** null/undefined = unbefristet gültig (auch bei einem kaputten Datum — defensiv, wie überall sonst). */
function nochGueltig(bis: string | null | undefined, jetzt: Date): boolean {
  if (!bis) return true
  const t = new Date(bis).getTime()
  if (!Number.isFinite(t)) return true
  return t > jetzt.getTime()
}

/**
 * Reihenfolge (Controller, 16.09.; Regel 2 korrigiert Fix-Runde 2):
 * 1. Testphase läuft → Enterprise.
 * 2. Aktives Stripe-Abo → gespeicherter Plan, UNBEDINGT (keine Datumsprüfung).
 * 3. Kein BEENDETES Abo, gespeicherter Plan ≠ Solo (Gutschein/Admin) UND gültig → dieser Plan.
 * 4. Sonst → 'gesperrt' (kein Funktion, kein Deckel).
 *
 * Schritt 2 prüft `plan_gueltig_bis` bewusst NICHT: Dieses Feld setzt ausschließlich
 * `redeem_coupon` (Gutschein-Ablauf) und der Stripe-Webhook löscht es nie. Wer erst
 * einen Gutschein hatte und danach ein echtes Abo kauft, würde sonst nach Ablauf des
 * alten Gutschein-Datums still auf 'solo' zurückgestuft — obwohl das Abo läuft und
 * bezahlt ist (Critical aus dem Review, Fix-Runde 2). Ein aktives Abo zählt immer.
 *
 * "Kein beendetes Abo" in Schritt 3 ist entscheidend: Ein früher bezahlter, dann
 * gekündigter Plan bleibt in der DB stehen (Fabians Regel: Plan nicht zurücksetzen),
 * darf nach dem Ende des Abos aber nicht länger zählen — sonst wäre die Kündigung
 * wirkungslos. Nur ein Plan OHNE Abo-Historie (abo_status null, z. B. Gutschein
 * oder Admin-Vergabe) durchläuft die Datumsprüfung in Schritt 3.
 */
export function effektiverPlan(
  profil: ProfilFuerPlan | null | undefined,
  jetzt: Date = new Date(),
): EffektiverPlan {
  const start = profil?.trial_starts_at ? new Date(profil.trial_starts_at).getTime() : NaN
  if (Number.isFinite(start) && jetzt.getTime() < start + TRIAL_DAYS * 86400_000) return 'enterprise'

  const gespeicherterPlan: Plan = istPlan(profil?.plan) ? profil!.plan as Plan : 'solo'

  if (profil?.abo_status === 'aktiv') {
    return gespeicherterPlan
  }
  if (profil?.abo_status !== 'beendet' && gespeicherterPlan !== 'solo' && nochGueltig(profil?.plan_gueltig_bis, jetzt)) {
    return gespeicherterPlan
  }
  return 'gesperrt'
}

/**
 * Grund der Sperre — für die Paywall-Texte (plantexte.ts). 'gutschein' nur, wenn
 * erkennbar ein befristeter Nicht-Solo-Plan abgelaufen ist (und kein aktives Abo
 * vorliegt) — sonst 'testphase' als allgemeiner Fall. null = nicht gesperrt.
 */
export function sperrgrund(
  profil: ProfilFuerPlan | null | undefined,
  jetzt: Date = new Date(),
): 'testphase' | 'gutschein' | null {
  if (effektiverPlan(profil, jetzt) !== 'gesperrt') return null
  const gespeicherterPlan: Plan = istPlan(profil?.plan) ? profil!.plan as Plan : 'solo'
  // Ein BEENDETES Abo ist immer 'testphase', nie 'gutschein' — auch wenn zufällig
  // noch ein abgelaufenes plan_gueltig_bis aus einer früheren Gutschein-Zeit in der
  // DB steht (M8, Fix-Runde 16.09.). Sonst hätte ein gekündigter Nutzer, der vorher
  // mal einen Gutschein eingelöst hatte, die falsche (irreführende) Paywall-Meldung
  // gesehen — "Gutschein abgelaufen" statt "Testphase/Abo beendet".
  const abgelaufenerGutschein = gespeicherterPlan !== 'solo'
    && profil?.abo_status !== 'aktiv'
    && profil?.abo_status !== 'beendet'
    && !nochGueltig(profil?.plan_gueltig_bis, jetzt)
  return abgelaufenerGutschein ? 'gutschein' : 'testphase'
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
