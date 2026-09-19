// Die Regel, wann die App „Nicht gespeicherte Änderungen" meldet.
//
// Importiert bewusst NICHTS — wie src/lib/learn.ts und src/lib/lernwerkzeuge.ts.
// Die App läuft lokal nicht, deshalb ist `npm run test` der einzige Weg, diese
// Logik überhaupt auszuführen.
//
// Warum es diese Datei gibt: Derselbe Fehler ist zweimal passiert.
//   06.09.2026 — Beim LADEN eines Projekts blieb der Vergleichsstand leer.
//                Zeiten ändern löste keine Warnung aus.
//   19.09.2026 — Dasselbe bei „Manuell eingeben": Wer ein Angebot von Hand
//                anlegte und wegging, verlor alles ohne jeden Hinweis — weder
//                Speicherleiste noch Nachfrage beim Verlassen erschienen.
//
// Die Ursache war beide Male dieselbe: Ein LEERER Vergleichsstand heisst
// „nichts zu vergleichen", und dann meldet sich die App nie. Der Schutz gehört
// deshalb nicht an jeden einzelnen Einstieg ins Angebot — dort wird er
// vergessen —, sondern an eine Stelle, die für jeden Einstieg gilt.

/** Die Bildschirme der App. Am Angebot gearbeitet wird nur auf 'app'. */
export type Bildschirm = 'start' | 'app' | 'pdf' | 'pdf-preview' | 'projekte'

/**
 * Fehlt der Vergleichsstand, obwohl der Nutzer im Angebot steht?
 *
 * Dann muss der aktuelle Stand als Ausgangspunkt gemerkt werden. Ohne ihn kann
 * die App eine spätere Änderung nicht als ungespeichert erkennen.
 *
 * Auf dem Startbildschirm ist ein leerer Vergleichsstand richtig und gewollt:
 * Ein leeres Formular ist nichts, dessen Verlust jemanden stören würde.
 */
export function vergleichsstandFehlt(bildschirm: Bildschirm, gespeicherterStand: string): boolean {
  return bildschirm === 'app' && gespeicherterStand === ''
}

/**
 * Gibt es ungespeicherte Änderungen?
 *
 * Ohne Vergleichsstand lautet die Antwort nein. Damit das nie zur stillen
 * Falle wird, sorgt `vergleichsstandFehlt` dafür, dass im Angebot immer einer
 * da ist.
 */
export function istUngespeichert(gespeicherterStand: string, standJetzt: string): boolean {
  return gespeicherterStand !== '' && standJetzt !== gespeicherterStand
}
