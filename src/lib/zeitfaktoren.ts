// Wendet die Zeitfaktoren der Betriebskalibrierung an.
// Importiert bewusst NICHTS.
//
// Der Fixsockel (Besprechung, Planung, Konstruktion, Arbeitsvorbereitung) wird NIE
// veraendert: Er deckt einen Grundaufwand ab, der nicht mit der Betriebsgroesse
// skaliert. Steht so in der Spec, Abschnitt 6.

// UMGEKEHRTE LOGIK, und zwar mit Absicht: Benannt wird, was NICHT skalieren darf.
// Alles andere ist Werkstattzeit und bekommt den Werkstattfaktor.
//
// GEFUNDEN AM 2026-09-07: Vorher war es andersherum — eine Liste der sieben
// Werkstatt-Kostenstellen, alles ausserhalb blieb unangetastet. Damit bekamen
// AZUBI-Stunden und JEDE EIGENE Kostenstelle des Nutzers ("Polieren von Hand",
// "Furnieren") gar keinen Faktor. Wer viel darueber laufen laesst, wurde still
// nicht kalibriert. Eine Aufzaehlung, die vollstaendig sein muss, ist bei frei
// benennbaren Kostenstellen prinzipiell nicht zu halten.
const FIXSOCKEL_KS = new Set([
  'Besprechung', 'Planung', 'Konstruktion', 'Arbeitsvorbereitung',
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
    if (FIXSOCKEL_KS.has(z.kostenstelle))        faktor = 1
    else if (OBERFLAECHE_KS.has(z.kostenstelle)) faktor = f.oberflaeche * massivZuschlag
    else if (MONTAGE_KS.has(z.kostenstelle))     faktor = f.montage
    // Zuschnitt, Bekantung, CNC, Zusammenbau, Warenhandling, Produktion, Verpacken,
    // Azubi — und jede eigene Kostenstelle des Nutzers.
    else                                          faktor = f.werkstatt * massivZuschlag
    if (faktor === 1) return z
    return { ...z, minuten: Math.max(0, Math.round(z.minuten * faktor)) }
  })
}
