// Bucht die Arbeit abgeschalteter Kostenstellen auf Handarbeit um, statt sie zu
// streichen. Importiert bewusst NICHTS.
//
// Vorher: az = az.filter(a => !deaktiviert.has(a.kostenstelle)) — die Arbeit war weg.
// Wer CNC abschaltet, verlor die Stunden fuer die Griffmulden. Das Angebot wurde zu
// billig, die Arbeit fiel trotzdem an. Genau die Beschwerde "hat laenger gedauert als
// kalkuliert", die Fabian aus der Praxis kennt.
//
// Handarbeit ist NICHT billiger: Kantenanleimen von Hand 1,5-2 h zu 65 EUR/h gegen
// 1 h zu 100 EUR/h an der Maschine. Wer nur den Satz tauscht, ohne die Zeit zu
// verlaengern, erzeugt wieder zu billige Angebote.

export type Zeitzeile = { kostenstelle: string; minuten: number; vkStunde?: number }

// Wohin die Arbeit wandert, wenn die Maschine fehlt.
export const HANDARBEIT_ZIEL: Record<string, string> = {
  CNC: 'Zusammenbau',
  Bekantung: 'Zusammenbau',
  'Oberfläche': 'Zusammenbau',
  Zuschnitt: 'Zusammenbau',
}
// Ohne Maschine dauert dieselbe Arbeit laenger.
export const HANDARBEIT_ZUSCHLAG = 1.6
const RUECKFALL = 'Zusammenbau'

export function bucheUm<T extends Zeitzeile>(
  zeilen: T[], deaktiviert: Set<string>, saetze: Record<string, number>,
  normalisiere: (s: string) => string = (s) => s,
): T[] {
  if (!Array.isArray(zeilen) || zeilen.length === 0 || deaktiviert.size === 0) return zeilen
  const behalten: T[] = []
  const nachZiel = new Map<string, number>()

  for (const z of zeilen) {
    if (!deaktiviert.has(normalisiere(z.kostenstelle))) { behalten.push(z); continue }
    const ziel = HANDARBEIT_ZIEL[z.kostenstelle] ?? RUECKFALL
    const minuten = Math.round(z.minuten * HANDARBEIT_ZUSCHLAG)
    nachZiel.set(ziel, (nachZiel.get(ziel) ?? 0) + minuten)
  }
  if (nachZiel.size === 0) return behalten

  for (const [zielRoh, minuten] of nachZiel) {
    // Ist auch das Ziel abgeschaltet, nimm die erste verbliebene Zeile — verloren
    // gehen darf nichts, das ist der ganze Sinn dieser Funktion.
    const ziel = deaktiviert.has(normalisiere(zielRoh))
      ? (behalten[0]?.kostenstelle ?? zielRoh)
      : zielRoh
    const vorhanden = behalten.find(z => z.kostenstelle === ziel)
    if (vorhanden) vorhanden.minuten += minuten
    else behalten.push({ kostenstelle: ziel, minuten, vkStunde: saetze[ziel] ?? 65 } as T)
  }
  return behalten
}
