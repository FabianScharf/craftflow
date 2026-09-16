// Texte der 402-Sperrantworten (planpruefung.ts) — als reine Funktion ausgelagert,
// damit sie ohne Supabase/NextResponse testbar sind (tests/plantexte.test.mjs).
// Importiert bewusst nur aus ./plaene.

import { PLAN_LABELS, mindestPlan, deckel, naechsterPlanMitMehr, type Plan, type Funktion, type DeckelArt } from './plaene.ts'

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
  ausschreibung: 'Der Ausschreibungs-Modus', internetsuche: 'Die Händlersuche im Internet',
  // Die Funktion 'gaeb' deckt BEIDE Richtungen ab — der Export prueft sie seit dem
  // 2026-09-17 ebenfalls. Der alte Text nannte nur den Import (Audit, Minor).
  gaeb: 'Der GAEB-Import und -Export',
}
const DECKEL_NAME: Record<DeckelArt, [string, string]> = {
  angebote: ['Angebot pro Monat', 'Angebote pro Monat'],
  optimierenRunden: ['Optimieren-Runde je Angebot', 'Optimieren-Runden je Angebot'],
  dateien: ['Datei je Projekt', 'Dateien je Projekt'],
  bauweiseRegeln: ['Bauweise-Regel', 'Bauweise-Regeln'],
  materialpreise: ['Materialpreis', 'Materialpreise'],
  nutzer: ['Nutzer', 'Nutzer'],
  wunschStimmen: ['Stimme für Wünsche', 'Stimmen für Wünsche'],
}

/** 403-Antwortkörper: gesperrte Funktion, nennt den Plan, ab dem sie freigeschaltet ist. */
export function ablehnung(f: Funktion): { error: string; minPlan: Plan } {
  const minPlan = mindestPlan(f)
  return { error: `${FUNKTION_NAME[f]} ist ab dem ${PLAN_LABELS[minPlan]}-Plan verfügbar.`, minPlan }
}

/** 403-Antwortkörper: Deckel erreicht, nennt die Zahl im aktuellen Plan und ggf. den nächsten Plan mit mehr. */
export function deckelAblehnung(art: DeckelArt, plan: Plan, grenze: number): { error: string; minPlan: Plan | null } {
  const [einzahl, mehrzahl] = DECKEL_NAME[art]
  const naechster = naechsterPlanMitMehr(art, plan)
  const kopf = grenze === 0
    ? `Im ${PLAN_LABELS[plan]}-Plan ist kein ${art === 'dateien' ? 'Datei-Upload' : einzahl} möglich.`
    : grenze === 1
      ? `Im ${PLAN_LABELS[plan]}-Plan ist ${grenze} ${einzahl} möglich.`
      : `Im ${PLAN_LABELS[plan]}-Plan sind ${grenze} ${mehrzahl} möglich.`
  if (!naechster) return { error: kopf, minPlan: null }
  const d = deckel(naechster, art)
  const rest = d === null ? 'unbegrenzt' : `${d} ${d === 1 ? einzahl : mehrzahl}`
  return { error: `${kopf} Ab dem ${PLAN_LABELS[naechster]}-Plan ${rest}.`, minPlan: naechster }
}

/**
 * 403-Antwortkörper: Das Stimmenbudget des Plans ist aufgebraucht.
 * Eigener Text statt deckelAblehnung, weil hier ein AUSWEG dazugehört — eine Stimme
 * zurücknehmen kostet nichts und ist meistens das, was der Nutzer will.
 */
export function stimmenAblehnung(plan: Plan): { error: string; minPlan: Plan | null } {
  const n = deckel(plan, 'wunschStimmen') ?? 0
  // Minor (Live-Test W6, Controller-Review 16.09.): "Du hast alle 1 Stimmen ..."
  // ist falsches Deutsch — trifft ausgerechnet den Solo-Plan mit Budget 1, also die
  // häufigste Ablehnung überhaupt. Einzahlform wie in deckelAblehnung.
  const satz = n === 1
    ? `Du hast deine ${n} Stimme deines Plans vergeben.`
    : `Du hast alle ${n} Stimmen deines Plans vergeben.`
  return {
    error: `${satz} Nimm eine zurück oder wechsle den Plan.`,
    minPlan: naechsterPlanMitMehr('wunschStimmen', plan),
  }
}

/**
 * 403-Antwortkörper für die Blockanalyse. Eigener Satz statt ablehnung('bloecke'),
 * weil der Nutzer hier nicht „eine Funktion“ vermisst, sondern gerade ein großes
 * Projekt hochgeladen hat. Der Plan-Name kommt aus der Matrix — wandert die Funktion
 * einmal in einen anderen Plan, wandert der Text mit.
 */
export function bloeckeAblehnung(): { error: string; minPlan: Plan } {
  const minPlan = mindestPlan('bloecke')
  return { error: `Große Projekte in Blöcken sind ab dem ${PLAN_LABELS[minPlan]}-Plan möglich.`, minPlan }
}
