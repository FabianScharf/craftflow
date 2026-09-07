// Deckelt Arbeitszeiten auf das, was der Prompt selbst vorschreibt.
//
// Importiert bewusst NICHTS — wie lernwerkzeuge.ts und chatantwort.ts, sonst sind
// die Tests ohne Bundler nicht ausfuehrbar.
//
// GEMESSEN am 2026-09-06, Referenzschrank 2,00 x 2,40 x 0,60 m Dekor:
//
//   Pflichtrechnung im Prompt : 2 lfm x 4,5 h = 540 min, plus Beschlaege ~690 min
//   CraftFlow tatsaechlich    : Zuschnitt 420 + Zusammenbau 930 = 1.350 min
//   Verhaeltnis               : 1,96x
//
// Ursache: Die Selbstpruefungs-Checkliste im Prompt nennt nur UNTERGRENZEN
// ("mind. lfm x 270 min"). Der KI wird gesagt, wie wenig es sein darf, nie wie viel.
// Sie schiesst deshalb auf der sicheren Seite ueber. Die vorhandene
// Plausibilitaetspruefung schlaegt erst beim VIERFACHEN an und korrigiert nichts.
//
// Diese Deckelung greift deterministisch nach der KI-Antwort — dieselbe Haltung wie
// bei `vkStunde` und `aufschlag`: den KI-Zahlen wird nicht vertraut.

export type Zeitzeile = { kostenstelle: string; minuten: number }

// Nur diese beiden fallen unter die Pflichtrechnung "Werkstattzeit = lfm x 4,5 h,
// aufgeteilt 40/60". Bekantung und Oberflaeche haben eigene Formeln, die nicht an
// den Laufmetern haengen — sie bleiben unangetastet.
const WERKSTATT_KS = ['Zuschnitt', 'Zusammenbau']

// Deckel auf die Basis. Der Aufschlag deckt ab, was der Prompt oben drauf rechnet:
// Beschlaege (Tuer +20 min, Schublade +30 min ...). Massivholz bekommt mehr Luft,
// weil dort zusaetzlich der Holzart-Faktor (bis x1,4) und das Verleimen dazukommen.
const DECKEL_DEKOR = 1.5
const DECKEL_MASSIV = 2.0

// Montage-Richtwerte je lfm aus der Wissensbasis: Neubau 1,5-2,5 h, Altbau 2,5-4,0 h.
// Gedeckelt wird auf die jeweilige Obergrenze.
const MONTAGE_DECKEL_NEUBAU = 150
const MONTAGE_DECKEL_ALTBAU = 240

export const ALTBAU_RE = /altbau|schiefe?[ns]? w[äa]nd|nicht im lot|dielenboden|ohne aufzug|bestandsgeb/i

export function werkstattDeckel(lfm: number, massiv: boolean): number {
  const basis = lfm * (massiv ? 5 : 4.5) * 60
  return basis * (massiv ? DECKEL_MASSIV : DECKEL_DEKOR)
}

export function montageDeckel(lfm: number, altbau: boolean): number {
  return lfm * (altbau ? MONTAGE_DECKEL_ALTBAU : MONTAGE_DECKEL_NEUBAU)
}

/**
 * Kappt Zuschnitt+Zusammenbau und Montage auf ihre Obergrenzen.
 * Wird gekappt, sinken die betroffenen Zeilen ANTEILIG — die Aufteilung, die die
 * KI gewaehlt hat, bleibt also erhalten, nur die Summe stimmt wieder.
 * Ohne Laufmeter (lfm <= 0) passiert nichts: Fuer Moebel ohne Laufmeter gibt es
 * noch keine belastbare Pruefgrundlage.
 */
/**
 * Kappt eine Gruppe von Kostenstellen auf eine Obergrenze — anteilig, damit die
 * Aufteilung erhalten bleibt und nur die Summe wieder stimmt.
 * Gibt die Zeilen unveraendert zurueck, wenn nichts zu kappen ist.
 */
export function kappeGruppe(
  zeilen: Zeitzeile[], kostenstellen: string[], deckel: number, name: string,
): { zeilen: Zeitzeile[]; hinweis: string | null } {
  if (!(deckel > 0)) return { zeilen, hinweis: null }
  const summe = zeilen.filter(z => kostenstellen.includes(z.kostenstelle))
    .reduce((s, z) => s + z.minuten, 0)
  if (summe <= deckel || summe <= 0) return { zeilen, hinweis: null }
  const anteil = deckel / summe
  return {
    zeilen: zeilen.map(z => kostenstellen.includes(z.kostenstelle)
      ? { ...z, minuten: Math.round(z.minuten * anteil) } : z),
    hinweis: `${name} von ${Math.round(summe / 6) / 10} h auf ${Math.round(deckel / 6) / 10} h gekappt.`,
  }
}

/**
 * Fuer Moebel OHNE Laufmeter: Deckel aus der Stueckliste. Der Aufrufer bringt den
 * Wert mit, weil die Stuecklisten-Rechnung in src/lib/stueckliste.ts liegt.
 */
export function kappeOhneLaufmeter(
  zeilen: Zeitzeile[], werkstattDeckel: number,
): { zeilen: Zeitzeile[]; hinweise: string[] } {
  const r = kappeGruppe(zeilen, WERKSTATT_KS, werkstattDeckel, 'Werkstattzeit (nach Stückliste)')
  return { zeilen: r.zeilen, hinweise: r.hinweis ? [r.hinweis] : [] }
}

export function kappeZeiten(
  zeilen: Zeitzeile[],
  lfm: number,
  massiv: boolean,
  altbau: boolean,
): { zeilen: Zeitzeile[]; hinweise: string[] } {
  if (!(lfm > 0) || zeilen.length === 0) return { zeilen, hinweise: [] }
  const hinweise: string[] = []
  let ergebnis = zeilen

  const kappe = (ks: string[], deckel: number, name: string) => {
    const summe = ergebnis.filter(z => ks.includes(z.kostenstelle)).reduce((s, z) => s + z.minuten, 0)
    if (summe <= deckel || summe <= 0) return
    const anteil = deckel / summe
    ergebnis = ergebnis.map(z =>
      ks.includes(z.kostenstelle) ? { ...z, minuten: Math.round(z.minuten * anteil) } : z)
    hinweise.push(
      `${name} von ${Math.round(summe / 6) / 10} h auf ${Math.round(deckel / 6) / 10} h gekappt `
      + `(Richtwert für ${lfm.toFixed(1)} lfm).`)
  }

  kappe(WERKSTATT_KS, werkstattDeckel(lfm, massiv), 'Werkstattzeit')
  kappe(['Montage'], montageDeckel(lfm, altbau), 'Montagezeit')
  return { zeilen: ergebnis, hinweise }
}
