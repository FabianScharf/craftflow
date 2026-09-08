// Plausibilitaetsgrundlage fuer Moebel OHNE Laufmeter.
// Importiert bewusst NICHTS.
//
// WARUM ES DAS BRAUCHT: Die Laufmeter-Pruefung greift nur bei Schraenken. Ein
// Rollcontainer, ein Tisch, ein Sideboard haben keine sinnvollen Laufmeter — dort
// war `lm` null, und weder Untergrenze noch Deckelung griffen. Der Rollcontainer vom
// 2026-09-06 lief mit 8,8 h durch, ungeprueft.
//
// WIE DIE FORMEL ENTSTAND: Nicht geraten, sondern an zwei wirklich gemessenen
// Kalkulationen geeicht (beide nach dem Laufmeter-Fix):
//
//   Referenzschrank 16,1 m², 4 Drehtueren, 2 Schubkaesten, 8 Einlegeboeden
//     gemessen: Zuschnitt 216 + Zusammenbau 479 = 695 min
//     Formel  : 216 + 523 = 739 min   (Abweichung 6 %)
//
//   Rollcontainer 1,64 m², 3 Schubkaesten
//     gemessen: Zuschnitt 48 + Zusammenbau 168 = 216 min
//     Formel  : 35 + 199 = 234 min    (Abweichung 8 %)
//
// Die Zeitanteile stammen aus Fabians Richtwerten: Korpus zusammenbauen 30-60 min,
// Rueckwand einsetzen 15-25 min, Systemschublade 20-35 min plus Front 10-20 min,
// Drehtuer haengen 15-25 min, Einlegeboden mit Bohrungen 10-20 min.

export type Teile = {
  drehtueren: number
  schiebetueren: number
  klappen: number
  schubladen: number
  einlegeboeden: number
}

export const KEINE_TEILE: Teile = {
  drehtueren: 0, schiebetueren: 0, klappen: 0, schubladen: 0, einlegeboeden: 0,
}

// Grundzeit je Korpus, unabhaengig von der Groesse: aufstellen, ausrichten,
// Rueckwand einsetzen.
const KORPUS_GRUNDZEIT = 45
// Ruestzeit am Saegewerk, faellt auch beim kleinsten Teil an.
const ZUSCHNITT_RUESTZEIT = 15
const ZUSCHNITT_JE_M2 = 12.5
const ZUSAMMENBAU_JE_M2 = 11.7

const JE_STUECK = {
  drehtueren: 20,
  schiebetueren: 45,
  klappen: 35,
  // Systemschubkasten 30 min plus Front ansetzen und justieren 15 min.
  schubladen: 45,
  einlegeboeden: 15,
}

export function zaehleTeile(text: string): Teile {
  const t = text ?? ''
  const n = (re: RegExp) => {
    let summe = 0
    for (const m of t.matchAll(re)) summe += parseInt(m[1], 10) || 0
    return summe
  }
  const schiebe = n(/(\d+)\s*schiebet[üu]r/gi)
  const dreh    = n(/(\d+)\s*dreht[üu]r/gi)
  const klapp   = n(/(\d+)\s*klapp/gi)
  const schub   = n(/(\d+)\s*(?:schublade|schubkasten|schubkaesten|schubkästen|auszug|aus[züu]ge)/gi)
  const boeden  = n(/(\d+)\s*(?:einlegeb[öo]den|einlegeboden|fachb[öo]den|fachboden)/gi)
  // "4 Türen" ohne naehere Angabe sind Drehtueren — aber nur, wenn keine
  // Schiebetueren oder Klappen genannt wurden, sonst zaehlt man doppelt.
  const allgemein = n(/(\d+)\s*t[üu]r(?:en)?\b/gi)
  const drehtueren = dreh > 0 ? dreh : (schiebe === 0 && klapp === 0 ? allgemein : 0)
  return { drehtueren, schiebetueren: schiebe, klappen: klapp, schubladen: schub, einlegeboeden: boeden }
}

/** Summe der Materialzeilen, die in Quadratmetern gefuehrt werden. */
export function plattenflaeche(
  material: Array<{ einheit?: string; menge?: number }> | undefined,
): number {
  let m2 = 0
  for (const m of material ?? []) {
    const e = String(m.einheit ?? '').toLowerCase().replace('²', '2')
    if (e === 'm2') m2 += Number(m.menge) || 0
  }
  return m2
}

/**
 * Erwartete Zeit fuer Zuschnitt und Zusammenbau, in Minuten.
 * Ohne Plattenflaeche gibt es keine Grundlage — dann 0, und der Aufrufer prueft nicht.
 */
export function erwarteteWerkstattzeit(m2: number, teile: Teile): number {
  if (!(m2 > 0)) return 0
  const zuschnitt = ZUSCHNITT_RUESTZEIT + ZUSCHNITT_JE_M2 * m2
  const beschlaege =
      teile.drehtueren    * JE_STUECK.drehtueren
    + teile.schiebetueren * JE_STUECK.schiebetueren
    + teile.klappen       * JE_STUECK.klappen
    + teile.schubladen    * JE_STUECK.schubladen
    + teile.einlegeboeden * JE_STUECK.einlegeboeden
  const zusammenbau = KORPUS_GRUNDZEIT + ZUSAMMENBAU_JE_M2 * m2 + beschlaege
  return Math.round(zuschnitt + zusammenbau)
}

// Diese Schaetzung ist groeber als die Laufmeter-Rechnung — sie kennt weder
// Massivholz noch Sonderausstattung. Das Band ist deshalb bewusst weit: Es soll
// Ausreisser um Faktor zwei abfangen, nicht die Kalkulation feinsteuern.
export const UNTERGRENZE = 0.5
export const OBERGRENZE = 2.0

export function deckelNachStueckliste(m2: number, teile: Teile): number {
  const erwartet = erwarteteWerkstattzeit(m2, teile)
  return erwartet > 0 ? Math.round(erwartet * OBERGRENZE) : 0
}
