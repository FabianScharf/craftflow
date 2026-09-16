// Der Preishebel des Betriebs. Reine Daten und Funktionen ohne Importe —
// `npm run test` fuehrt sie direkt aus.
//
// ANLASS (Fabian, 2026-09-16): "Wenn ich feststelle, die Preise sind zu guenstig,
// dann moechte ich das mit Faktoren regeln koennen." Ueber die ZEITfaktoren ging das
// nicht: Sie verfaelschen "Stunden gesamt" und den Plancraft-Export. Der Preisfaktor
// multipliziert deshalb nur den Endpreis der Position — Material und Lohn zusammen —
// und laesst Stunden, Stundensaetze und Aufschlaege unangetastet.
//
// ZWEI REGELN, die hier festgeschrieben sind:
//   1. Der Faktor wird auf die Position GESTEMPELT, wenn sie entsteht. Ein spaeteres
//      Aendern des Faktors veraendert alte Angebote nicht — ein verschicktes Angebot
//      darf sich nicht rueckwirkend veraendern.
//   2. Der Faktor geht NIE in einen KI-Prompt und NIE ins PDF. Er ist reine
//      Nachrechnung; der Kunde sieht nur Endpreise.

export const PREISFAKTOR_MIN = 0.5
export const PREISFAKTOR_MAX = 3
export const PREISFAKTOR_STANDARD = 1

/**
 * Prueft und klemmt einen Wert aus Eingabefeld oder Datenbank.
 * Rueckgabe `null` = gar keine Zahl → die Route antwortet mit 400 und einer Meldung,
 * statt stillschweigend etwas anderes zu speichern.
 */
export function klemmePreisfaktor(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = typeof v === 'number' ? v : Number(String(v).trim())
  if (!Number.isFinite(n)) return null
  const geklemmt = Math.min(PREISFAKTOR_MAX, Math.max(PREISFAKTOR_MIN, n))
  return Math.round(geklemmt * 100) / 100
}

/** Der Faktor einer Position, defensiv gelesen. Unsinn gilt als 1,00. */
export function preisfaktorVon(p: { preisfaktor?: unknown } | null | undefined): number {
  const f = p?.preisfaktor
  return typeof f === 'number' && Number.isFinite(f) && f > 0 ? f : PREISFAKTOR_STANDARD
}

/**
 * Stempelt den Faktor des Betriebs auf jede Position, die noch keinen traegt.
 * Bestehende Faktoren bleiben stehen (Regel 1 im Dateikopf). Faktor 1,00 wird nicht
 * gestempelt — sonst steht in jedem Angebot ein Feld herum, das nichts bewirkt, und
 * der Versionsvergleich der Lernschleife meldet Aenderungen, die keine sind.
 */
export function stempelPreisfaktor<T extends { preisfaktor?: number }>(
  positionen: T[], faktor: number,
): T[] {
  if (!Array.isArray(positionen)) return []
  const f = typeof faktor === 'number' && Number.isFinite(faktor) && faktor > 0 ? faktor : PREISFAKTOR_STANDARD
  return positionen.map(p => {
    if (typeof p?.preisfaktor === 'number' && Number.isFinite(p.preisfaktor) && p.preisfaktor > 0) return p
    if (f === PREISFAKTOR_STANDARD) return p
    return { ...p, preisfaktor: f }
  })
}

/**
 * Entfernt einen Preisfaktor, den die KI selbst in ihre Antwort geschrieben hat —
 * BEVOR der Betrieb seinen eigenen stempelt (I-6, Controller-Review 2026-09-16).
 *
 * Nur fuer /api/analyze und /api/analyze/block gedacht: dort entstehen Positionen
 * frisch aus der KI-Antwort, ein "vorhandener" Faktor kann dort also nur erfunden
 * sein. stempelPreisfaktor liesse einen vorhandenen Wert bewusst stehen (Regel 1
 * oben) — das ist beim Optimieren richtig (der Faktor stammt dann vom Nutzer/vom
 * Betrieb selbst), waere hier aber eine ungeprüfte KI-Zahl mit direkter
 * Preiswirkung: schreibt das Modell "preisfaktor": 3, verdreifacht sich der Preis,
 * ohne dass irgendeine Pruefung greift.
 */
export function verwirfKiPreisfaktor(positionen: unknown[]): Record<string, unknown>[] {
  if (!Array.isArray(positionen)) return []
  return positionen.map(p => {
    if (!p || typeof p !== 'object') return p as Record<string, unknown>
    const { preisfaktor: _weg, ...rest } = p as Record<string, unknown>
    return rest
  })
}

/**
 * Was in der Kalkulationsuebersicht stehen soll.
 * `null` = nichts anzeigen (alle Positionen rechnen mit 1,00), `'gemischt'` = die
 * Positionen tragen verschiedene Faktoren (kommt vor, wenn ein Betrieb seinen Faktor
 * zwischen zwei Optimieren-Runden aendert). Eine einzelne Zahl waere dann gelogen.
 */
export function angezeigterPreisfaktor(
  positionen: Array<{ preisfaktor?: number }>,
): number | 'gemischt' | null {
  const werte = (positionen ?? []).map(p => preisfaktorVon(p as { preisfaktor?: unknown }))
  if (werte.length === 0) return null
  const einzig = new Set(werte)
  if (einzig.size > 1) return 'gemischt'
  const [nur] = [...einzig]
  return nur === PREISFAKTOR_STANDARD ? null : nur
}
