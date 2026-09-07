// Wendet die Zeitfaktoren der Betriebskalibrierung an.
// Importiert bewusst NICHTS.
//
// Der Fixsockel (Besprechung, Planung, Konstruktion, Arbeitsvorbereitung) wird NIE
// veraendert: Er deckt einen Grundaufwand ab, der nicht mit der Betriebsgroesse
// skaliert. Steht so in der Spec, Abschnitt 6.

const WERKSTATT_KS = new Set([
  'Zuschnitt', 'Bekantung', 'CNC', 'Zusammenbau', 'Warenhandling', 'Produktion', 'Verpacken',
])
const OBERFLAECHE_KS = new Set(['Oberfläche'])
const MONTAGE_KS = new Set(['Montage', 'Lieferung'])

export type Zeitzeile = { kostenstelle: string; minuten: number }
export type Faktoren = { werkstatt: number; oberflaeche: number; massivholz: number; montage: number }

export const KEINE_FAKTOREN: Faktoren = { werkstatt: 1, oberflaeche: 1, massivholz: 1, montage: 1 }

export function wendeFaktorenAn<T extends Zeitzeile>(
  zeilen: T[], f: Faktoren, massiv: boolean,
): T[] {
  if (!Array.isArray(zeilen) || zeilen.length === 0) return zeilen
  // Der Massivholzfaktor kommt auf Werkstatt und Oberflaeche OBENDRAUF, statt sie zu
  // ersetzen: Er beschreibt den Mehraufwand des Materials, nicht die Geschwindigkeit
  // des Betriebs.
  const massivZuschlag = massiv ? f.massivholz : 1
  return zeilen.map(z => {
    let faktor = 1
    if (WERKSTATT_KS.has(z.kostenstelle))        faktor = f.werkstatt * massivZuschlag
    else if (OBERFLAECHE_KS.has(z.kostenstelle)) faktor = f.oberflaeche * massivZuschlag
    else if (MONTAGE_KS.has(z.kostenstelle))     faktor = f.montage
    if (faktor === 1) return z
    return { ...z, minuten: Math.max(0, Math.round(z.minuten * faktor)) }
  })
}
