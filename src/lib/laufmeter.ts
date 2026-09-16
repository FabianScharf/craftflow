// Erkennt die Laufmeter eines Möbels aus dem Beschreibungstext.
//
// Importiert bewusst NICHTS — wie lernwerkzeuge.ts, sonst laufen die Tests nicht.
//
// WARUM DAS EIN EIGENES MODUL IST (gemessen 2026-09-07):
//
// Die alte Regex sammelte JEDE Zahl mit Meter-Einheit und addierte sie:
//
//   "2,00 m breit x 2,40 m hoch x 0,60 m tief"  ->  2,00 + 2,40 + 0,60 = 5,00 lfm
//
// Aus diesen 5 statt 2 Laufmetern baute `analyze` eine Mindest-Werkstattzeit von
// lm x 4,5 h = 1.350 min und skalierte Zuschnitt und Zusammenbau darauf HOCH.
// Zwei unabhängige Messungen am selben Referenzschrank ergaben exakt 1.350 min —
// die Zahl kam also nicht von der KI, sondern aus dieser Untergrenze.
// Ergebnis: 3.042 EUR netto fuer einen 2-lfm-Dekorschrank, gegen eine Faustregel
// von 1.200-2.000 EUR. Das ist die Ursache der "utopischen Preise".
//
// Verwandter Vorfall 2026-07-04: Damals wurden m² als Meter gezaehlt, Preise bis
// zum Sechsfachen. Dieselbe Familie von Fehlern.
//
// VORFALL 2026-09-16 — TAUSENDERPUNKT IN mm-MASSKETTEN:
// Deutsche Leistungsverzeichnisse schreiben Millimeter mit Tausenderpunkt:
// "2.400 x 2.650 x 600 mm". `zahl('2.400')` gab 2,4 (parseFloat behandelt den
// Punkt als Dezimaltrennzeichen), und der mm-Teiler 1000 machte daraus 0,0024 m.
// Jede Beschreibung mit einer solchen Masskette bekam dadurch praktisch 0 lfm —
// und `kappeZeiten` deckelte die Werkstattzeit der Position auf nahe 0 Stunden.
// Fix: Ein Punkt gefolgt von GENAU DREI Ziffern vor einer mm/cm-Einheit ist ein
// Tausendertrenner, kein Komma-Ersatz — siehe `TAUSENDER_RE`.

export const MAX_PLAUSIBLE_LM = 25

// (?![\w²³]) schliesst m², m³ und mm aus — nur blanke m/lm/lfm zaehlen als Laufmeter.
const MASS_RE = /(\d+(?:[,.]\d+)?)\s*(?:lfm|lm|m)(?![\w²³])/gi

// Was direkt hinter dem Mass steht und es als Hoehe oder Tiefe ausweist.
const HOEHE_TIEFE_RE = /^[\s,.:-]*(?:hoch|hoh|h[öo]he|tief|tiefe|dick|stark)/i

// Explizite Breitenangabe schlaegt alles andere.
const BREITE_RE = /(\d+(?:[,.]\d+)?)\s*(?:lfm|lm|m)(?![\w²³])[\s,.:-]*(?:breit|breite)/i
const BREITE_CM_RE = /(\d{2,4})\s*cm[\s,.:-]*(?:breit|breite|gesamt)/i

// Masskette "2000 x 2400 x 600 mm" oder "2,00 x 2,40 x 0,60 m" — die ERSTE Zahl ist
// die Breite. Ohne diese Regel bliebe von der mm-Schreibweise nur die Tiefe uebrig,
// weil das Mass nur einmal am Ende steht.
const KETTE_RE = /(\d+(?:[,.]\d+)?)\s*[x×]\s*(\d+(?:[,.]\d+)?)\s*[x×]\s*(\d+(?:[,.]\d+)?)\s*(mm|cm|m)\b/i

const zahl = (s: string) => parseFloat(s.replace(',', '.'))
const deckel = (n: number) => Math.min(Math.max(n, 0), MAX_PLAUSIBLE_LM)

// Punkt gefolgt von genau drei Ziffern (keine weiteren Nachkommastellen) ist ein
// Tausendertrenner: "2.400" = zweitausendvierhundert. "2.40" (zwei Ziffern) bleibt
// eine Dezimalzahl. Nur relevant vor mm/cm — bei "m" bräuchte niemand eine
// vierstellige Zahl vor dem Komma.
const TAUSENDER_RE = /^\d{1,3}(?:\.\d{3})+$/

function zahlMitEinheit(s: string, mmOderCm: boolean): number {
  if (mmOderCm && TAUSENDER_RE.test(s)) return parseFloat(s.replace(/\./g, ''))
  return zahl(s)
}

export function parseLaufmeter(text: string): number {
  const t = text ?? ''

  // 1. "2,00 m breit" — eindeutiger geht es nicht.
  const breit = t.match(BREITE_RE)
  if (breit) return deckel(zahl(breit[1]))
  const breitCm = t.match(BREITE_CM_RE)
  if (breitCm) return deckel(zahl(breitCm[1]) / 100)

  // 2. Masskette: erste Zahl ist die Breite, Einheit steht am Ende.
  const kette = t.match(KETTE_RE)
  if (kette) {
    const einheit = kette[4].toLowerCase()
    const teiler = einheit === 'mm' ? 1000 : einheit === 'cm' ? 100 : 1
    return deckel(zahlMitEinheit(kette[1], einheit === 'mm' || einheit === 'cm') / teiler)
  }

  // 3. Sonst alle Meter-Angaben summieren — mehrere Schraenke nebeneinander sind
  //    ein echter Fall ("Schrank 2,40 m und Sideboard 1,80 m"). Hoehe und Tiefe
  //    werden dabei uebersprungen; genau ihr Mitzaehlen war der Fehler.
  let summe = 0
  for (const m of t.matchAll(MASS_RE)) {
    const danach = t.slice((m.index ?? 0) + m[0].length, (m.index ?? 0) + m[0].length + 14)
    if (HOEHE_TIEFE_RE.test(danach)) continue
    summe += zahl(m[1])
  }
  if (summe > 0) return deckel(summe)

  const cm = t.match(/(\d{2,4})\s*cm\s*(?:breit|breite|gesamt)/i)
  if (cm) return deckel(zahl(cm[1]) / 100)

  return 0
}
