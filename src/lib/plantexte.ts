// Texte der 402-Sperrantworten (planpruefung.ts) — als reine Funktion ausgelagert,
// damit sie ohne Supabase/NextResponse testbar sind (tests/plantexte.test.mjs).
// Importiert bewusst nur aus ./plaene.

import { PLAN_LABELS, PLAN_REIHE, PLAN_RANK, mindestPlan, deckel, type Plan, type Funktion, type DeckelArt } from './plaene.ts'

export type Sperrgrund = 'testphase' | 'gutschein'

/** Antwortkörper für die 402-Sperre — dieselbe Form für beide Gründe, nur der Text ändert sich. */
export function zugangAblehnung(grund: Sperrgrund): { error: string; minPlan: Plan } {
  const texte: Record<Sperrgrund, string> = {
    testphase: 'Deine Testphase ist abgelaufen. Wähle einen Plan, um weiterzuarbeiten.',
    gutschein: 'Dein Gutschein ist abgelaufen. Wähle einen Plan, um weiterzuarbeiten.',
  }
  return { error: texte[grund], minPlan: 'solo' }
}

// Ab hier: 403-Antworten für gesperrte Funktionen bzw. erreichte Deckel
// (planpruefung.ts → pruefeFunktion/pruefeDeckel).

const FUNKTION_NAME: Record<Funktion, string> = {
  spracheingabe: 'Die Spracheingabe', pdf: 'Das PDF-Angebot', assistent: 'Der Hilfe-Assistent',
  dateien: 'Der Datei-Upload', export: 'Der Kalkulationsexport', kalibrierung: 'Die Betriebskalibrierung',
  bauweise: 'Die Bauweise-Lernfunktion', materialpreise: 'Die Materialpreise', gestaltung: 'Die Gestaltung des Angebots',
  lieferanten: 'Die Lieferantenverwaltung', bloecke: 'Die Analyse großer Projekte in Blöcken',
  lernschleife: 'Die Lernschleife', auswertung: 'Die Auswertung', smtp: 'Der Versand über die eigene E-Mail',
  ausschreibung: 'Der Ausschreibungs-Modus', internetsuche: 'Die Händlersuche im Internet', gaeb: 'Der GAEB-Import',
}
const DECKEL_NAME: Record<DeckelArt, [string, string]> = {
  angebote: ['Angebot pro Monat', 'Angebote pro Monat'],
  optimierenRunden: ['Optimieren-Runde je Angebot', 'Optimieren-Runden je Angebot'],
  dateien: ['Datei je Projekt', 'Dateien je Projekt'],
  bauweiseRegeln: ['Bauweise-Regel', 'Bauweise-Regeln'],
  materialpreise: ['Materialpreis', 'Materialpreise'],
  nutzer: ['Nutzer', 'Nutzer'],
}

/** 403-Antwortkörper: gesperrte Funktion, nennt den Plan, ab dem sie freigeschaltet ist. */
export function ablehnung(f: Funktion): { error: string; minPlan: Plan } {
  const minPlan = mindestPlan(f)
  return { error: `${FUNKTION_NAME[f]} ist ab dem ${PLAN_LABELS[minPlan]}-Plan verfügbar.`, minPlan }
}

/** Nächster Plan in der Reihe, der von `art` mehr erlaubt als `plan` (null = kein solcher Plan). */
function naechsterPlanMitMehr(art: DeckelArt, plan: Plan): Plan | null {
  const aktuell = deckel(plan, art)
  return PLAN_REIHE.find(p => PLAN_RANK[p] > PLAN_RANK[plan] && (deckel(p, art) === null || (aktuell !== null && (deckel(p, art) as number) > aktuell))) ?? null
}

/** 403-Antwortkörper: Deckel erreicht, nennt die Zahl im aktuellen Plan und ggf. den nächsten Plan mit mehr. */
export function deckelAblehnung(art: DeckelArt, plan: Plan, grenze: number): { error: string; minPlan: Plan | null } {
  const [einzahl, mehrzahl] = DECKEL_NAME[art]
  const naechster = naechsterPlanMitMehr(art, plan)
  const kopf = grenze === 0
    ? `Im ${PLAN_LABELS[plan]}-Plan ist kein ${art === 'dateien' ? 'Datei-Upload' : einzahl} möglich.`
    : `Im ${PLAN_LABELS[plan]}-Plan sind ${grenze} ${grenze === 1 ? einzahl : mehrzahl} möglich.`
  if (!naechster) return { error: kopf, minPlan: null }
  const d = deckel(naechster, art)
  const rest = d === null ? 'unbegrenzt' : `${d} ${d === 1 ? einzahl : mehrzahl}`
  return { error: `${kopf} Ab dem ${PLAN_LABELS[naechster]}-Plan ${rest}.`, minPlan: naechster }
}
