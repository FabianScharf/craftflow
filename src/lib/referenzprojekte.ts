// Die fuenf Referenzprojekte der Betriebskalibrierung — vollstaendige Kalkulationen,
// von unten aufgebaut.
//
// WARUM ES DIESE DATEI GIBT: Bis hierher entstanden die Referenzmoebel aus einer
// FORMEL (SPECS/baueReferenz in kalibrierung.ts): Faustregelpreis mal Materialanteil,
// die Minuten rueckwaerts daraus. Das ist zirkulaer — die Faustregel setzte den Preis,
// und der Preis belegte dann die Faustregel. Fabian am 2026-09-17: fuenf vollstaendige
// PROJEKTE mit Positionen, Stueckliste und Zeiten; die Faustregel ist nur noch die
// KONTROLLE daneben. Kein Preis in dieser Datei stammt aus einer Faustregel.
//
// WOHER JEDE ZAHL KOMMT: neben jeder Zeile steht die Quelle — "gemessen" fuer die
// Ist-Zahlen des Einbauschranks (Kalkulation vom 2026-09-07 nach dem Laufmeter-Fix)
// oder der Abschnitt aus CLAUDE.md (3 Korpusbau, 4 Oberflaeche, 5 Montage,
// 6 Faustregeln, 7 Materialpreise, 8 Puffer, 9 Qualitaetsstufen).
//
// Importiert NUR aus ./types.ts — kein React, kein Supabase, sonst laeuft
// `npm run test` nicht (Node fuehrt die .ts-Dateien direkt aus).

import type { Angebotsposition, MaterialPosten, ArbeitsPosten } from './types.ts'
import {
  calcAngebotspos, materialkostenGesamt, stundenGesamt,
  materialRabatt, zeitFaktorFuer, stueckzahlVon, normalizeKsId,
} from './types.ts'

export type Variante = 'lack' | 'massiv' | 'montage'

/** Eine Position der Referenz. `variante` gesetzt ⇔ `alternativ: true`. */
export type ReferenzPosition = Angebotsposition & { variante?: Variante }

export type Referenzprojekt = {
  schluessel: 'einbauschrank' | 'kueche' | 'tueren' | 'treppen' | 'solitaer'
  name: string
  kunde: { name: string; strasse: string; ort: string; projekt: string }
  /** Der ausfuehrliche Referenztext aus der Spec, Abschnitt 3 — woertlich. */
  text: string
  positionen: ReferenzPosition[]
  /** Nur KONTROLLE der Grundsumme, nie Quelle eines Preises (CLAUDE.md 6.1). */
  faustregel: { von: number; bis: number; quelle: string }
  fragen: Partial<Record<'grund' | Variante, string>>
  fragenHinweis?: Partial<Record<'grund' | Variante, string>>
  /** Fragen, die OHNE Materialwert gestellt werden ("der Kunde stellt das Material"). */
  ohneMaterial?: Array<'grund' | 'massiv'>
  /** Label je Stueck statt fuer alles zusammen (Innentueren: 5). */
  teiler?: Partial<Record<'grund' | Variante, number>>
}

// Die Standardsaetze der Handwerkskammer. Absichtlich wiederholt statt aus
// kalibrierung.ts importiert — diese Datei bleibt importfrei bis auf types.ts.
// Sie sind nur PLATZHALTER in den Daten; gerechnet wird mit den Saetzen des
// Betriebs (siehe mitSaetzen).
export const STANDARDSAETZE_REFERENZ: Record<string, number> = {
  Besprechung: 65, Planung: 85, Konstruktion: 75, Arbeitsvorbereitung: 75,
  Produktion: 65, Warenhandling: 65, Zuschnitt: 72, Bekantung: 100, CNC: 120,
  'Oberfläche': 72, Zusammenbau: 65, Verpacken: 65, Azubi: 52,
  Montage: 65, Lieferung: 65,
}

/** Standardaufschlag auf Material, 30 % — als BRUCH, so wie MaterialPosten.aufschlag. */
const STANDARDAUFSCHLAG_REFERENZ = 0.30

// ── Bausteine ────────────────────────────────────────────────────────────────

let zeilenId = 0
const m = (bezeichnung: string, menge: number, einheit: string, ekPreis: number): MaterialPosten =>
  ({ id: ++zeilenId, bezeichnung, menge, einheit, ekPreis, aufschlag: STANDARDAUFSCHLAG_REFERENZ })
const z = (kostenstelle: string, minuten: number): ArbeitsPosten =>
  ({ id: ++zeilenId, kostenstelle, minuten, vkStunde: STANDARDSAETZE_REFERENZ[kostenstelle] ?? 65 })

let positionsId = 0
function p(
  titel: string, beschreibung: string,
  material: MaterialPosten[], arbeitszeit: ArbeitsPosten[], stueckzahl = 1,
): ReferenzPosition {
  return { id: ++positionsId, titel, beschreibung, material, arbeitszeit, stueckzahl }
}

// ── Varianten: eine Alternativposition je Frage ──────────────────────────────
//
// Eine Alternativposition beschreibt IMMER das ganze Projekt noch einmal, nicht nur
// den Unterschied. Nur so sind Grundpreis und Alternativpreis vergleichbar, und nur
// so kann die Antwortspanne der Frage aus dem Preis DIESER Position entstehen.
// Der Aufpreis (fuer die Lackfrage) ist dann einfach die Differenz.
//
// Gebaut wird sie aus den Grundpositionen: jede Grundposition durchlaeuft eine
// Wandlung (Material tauschen, Zeiten strecken), danach werden alle zu EINER
// Position zusammengefasst. Die Zusammenfassung rechnet Stueckzahlen und die
// Serienstaffel aus types.ts korrekt ein — waere sie handgeschrieben, liefe sie
// bei der naechsten Aenderung an den Grunddaten stillschweigend auseinander.

type Wandler = (pos: ReferenzPosition) => ReferenzPosition

const hatZeile = (pos: ReferenzPosition, teil: string) =>
  pos.material.some(x => x.bezeichnung.startsWith(teil))

const ohneMaterialzeile = (pos: ReferenzPosition, ...anfang: string[]): ReferenzPosition =>
  ({ ...pos, material: pos.material.filter(x => !anfang.some(a => x.bezeichnung.startsWith(a))) })

const mitMaterialzeile = (pos: ReferenzPosition, ...neu: MaterialPosten[]): ReferenzPosition =>
  ({ ...pos, material: [...pos.material, ...neu] })

/** Tauscht eine Materialzeile gegen eine andere Ware. Die Menge bleibt, wenn keine neue kommt. */
const tauscheMaterial = (
  pos: ReferenzPosition, anfang: string, bezeichnung: string, ekPreis: number, menge?: number,
): ReferenzPosition => ({
  ...pos,
  material: pos.material.map(x =>
    x.bezeichnung.startsWith(anfang)
      ? { ...x, bezeichnung, ekPreis, menge: menge ?? x.menge } : x),
})

/** Streckt oder streicht (Faktor 0) einzelne Kostenstellen. */
const zeitMal = (pos: ReferenzPosition, faktoren: Record<string, number>): ReferenzPosition => ({
  ...pos,
  arbeitszeit: pos.arbeitszeit
    .map(a => (faktoren[a.kostenstelle] === undefined
      ? a : { ...a, minuten: a.minuten * faktoren[a.kostenstelle] }))
    .filter(a => a.minuten > 0),
})

/** Legt Minuten drauf — auf eine vorhandene Zeile oder als neue. */
const zeitPlus = (pos: ReferenzPosition, zusatz: Record<string, number>): ReferenzPosition => {
  let arbeitszeit = pos.arbeitszeit
  for (const [ks, min] of Object.entries(zusatz)) {
    if (min <= 0) continue
    arbeitszeit = arbeitszeit.some(a => a.kostenstelle === ks)
      ? arbeitszeit.map(a => (a.kostenstelle === ks ? { ...a, minuten: a.minuten + min } : a))
      : [...arbeitszeit, z(ks, min)]
  }
  return { ...pos, arbeitszeit }
}

/** Setzt eine vorhandene Zeitzeile auf einen neuen Wert (Oelen → Lackieren). */
const zeitSetzen = (pos: ReferenzPosition, ks: string, minuten: number): ReferenzPosition => ({
  ...pos,
  arbeitszeit: pos.arbeitszeit.map(a => (a.kostenstelle === ks ? { ...a, minuten } : a)),
})

/**
 * Fasst mehrere Positionen zu einer zusammen — mit Stueckzahl und Serienstaffel.
 * Ergebnis hat stueckzahl 1 und denselben Preis wie die Ausgangspositionen.
 */
function fasseZusammen(positionen: ReferenzPosition[]) {
  const mat = new Map<string, { bezeichnung: string; menge: number; einheit: string; ekPreis: number }>()
  const zeit = new Map<string, number>()
  for (const q of positionen) {
    const n = stueckzahlVon(q)
    const materialfaktor = n * (1 - materialRabatt(n))
    for (const x of q.material) {
      const schluessel = `${x.bezeichnung}|${x.einheit}|${x.ekPreis}`
      const e = mat.get(schluessel)
        ?? { bezeichnung: x.bezeichnung, menge: 0, einheit: x.einheit, ekPreis: x.ekPreis }
      e.menge += x.menge * materialfaktor
      mat.set(schluessel, e)
    }
    for (const a of q.arbeitszeit) {
      const f = zeitFaktorFuer(normalizeKsId(a.kostenstelle), n)
      zeit.set(a.kostenstelle, (zeit.get(a.kostenstelle) ?? 0) + a.minuten * f)
    }
  }
  return {
    material: [...mat.values()]
      .map(e => m(e.bezeichnung, Math.round(e.menge * 10000) / 10000, e.einheit, e.ekPreis)),
    arbeitszeit: [...zeit.entries()].map(([ks, min]) => z(ks, Math.round(min))),
  }
}

function variante(
  schluessel: Variante, titel: string, beschreibung: string,
  grund: ReferenzPosition[], wandle: Wandler,
): ReferenzPosition {
  const { material, arbeitszeit } = fasseZusammen(grund.map(wandle))
  return {
    id: ++positionsId, titel, beschreibung, material, arbeitszeit,
    stueckzahl: 1, alternativ: true, variante: schluessel,
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// 1 — EINBAUSCHRANK (die gemessene Referenz)
// ═════════════════════════════════════════════════════════════════════════════
//
// Die Minuten sind die IST-ZAHLEN aus REFERENZ in kalibrierung.ts, unveraendert
// uebernommen. Die Stueckliste ist gegen den gemessenen Material-EK von 409,50 €
// gerechnet: Die Mengen sind so gewaehlt, dass die Summe genau 409,50 € ergibt —
// der gemessene Wert ist der Anker, nicht die Einzelpreise. Die Preise selbst
// stehen unten mit ihrer Quelle.

const schrankGrund: ReferenzPosition[] = [
  p('Einbauschrank Flur, Dekor weiß',
    'Korpus und Fronten Egger Dekorspanplatte 19 mm weiß (U999), Sichtkanten ABS 1 mm. Vier Drehtüren mit Blum-Topfscharnieren gedämpft, zwei Schubkästen auf Blum-Systemauszügen, Kleiderstange, je Fach zwei Einlegeböden, Sockel 100 mm, Rückwand 8 mm.',
    [
      // Plattenflaeche 2,00 × 2,40 × 0,60 m inkl. Fronten, Boeden und Sockel.
      // 14,00 €/m² = Dekorspanplatte beidseitig beschichtet inkl. Verschnitt
      // (CLAUDE.md 7.1: 35–55 €/Platte à 5,80 m² = 6–9,50 €/m² roher Zuschnitt).
      m('Dekorspanplatte 19 mm weiß U999', 15.0, 'm²', 14.00),
      m('Rückwand Dekorspanplatte 8 mm weiß', 5.0, 'm²', 8.00),
      // Nur SICHTKANTEN: Fronten, Bodenvorderkanten, Korpusstirnseiten.
      m('ABS-Kante 1 mm weiß', 45, 'lfm', 1.20),
      m('Topfscharnier Blum Clip top gedämpft', 8, 'Stk', 2.50),   // CLAUDE.md 7.2: 1,50–3,00 €
      m('Systemauszug Blum Vollauszug gedämpft', 2, 'Stk', 26.00), // CLAUDE.md 7.2: Tandembox 20–45 €
      m('Kleiderstange oval inkl. Lager', 1, 'Stk', 11.00),
      m('Bodenträger 5 mm', 32, 'Stk', 0.15),
      m('Griff Edelstahl 128 mm', 6, 'Stk', 2.20),                 // CLAUDE.md 7.2: 5–40 € (unteres Ende, Standardbügel)
      m('Kleinmaterial (Schrauben, Dübel, Sockelverstellfüße)', 1, 'psch', 4.50),
      // Summe EK = 409,50 € — die gemessene Materialsumme.
    ],
    [
      z('Besprechung', 20),          // gemessen
      z('Planung', 30),              // gemessen
      z('Konstruktion', 60),         // gemessen
      z('Arbeitsvorbereitung', 45),  // gemessen
      z('Zuschnitt', 216),           // gemessen (CLAUDE.md 3.1: 8–15 min je Platte)
      z('Bekantung', 190),           // gemessen (CLAUDE.md 3.1: 3–5 min je lfm)
      z('Zusammenbau', 479),         // gemessen (CLAUDE.md 3.1/3.2/3.3: Korpus, Schübe, Türen)
      z('Warenhandling', 20),        // gemessen
      z('Produktion', 30),           // gemessen
      z('Verpacken', 30),            // gemessen
    ]),
  p('Lieferung und Montage, Neubau',
    'Lieferung 20 km, Aufstellen und Ausrichten zwischen zwei geraden Wänden, Erdgeschoss, Türen und Schubkästen einstellen.',
    [],
    [
      z('Montage', 240),   // gemessen (CLAUDE.md 5.1: 1,5–2,5 h/lfm bei 2 lfm = 3–5 h)
      z('Lieferung', 70),  // gemessen
    ]),
]

const schrank: Referenzprojekt = {
  schluessel: 'einbauschrank',
  name: 'Einbauschrank',
  kunde: { name: 'Familie Muster', strasse: 'Musterstraße 12', ort: '63517 Rodenbach', projekt: 'Einbauschrank Flur' },
  text: 'Kunde: Familie Muster, Musterstraße 12, 63517 Rodenbach (20 km Anfahrt). Einbauschrank für den Flur, 2,00 m breit × 2,40 m hoch × 0,60 m tief, raumhoch zwischen zwei geraden Wänden, Neubau. Korpus und Fronten Egger Dekorspanplatte 19 mm weiß (U999), alle Sichtkanten ABS 1 mm. Vier Drehtüren mit Blum-Topfscharnieren (Clip top, gedämpft), zwei Schubkästen auf Blum-Systemauszügen (Vollauszug, gedämpft), eine Kleiderstange, je Fach zwei Einlegeböden auf Bodenträgern, Sockel 100 mm, Rückwand 8 mm. Griffe: Kunde stellt keine — verdeckte Griffleiste gefräst entfällt, Standardgriffe Edelstahl 128 mm. Lieferung und Montage beim Kunden, Erdgeschoss. Nicht enthalten: Innenbeleuchtung und Elektroanschluss.',
  positionen: [
    ...schrankGrund,
    // LACK: Bekantung entfaellt (lackierte Kanten), dafuer 600 min Oberflaeche und
    // 60 € Lackmaterial — beides gemessen. Gegenprobe CLAUDE.md 4.4: 15 m² × 40 min
    // (3-Schicht-Aufbau seidenmatt, Band 35–55) = 600 min, 15 m² × 4 €/m² = 60 €.
    variante('lack', 'Alternative: alle Flächen weiß lackiert seidenmatt',
      'Statt Dekor werden alle Sicht- und Innenflächen weiß lackiert: Grundierung, Zwischenschliff, zwei Schichten Decklack seidenmatt. Kantenband entfällt, die Kanten werden mitlackiert.',
      schrankGrund, pos => {
        if (!hatZeile(pos, 'ABS-Kante')) return pos
        return zeitPlus(
          zeitMal(mitMaterialzeile(ohneMaterialzeile(pos, 'ABS-Kante'),
            m('Lack: Grundierung + 2× Decklack seidenmatt', 15.0, 'm²', 4.00)), // CLAUDE.md 4.6
            { Bekantung: 0 }),
          { 'Oberfläche': 600 })  // gemessen
      }),
    // MASSIV: Material-EK 1.770 € (gemessen). Aufgeteilt auf Eiche-Leimholz zu
    // 110 €/m² (CLAUDE.md 7.1: Eiche 25 mm 80–140 €/m², Mitte) plus die
    // unveraenderten Beschlaege plus Hartwachsoel. Werkstatt × 1,3 (CLAUDE.md 3.4:
    // Massivholz +30–60 % Mehrzeit, unteres Ende), Bekantung entfaellt,
    // 300 min Oelen (gemessen; CLAUDE.md 4.2: 20–30 min/m² × 15 m² = 300–450).
    variante('massiv', 'Alternative: komplett Eiche massiv, geölt',
      'Korpus, Fronten und Böden aus Eiche-Leimholz 25 mm statt Dekorspanplatte, alle Flächen zweimal mit Hartwachsöl behandelt. Kantenband entfällt.',
      schrankGrund, pos => {
        if (!hatZeile(pos, 'Dekorspanplatte')) return pos
        return zeitPlus(
          zeitMal(mitMaterialzeile(
            tauscheMaterial(
              ohneMaterialzeile(pos, 'Rückwand', 'ABS-Kante'),
              // 14,73 m² statt 15,0 m²: Die Menge ist — wie bei der Grundposition —
              // gegen den GEMESSENEN Massiv-EK von 1.770 € gerechnet. Massivholz
              // wird in Leimholzplatten gekauft, die Rueckwand faellt in dieselbe
              // Position; der Preis je m² bleibt der Richtwert aus CLAUDE.md 7.1.
              'Dekorspanplatte', 'Eiche-Leimholz 25 mm', 110.00, 14.73),
            m('Hartwachsöl', 2.0, 'l', 22.00)),                          // CLAUDE.md 4.6
            { Zuschnitt: 1.3, Bekantung: 0, Zusammenbau: 1.3, Warenhandling: 1.3, Produktion: 1.3, Verpacken: 1.3 }),
          { 'Oberfläche': 300 })
      }),
    // ALTBAU: nur die Montagezeit, × 1,6 (gemessen; deckt CLAUDE.md 5.1 ab —
    // Altbau 2,5–4,0 h/lfm gegen 1,5–2,5 h/lfm im Neubau — und 8.2: +25–30 %
    // plus zweiter Stock ohne Aufzug). Lieferung bleibt, die Fahrt aendert sich nicht.
    variante('montage', 'Alternative: Montage im Altbau',
      'Wände nicht im Lot, Dielenboden, zweiter Stock ohne Aufzug: Schrank tragen, Sockel und Anschlussleisten an den Boden anpassen, Korpusse ausrichten und unterfüttern.',
      schrankGrund, pos => zeitMal(pos, { Montage: 1.6 })),
  ],
  // CLAUDE.md 6.1: ~1.000 €/lfm netto OHNE Montage → 2 lfm ≈ 2.000 €, plus Montage
  // 20–30 % (CLAUDE.md 6.3). Ergibt 1.800–2.600 €.
  faustregel: { von: 1800, bis: 2600, quelle: 'CLAUDE.md 6.1 (1.000 €/lfm) + 6.3 (Montageanteil)' },
  fragen: {
    grund: 'Was nimmst du für so einen Schrank, netto?',
    lack: 'Derselbe Schrank, aber alles weiß lackiert seidenmatt statt Dekor. Was kommt dazu?',
    massiv: 'Derselbe Schrank in Eiche massiv, geölt. Was nimmst du?',
    montage: 'Derselbe Schrank im Altbau: Wände nicht im Lot, Dielenboden, zweiter Stock ohne Aufzug. Wie lange bist du dran?',
  },
}

// ═════════════════════════════════════════════════════════════════════════════
// 2 — EINBAUKÜCHE
// ═════════════════════════════════════════════════════════════════════════════
//
// Nicht gemessen, sondern aus Stueckliste und Zeitrichtwerten aufgebaut. Die Korpusse
// stehen als Positionen mit Stueckzahl — so greift die Serienstaffel aus types.ts
// (fuenf gleiche Unterschraenke sind nicht fuenfmal so teuer wie einer).
//
// OHNE Elektrogeraete, Spuele, Armatur, Anschluesse und Nischenrueckwand — steht so
// im Referenztext. Deshalb liegt die Summe am unteren Ende der Faustregel-Spanne.

const kuecheGrund: ReferenzPosition[] = [
  p('Unterschrank mit Drehtür',
    'Korpus Dekorspanplatte 19 mm weiß, Rückwand 8 mm, zwei Drehtüren mit Blum-Topfscharnieren gedämpft, ein Einlegeboden, Front weiß matt mit ABS-Kante, Griff Edelstahl 160 mm.',
    [
      m('Dekorspanplatte 19 mm weiß (Korpus)', 1.8, 'm²', 15.00),
      m('Rückwand 8 mm weiß', 0.5, 'm²', 10.00),
      m('Topfscharnier Blum gedämpft', 4, 'Stk', 2.50),          // CLAUDE.md 7.2
      m('Front Dekorspanplatte 19 mm weiß matt', 0.55, 'm²', 16.00),
      m('Griff Edelstahl 160 mm', 1, 'Stk', 12.00),              // CLAUDE.md 7.2: 5–40 €
    ],
    [
      z('Zuschnitt', 25),      // CLAUDE.md 3.1: 8–15 min je Platte, 2 Platten + Front
      z('Bekantung', 15),      // CLAUDE.md 3.1: 3–5 min/lfm Kantenband
      z('Zusammenbau', 85),    // CLAUDE.md 3.1: Korpus 30–60 min + 3.3: 2 Türen à 20 min
      z('Warenhandling', 5),
      z('Verpacken', 5),
    ], 5),
  p('Unterschrank mit drei Auszügen',
    'Korpus wie Drehtürschrank, statt Tür drei Blum-Legrabox-Auszüge mit Schubfronten weiß matt und Griffen.',
    [
      m('Dekorspanplatte 19 mm weiß (Korpus)', 1.8, 'm²', 15.00),
      m('Rückwand 8 mm weiß', 0.5, 'm²', 10.00),
      m('Schubkasten Blum Legrabox', 3, 'Stk', 55.00),           // CLAUDE.md 7.2: 35–80 €
      m('Front Dekorspanplatte 19 mm weiß matt', 0.55, 'm²', 16.00),
      m('Griff Edelstahl 160 mm', 3, 'Stk', 12.00),
    ],
    [
      z('Zuschnitt', 25),
      z('Bekantung', 15),
      z('Zusammenbau', 135),   // Korpus 45 + CLAUDE.md 3.2: 3 Systemschübe à 30 min (Band 20–35)
      z('Warenhandling', 5),
      z('Verpacken', 5),
    ], 3),
  p('Spülenunterschrank 900 mm',
    'Aufbau wie Drehtürschrank, Boden wassergeschützt, Rückwand für Anschlüsse ausgeschnitten. Spüle und Armatur stellt der Kunde.',
    [
      m('Dekorspanplatte 19 mm weiß (Korpus)', 1.8, 'm²', 15.00),
      m('Rückwand 8 mm weiß', 0.5, 'm²', 10.00),
      m('Topfscharnier Blum gedämpft', 4, 'Stk', 2.50),
      m('Front Dekorspanplatte 19 mm weiß matt', 0.55, 'm²', 16.00),
      m('Griff Edelstahl 160 mm', 1, 'Stk', 12.00),
    ],
    [
      z('Zuschnitt', 25), z('Bekantung', 15), z('Zusammenbau', 85),
      z('Warenhandling', 5), z('Verpacken', 5),
    ], 1),
  p('Oberschrank 900 mm hoch',
    'Korpus Dekorspanplatte 19 mm weiß, Rückwand 8 mm, zwei Drehtüren mit Blum-Topfscharnieren gedämpft, zwei Einlegeböden, Front weiß matt, Griff.',
    [
      m('Dekorspanplatte 19 mm weiß (Korpus)', 1.3, 'm²', 15.00),
      m('Rückwand 8 mm weiß', 0.5, 'm²', 10.00),
      m('Topfscharnier Blum gedämpft', 4, 'Stk', 2.50),
      m('Front Dekorspanplatte 19 mm weiß matt', 0.45, 'm²', 16.00),
      m('Griff Edelstahl 160 mm', 1, 'Stk', 12.00),
    ],
    [
      z('Zuschnitt', 20),      // kleinerer Korpus als unten
      z('Bekantung', 12),
      z('Zusammenbau', 80),    // CLAUDE.md 3.1: Korpus 40 + 3.3: 2 Türen à 20 min
      z('Warenhandling', 5),
      z('Verpacken', 5),
    ], 4),
  p('Arbeitsplatte Schichtstoff 38 mm',
    'Arbeitsplatte 5,80 lfm mit Ausschnitten für Spüle und Kochfeld, Kanten umleimt, Wandabschlussleiste.',
    [
      m('Arbeitsplatte Schichtstoff 38 mm', 5.8, 'lfm', 55.00),
      m('Wandabschlussleiste', 5.8, 'lfm', 8.00),
    ],
    [
      z('Zuschnitt', 60),      // CLAUDE.md 3.1: Zuschnitt + Formatieren, Platte auf Gehrung
      z('Zusammenbau', 90),    // Ausschnitte Spüle und Kochfeld, Kanten, Verbinder
    ]),
  p('Sockelblenden 100 mm',
    'Sockelblenden 5,80 lfm mit Dichtlippe, auf Sockelfüße geklipst.',
    [m('Sockelblende 100 mm weiß', 5.8, 'lfm', 6.00)],
    [z('Zuschnitt', 30)]),    // CLAUDE.md 5.5: Blenden 8–15 min/lfm, hier reine Werkstattzeit
  p('Planung und Konstruktion',
    'Aufmaß vor Ort, Küchenplanung mit Ansichten, Konstruktion der Korpusse und Fronten, Arbeitsvorbereitung und Bestellung.',
    [],
    [
      z('Besprechung', 90),           // CLAUDE.md 2.1: Aufmaß komplexer Innenausbau 1,5–3,0 h
      z('Planung', 120),              // CLAUDE.md 2.1: Angebotserstellung 1,0–2,5 h
      z('Konstruktion', 240),         // CLAUDE.md 2.1: CAD Einbaumöbel mit Detailplanung 2,0–4,0 h
      z('Arbeitsvorbereitung', 120),
    ]),
  p('Lieferung und Montage, Neubau',
    'Anlieferung 20 km, Korpusse aufstellen und ausrichten, Arbeitsplatte anpassen und anschließen, Fronten einstellen, Sockel setzen. Zwei Monteure, ein Tag.',
    [],
    [
      // CLAUDE.md 5.1: 1,5–2,5 h/lfm × 5,8 lfm = 9–15 h, plus Arbeitsplatte.
      // Angesetzt: 2 Monteure × 8 h = 16 h = 960 min.
      z('Montage', 960),
      z('Lieferung', 60),
    ]),
]

/** Die Frontflaeche einer Kuechenposition in m² — 0, wenn sie keine Front hat. */
const frontflaeche = (pos: ReferenzPosition) =>
  pos.material.find(x => x.bezeichnung.startsWith('Front'))?.menge ?? 0

const kueche: Referenzprojekt = {
  schluessel: 'kueche',
  name: 'Einbauküche',
  kunde: { name: 'Familie Muster', strasse: 'Musterstraße 12', ort: '63517 Rodenbach', projekt: 'Einbauküche L-Form' },
  text: 'Kunde: Familie Muster, Musterstraße 12, 63517 Rodenbach (20 km Anfahrt). Einbauküche in L-Form, 3,60 m × 2,20 m, Neubau, gerade Wände, Anschlüsse liegen. Korpusse Dekorspanplatte 19 mm weiß, Rückwände 8 mm. Fronten Dekorspanplatte 19 mm weiß matt, Kanten ABS 1 mm. Acht Unterschränke (davon drei mit je drei Auszügen Blum Legrabox, fünf mit Drehtür und Einlegeboden), ein Spülenunterschrank 900 mm, vier Oberschränke 900 mm hoch mit Drehtüren, Blum-Topfscharniere gedämpft. Arbeitsplatte Schichtstoff 38 mm mit Ausschnitten für Spüle und Kochfeld, Wandabschlussleiste, Sockelblende 100 mm, Griffe Edelstahl 160 mm. Lieferung und Montage inklusive Ausrichten und Anschluss der Arbeitsplatte, Erdgeschoss. Nicht enthalten: Elektrogeräte, Spüle und Armatur, Elektro- und Wasseranschluss, Fliesenspiegel/Nischenrückwand.',
  positionen: [
    ...kuecheGrund,
    // LACK: nur die FRONTEN werden lackiert (ca. 6,75 m² gesamt). Traegermaterial
    // wechselt von Dekor 16 €/m² auf MDF roh 12 €/m², dazu 40 min/m² Oberflaeche
    // (CLAUDE.md 4.4: 35–55 min/m² 3-Schicht seidenmatt) und 4 €/m² Lack
    // (CLAUDE.md 4.6). Korpusse bleiben Dekor — so baut es jeder Betrieb.
    variante('lack', 'Alternative: Fronten weiß lackiert seidenmatt',
      'Fronten aus MDF roh, von uns grundiert, zwischengeschliffen und zweimal weiß seidenmatt lackiert. Korpusse bleiben Dekor weiß.',
      kuecheGrund, pos => {
        const flaeche = frontflaeche(pos)
        if (flaeche === 0) return pos
        return zeitPlus(
          mitMaterialzeile(
            tauscheMaterial(pos, 'Front', 'Front MDF roh 19 mm (Lackträger)', 12.00),
            m('Lack: Grundierung + 2× Decklack seidenmatt', flaeche, 'm²', 4.00)),
          { 'Oberfläche': flaeche * 40 })
      }),
    // MASSIV: Fronten Eiche massiv 110 €/m² (CLAUDE.md 7.1: 80–140 €/m²),
    // Werkstattzeit der Frontpositionen × 1,3 (CLAUDE.md 3.4: +30–60 %, unteres
    // Ende), dazu 20 min/m² zweimal oelen (CLAUDE.md 4.2: 20–30 min/m²).
    // Bekantung bleibt UNVERAENDERT: Die Korpuskanten werden weiter mit ABS
    // bekantet — nur die Eichenfronten bekommen keine Kante.
    variante('massiv', 'Alternative: Fronten Eiche massiv, geölt',
      'Fronten aus Eiche massiv 25 mm, geschliffen und zweimal mit Hartwachsöl behandelt. Korpusse bleiben Dekor weiß.',
      kuecheGrund, pos => {
        const flaeche = frontflaeche(pos)
        if (flaeche === 0) return pos
        return zeitPlus(
          zeitMal(tauscheMaterial(pos, 'Front', 'Front Eiche massiv 25 mm', 110.00),
            { Zuschnitt: 1.3, Zusammenbau: 1.3, Warenhandling: 1.3, Verpacken: 1.3 }),
          { 'Oberfläche': flaeche * 20 })
      }),
    // ALTBAU: Montage × 1,6 (CLAUDE.md 5.1 Altbau 2,5–4,0 gegen 1,5–2,5 h/lfm,
    // CLAUDE.md 8.2: +25–30 % plus fehlender Aufzug).
    variante('montage', 'Alternative: Montage im Altbau',
      'Wände nicht im Lot, alte Leitungen, kein Aufzug: Korpusse einzeln tragen, Anschlüsse anpassen, Arbeitsplatte an die Wand anscribeln, Sockel ausgleichen.',
      kuecheGrund, pos => zeitMal(pos, { Montage: 1.6 })),
  ],
  // CLAUDE.md 6.1: Einbauküche nach Maß 5.000–20.000 € netto.
  // OHNE Geräte, Spüle und Armatur — deshalb am unteren Ende der Spanne.
  faustregel: { von: 5000, bis: 20000, quelle: 'CLAUDE.md 6.1 (Einbauküche nach Maß, ohne Geräte)' },
  fragen: {
    grund: 'Was nimmst du für so eine Küche, netto?',
    lack: 'Dieselbe Küche, aber Fronten weiß lackiert seidenmatt statt Dekor. Was kommt dazu?',
    massiv: 'Dieselbe Küche mit Fronten in Eiche massiv, geölt. Was nimmst du?',
    montage: 'Dieselbe Küche im Altbau: Wände nicht im Lot, alte Leitungen, kein Aufzug. Wie lange bist du dran?',
  },
  fragenHinweis: {
    grund: 'Ohne Elektrogeräte, Spüle und Armatur — die zahlt der Kunde extra.',
  },
}

// ═════════════════════════════════════════════════════════════════════════════
// 3 — INNENTÜREN
// ═════════════════════════════════════════════════════════════════════════════
//
// Fuenf gleiche Tueren als EINE Position mit Stueckzahl 5 — die Serienstaffel aus
// types.ts bildet ab, dass die fuenfte Tuer schneller geht als die erste.
//
// Material macht hier ueber die Haelfte des Preises aus. Deshalb werden Grund- und
// Massivholzfrage OHNE Material gestellt (ohneMaterial) und je Tuer beziffert
// (teiler 5) — sonst misst die Frage den Einkauf statt das Tempo.

const tuerenGrund: ReferenzPosition[] = [
  p('Innentür mit Umfassungszarge, liefern und einpassen',
    'Türblatt Röhrenspan weiß beschichtet (CPL) 860 × 1.985 mm, Umfassungszarge weiß für Wandstärke 120–140 mm, Bänder V 3420, Buntbartschloss, Drückergarnitur Edelstahl. Zarge einpassen und kürzen, Tür einhängen und einstellen.',
    [
      m('Türblatt Röhrenspan CPL weiß 860 × 1.985 mm', 1, 'Stk', 95.00),
      m('Umfassungszarge weiß, Wandstärke 120–140 mm', 1, 'Stk', 85.00),
      m('Bänder, Buntbartschloss, Drückergarnitur Edelstahl', 1, 'Satz', 45.00),
    ],
    [
      z('Zuschnitt', 10),      // CLAUDE.md 5.2: Zarge kürzen 20–40 min, hier Werkstattanteil
      z('Zusammenbau', 20),    // Zarge vorbereiten, Bänder und Schloss setzen
      z('Montage', 90),        // CLAUDE.md 5.2: Altbau 1,5–3,0 h je Tür, unteres Ende
      z('Lieferung', 15),
    ], 5),
  p('Planung und Aufmaß',
    'Aufmaß der fünf Öffnungen, Wandstärken und Bandseiten festlegen, Bestellung und Arbeitsvorbereitung.',
    [],
    [
      z('Besprechung', 15),          // CLAUDE.md 2.1: Aufmaß einfacher Raum 0,5–1,0 h
      z('Planung', 21),
      z('Konstruktion', 44),
      z('Arbeitsvorbereitung', 32),
    ]),
]

const tueren: Referenzprojekt = {
  schluessel: 'tueren',
  name: 'Innentüren',
  kunde: { name: 'Familie Muster', strasse: 'Musterstraße 12', ort: '63517 Rodenbach', projekt: '5 Innentüren mit Zargen' },
  text: 'Kunde: Familie Muster, Musterstraße 12, 63517 Rodenbach (20 km Anfahrt). Fünf Innentüren mit Umfassungszargen im Altbau (Wände nicht überall im Lot, alte Zargen sind ausgebaut). Türblätter Röhrenspan, weiß beschichtet (CPL), Standardmaß 860 × 1.985 mm, Zargen weiß beschichtet für Wandstärke 120–140 mm, Bänder V 3420, Buntbartschloss, Drückergarnitur Edelstahl. Liefern, Zargen einpassen und kürzen, Türen einhängen und einstellen, Erdgeschoss und erster Stock. Nicht enthalten: Ausbau der alten Zargen (in der Altbau-Frage unten gesondert).',
  positionen: [
    ...tuerenGrund,
    // LACK: Tuerblatt roh statt CPL (70 € statt 95 €), dafuer 4 m² je Tuer
    // lackieren: 40 min/m² (CLAUDE.md 4.4) und 4 €/m² (CLAUDE.md 4.6).
    // 4 m² = Tuerblatt beidseitig (0,86 × 1,985 × 2 = 3,4 m²) plus Zarge und Kanten.
    variante('lack', 'Alternative: Türen von uns weiß lackiert statt CPL',
      'Türblätter roh statt beschichtet, von uns grundiert, zwischengeschliffen und zweimal weiß seidenmatt lackiert — Türblatt und Zarge.',
      tuerenGrund, pos => {
        if (!hatZeile(pos, 'Türblatt')) return pos
        return zeitPlus(
          mitMaterialzeile(
            tauscheMaterial(pos, 'Türblatt', 'Türblatt Röhrenspan roh 860 × 1.985 mm', 70.00),
            m('Lack: Grundierung + 2× Decklack seidenmatt', 4.0, 'm²', 4.00)),
          { 'Oberfläche': 160 })   // 4 m² × 40 min/m²
      }),
    // MASSIV: Tuerblatt und Zarge in Eiche, Werkstatt × 1,3 (CLAUDE.md 3.4),
    // Oelen 4 m² × 20 min/m² (CLAUDE.md 4.2).
    variante('massiv', 'Alternative: Türen Eiche massiv, geölt',
      'Türblätter und Zargen in Eiche massiv, geschliffen und zweimal mit Hartwachsöl behandelt.',
      tuerenGrund, pos => {
        if (!hatZeile(pos, 'Türblatt')) return pos
        return zeitPlus(
          zeitMal(
            tauscheMaterial(
              tauscheMaterial(pos, 'Türblatt', 'Türblatt Eiche massiv 860 × 1.985 mm', 420.00),
              'Umfassungszarge', 'Umfassungszarge Eiche massiv', 260.00),
            { Zuschnitt: 1.3, Zusammenbau: 1.3 }),
          { 'Oberfläche': 80 })    // 4 m² × 20 min/m²
      }),
    // ALTBAU-ALTERNATIVE: NICHT noch einmal Altbau — der Grundtext ist schon Altbau.
    // Der echte Mehraufwand ist der Ausbau der alten Zargen und die Wandausbesserung:
    // +45 min Montage je Tuer (CLAUDE.md 5.2: Altbau bis 3,0 h je Tür, oberes Ende).
    variante('montage', 'Alternative: mit Ausbau der alten Zargen und Wandausbesserung',
      'Alte Zargen ausstemmen und entsorgen, Laibungen ausbessern und Anschlüsse verputzen, dann erst die neue Zarge setzen.',
      tuerenGrund, pos => zeitPlus(pos, { Montage: hatZeile(pos, 'Türblatt') ? 45 : 0 })),
  ],
  // CLAUDE.md 6.1: Innentür liefern + montieren 350–800 € netto je Stück → 5 Türen.
  faustregel: { von: 1750, bis: 4000, quelle: 'CLAUDE.md 6.1 (350–800 € je Tür × 5)' },
  ohneMaterial: ['grund', 'massiv'],
  teiler: { grund: 5, lack: 5, massiv: 5, montage: 5 },
  fragen: {
    grund: 'Was nimmst du fürs Einpassen einer Tür, wenn der Kunde Tür und Zarge selbst stellt?',
    lack: 'Dieselben Türen, aber von dir weiß lackiert seidenmatt statt beschichtet gekauft. Was kommt je Tür dazu?',
    massiv: 'Dieselben Türen in Eiche massiv, geölt: Was nimmst du je Tür für deine Arbeit, ohne das Holz?',
    montage: 'Eine Tür, bei der auch die alte Zarge raus muss und die Laibung ausgebessert wird. Wie lange bist du an der einen Tür?',
  },
  fragenHinweis: {
    grund: 'Nur deine Arbeit — Türblatt und Zarge zahlt der Kunde extra. So misst CraftFlow dein Tempo und nicht deinen Einkauf.',
    massiv: 'Wieder nur deine Arbeit, das Eichenholz zahlt der Kunde extra.',
  },
}

// ═════════════════════════════════════════════════════════════════════════════
// 4 — TREPPE
// ═════════════════════════════════════════════════════════════════════════════
//
// Rohtreppe zugekauft — Material macht ueber die Haelfte des Preises aus
// (CLAUDE.md 6.2: Treppe 50–60 % Material). Deshalb ohneMaterial fuer die Grundfrage.
// Keine Massivholzfrage: Die Treppe IST Buche massiv.

const treppeGrund: ReferenzPosition[] = [
  p('Treppe Buche massiv, 13 Steigungen',
    'Geradläufige Treppe Buche massiv, 13 Steigungen (Geschosshöhe 2,73 m), 90 cm laufbreit, Setzstufen, Wangen 40 mm, Stufen 40 mm. Rohtreppe zugekauft, fertig geölt vom Hersteller. Geländer mit Füllstäben und Handlauf rund 42 mm.',
    [
      m('Rohtreppe Buche massiv, 13 Steigungen, geölt', 1, 'Stk', 2400.00),  // CLAUDE.md 6.1: Treppe gesamt 3.000–7.000 €, Materialanteil 50–60 % (6.2)
      m('Geländer mit Füllstäben und Handlauf rund 42 mm', 1, 'Stk', 650.00),
      m('Kleinmaterial (Dübel, Anker, Schrauben, Leim)', 1, 'psch', 120.00),
    ],
    [
      z('Warenhandling', 40),
      z('Zuschnitt', 108),     // Wangen an Wand und Decke anpassen, Handlauf ablängen
      z('Zusammenbau', 162),   // CLAUDE.md 5.4: Geländer 30–60 min/lfm, Füllstäbe 60–90
      z('Oberfläche', 154),    // CLAUDE.md 4.1/4.2: Nacharbeit an den angepassten Teilen
    ]),
  p('Planung und Konstruktion',
    'Aufmaß am Rohbau, Steigungsverhältnis prüfen, Bestellzeichnung für den Treppenbauer, Arbeitsvorbereitung.',
    [],
    [
      z('Besprechung', 35), z('Planung', 51), z('Konstruktion', 105), z('Arbeitsvorbereitung', 78),
    ]),
  p('Lieferung und Montage, Neubau',
    'Anlieferung 20 km, Treppe einbringen und aufstellen, an Wand und Decke anpassen, Auflager setzen, Geländer montieren.',
    [],
    [
      z('Montage', 752),   // CLAUDE.md 5.4: gerade Treppe 1–2 Tage (2 Mann) + Geländer
      z('Lieferung', 212),
    ]),
]

const treppen: Referenzprojekt = {
  schluessel: 'treppen',
  name: 'Treppe',
  kunde: { name: 'Familie Muster', strasse: 'Musterstraße 12', ort: '63517 Rodenbach', projekt: 'Geradläufige Treppe Buche' },
  text: 'Kunde: Familie Muster, Musterstraße 12, 63517 Rodenbach (20 km Anfahrt). Geradläufige Treppe, Buche massiv, 13 Steigungen (Geschosshöhe 2,73 m), 90 cm laufbreit, mit Setzstufen, Wangen 40 mm, Stufen 40 mm, Geländer mit Füllstäben und Handlauf rund 42 mm, Oberfläche geölt. Rohtreppe zugekauft (fertig geölt vom Hersteller), Neubau, Treppenloch fertig, Rohbetonauflager. Anlieferung, Einbau, Anpassung an Wand und Decke, Montage des Geländers. Nicht enthalten: Podest und Treppenbelag im Umfeld.',
  positionen: [
    ...treppeGrund,
    // LACK: 12 m² Sichtflaeche (Stufen, Setzstufen, Wangen, Gelaender).
    // 40 min/m² (CLAUDE.md 4.4) = 480 min ERSETZT die 154 min Oelnacharbeit —
    // lackiert statt geoelt, nicht zusaetzlich. Lack 12 m² × 4 € (CLAUDE.md 4.6).
    variante('lack', 'Alternative: weiß lackiert seidenmatt statt geölt',
      'Treppe roh bezogen, von uns geschliffen, grundiert, zwischengeschliffen und zweimal weiß seidenmatt lackiert — Stufen, Setzstufen, Wangen und Geländer.',
      treppeGrund, pos => {
        if (!hatZeile(pos, 'Rohtreppe')) return pos
        return zeitSetzen(
          mitMaterialzeile(pos, m('Lack: Grundierung + 2× Decklack seidenmatt', 12.0, 'm²', 4.00)),
          'Oberfläche', 480)
      }),
    // ALTBAU: Montage × 1,6 (CLAUDE.md 5.1/8.2). Keine Massivholzfrage.
    variante('montage', 'Alternative: Einbau im Altbau',
      'Schiefe Wände, Podest anpassen, enges Treppenhaus: Treppe in Teilen einbringen, Wangen an die Wand anscribeln, Auflager unterfüttern.',
      treppeGrund, pos => zeitMal(pos, { Montage: 1.6 })),
  ],
  // CLAUDE.md 6.1: Gerade Holztreppe (Fichte/Buche, eingebaut) 3.000–7.000 € netto.
  faustregel: { von: 3000, bis: 7000, quelle: 'CLAUDE.md 6.1 (gerade Holztreppe, eingebaut)' },
  ohneMaterial: ['grund'],
  fragen: {
    grund: 'Was berechnest du für Einbau und Anpassung, wenn der Kunde die Rohtreppe selbst stellt?',
    lack: 'Dieselbe Treppe, aber weiß lackiert seidenmatt statt geölt. Was kommt dazu?',
    montage: 'Dieselbe Treppe im Altbau: schiefe Wände, Podest anpassen, enges Treppenhaus. Wie lange bist du dran?',
  },
  fragenHinweis: {
    grund: 'Nur deine Arbeit — die Rohtreppe zahlt der Kunde extra. So misst CraftFlow dein Tempo und nicht deinen Einkauf.',
  },
}

// ═════════════════════════════════════════════════════════════════════════════
// 5 — MASSIVHOLZTISCH
// ═════════════════════════════════════════════════════════════════════════════
//
// Keine Massivholzfrage — der Tisch IST Eiche massiv. Keine Montage: Er wird
// geliefert, Gestell und Platte werden vor Ort verschraubt (steht in der Lieferzeit).

const tischGrund: ReferenzPosition[] = [
  p('Esstisch Eiche massiv 200 × 90 cm',
    'Platte 40 mm durchgehend verleimt, Kanten gerade, Wangengestell Eiche massiv 60 mm mit Metall-Zarge unter der Platte, Oberfläche Hartwachsöl zweimal, alle Seiten.',
    [
      m('Eiche massiv 40 mm (Platte)', 2.1, 'm²', 140.00),   // CLAUDE.md 7.1: Eiche 25 mm 80–140 €/m², 40 mm am oberen Ende
      m('Eiche massiv 60 mm (Wangengestell)', 1.3, 'm²', 140.00),
      m('Hartwachsöl', 1.5, 'l', 22.00),                     // CLAUDE.md 4.6: 80–120 ml/m² je Auftrag
      m('Kleinmaterial (Metall-Zarge, Nutensteine, Schrauben)', 1, 'psch', 25.00),
    ],
    [
      z('Zuschnitt', 242),     // CLAUDE.md 3.4: Abrichten und Hobeln 3–8 min/lfm, Lamellen zuschneiden
      z('Zusammenbau', 485),   // CLAUDE.md 3.4: Verleimen 30–60 min/m² Leimfläche, Gestell zapfen
      z('Warenhandling', 39),
      z('Verpacken', 29),
      z('Oberfläche', 334),    // CLAUDE.md 4.1 + 4.2: Schleifen 8–15 min/m² + 2× ölen 20–30 min/m², beidseitig
    ]),
  p('Planung und Konstruktion',
    'Entwurf, Maßabstimmung, Konstruktion von Platte und Gestell, Holzauswahl und Arbeitsvorbereitung.',
    [],
    [z('Besprechung', 30), z('Planung', 44), z('Konstruktion', 91), z('Arbeitsvorbereitung', 68)]),
  p('Lieferung ins Erdgeschoss',
    'Anlieferung 20 km, Tisch ins Erdgeschoss tragen, Gestell und Platte vor Ort verschrauben, ausrichten.',
    [],
    [z('Lieferung', 134)]),   // keine Montageposition: 30 min Verschrauben stecken in der Lieferzeit
]

const solitaer: Referenzprojekt = {
  schluessel: 'solitaer',
  name: 'Massivholztisch',
  kunde: { name: 'Familie Muster', strasse: 'Musterstraße 12', ort: '63517 Rodenbach', projekt: 'Esstisch Eiche massiv' },
  text: 'Kunde: Familie Muster, Musterstraße 12, 63517 Rodenbach (20 km Anfahrt). Esstisch Eiche massiv, 200 × 90 cm, Platte 40 mm durchgehend verleimt, Kanten gerade, Wangengestell Eiche massiv 60 mm mit Metall-Zarge unter der Platte, Oberfläche Hartwachsöl zweimal, alle Seiten. Lieferung ins Erdgeschoss, Gestell und Platte werden vor Ort verschraubt (30 Minuten). Nicht enthalten: Stühle, Bank.',
  positionen: [
    ...tischGrund,
    // LACK statt OEL. ABWEICHUNG vom ersten Ansatz (5 m² × 40 min): Damit laege die
    // Alternative UNTER der Grundausfuehrung — lackieren waere billiger als oelen.
    // Das ist fachlich falsch. Korrigiert wurden die MENGEN, nicht die Preise:
    //   Flaeche 7,0 m² statt 5 m² — Platte oben und unten (2 × 1,80), umlaufende
    //   Kante 40 mm (0,23), Wangengestell beidseitig (rund 3,2).
    //   55 min/m² statt 40 — oberes Ende des Bandes CLAUDE.md 4.4, weil Eiche
    //   massiv nach derselben Praxisregel zweimal grundiert werden muss ("Grundierung
    //   auf Massivholz/Hirnholz: oft 2× noetig"). CLAUDE.md 9.2 stuetzt das: Eiche
    //   Faktor 1,2–1,4 gegenueber Fichte.
    // Das Hartwachsoel entfaellt dafuer aus der Stueckliste.
    variante('lack', 'Alternative: weiß lackiert seidenmatt statt geölt',
      'Tisch geschliffen, zweimal grundiert (Eiche massiv), zwischengeschliffen und zweimal weiß seidenmatt lackiert — Platte beidseitig, Kanten und Gestell.',
      tischGrund, pos => {
        if (!hatZeile(pos, 'Hartwachsöl')) return pos
        return zeitSetzen(
          mitMaterialzeile(ohneMaterialzeile(pos, 'Hartwachsöl'),
            m('Lack: 2× Grundierung + 2× Decklack seidenmatt', 7.0, 'm²', 4.00)),
          'Oberfläche', 385)   // 7,0 m² × 55 min/m²
      }),
    // LIEFERUNG SCHWER: zweiter Stock ohne Aufzug, Gestell vor Ort montiert.
    // Lieferung × 1,6 (CLAUDE.md 8.2) und 60 min Montage, die es im Grundfall
    // nicht als eigene Zeile gibt.
    variante('montage', 'Alternative: Lieferung 2. Stock ohne Aufzug, Gestell vor Ort montiert',
      'Platte und Gestell einzeln in den zweiten Stock tragen, Gestell vor Ort zusammenbauen, Platte auflegen und verschrauben, Tisch ausrichten.',
      tischGrund, pos => zeitPlus(zeitMal(pos, { Lieferung: 1.6 }),
        { Montage: pos.arbeitszeit.some(a => a.kostenstelle === 'Lieferung') ? 60 : 0 })),
  ],
  // CLAUDE.md 6.1: Massivholztisch (Eiche, 200 × 90 cm, geölt) 2.000–4.500 € netto.
  faustregel: { von: 2000, bis: 4500, quelle: 'CLAUDE.md 6.1 (Massivholztisch Eiche, geölt)' },
  fragen: {
    grund: 'Was nimmst du für so einen Tisch, netto?',
    lack: 'Derselbe Tisch, aber weiß lackiert seidenmatt statt geölt. Was kommt dazu?',
    montage: 'Derselbe Tisch, geliefert in den zweiten Stock ohne Aufzug, Gestell vor Ort montiert. Wie lange bist du dran?',
  },
}

export const REFERENZPROJEKTE: Record<Referenzprojekt['schluessel'], Referenzprojekt> = {
  einbauschrank: schrank,
  kueche,
  tueren,
  treppen,
  solitaer,
}

// ── Rechnen ──────────────────────────────────────────────────────────────────

/**
 * Die Positionen mit den Saetzen und dem Materialaufschlag DIESES Betriebs.
 *
 * `aufschlag` ist ein BRUCH (0,30 = 30 %) — genau so, wie MaterialPosten.aufschlag
 * in materialkostenPos verrechnet wird. Fehlt ein Stundensatz, bleibt der
 * Platzhalter aus den Daten stehen; ein 0-Satz wuerde die Position stillschweigend
 * verbilligen.
 *
 * Gibt immer KOPIEN zurueck — die Vorlage darf sich nie veraendern.
 */
export function mitSaetzen(
  projekt: Referenzprojekt, saetze: Record<string, number>, aufschlag: number,
): ReferenzPosition[] {
  return projekt.positionen.map(q => ({
    ...q,
    material: q.material.map(x => ({ ...x, aufschlag })),
    arbeitszeit: q.arbeitszeit.map(a => ({
      ...a,
      vkStunde: typeof saetze[a.kostenstelle] === 'number' && saetze[a.kostenstelle] > 0
        ? saetze[a.kostenstelle] : a.vkStunde,
    })),
  }))
}

/**
 * Summen einer Positionsliste — ueber dieselben Funktionen wie App, PDF und Export
 * (types.ts). Eine eigene Rechnung hier waere die sichere Art, spaeter andere Zahlen
 * anzuzeigen als das Angebot.
 *
 * `nurGrund` (Standard) laesst die Alternativpositionen aussen vor, so wie
 * nettoSumme es im Angebot tut.
 */
export function summen(pos: ReferenzPosition[], nurGrund = true): {
  netto: number; material: number; arbeit: number; stunden: number
} {
  const liste = nurGrund ? pos.filter(q => !q.alternativ) : pos
  const netto = liste.reduce((s, q) => s + calcAngebotspos(q), 0)
  const material = materialkostenGesamt(liste)
  return { netto, material, arbeit: netto - material, stunden: stundenGesamt(liste) }
}

const eur = (n: number) => `${Math.round(n).toLocaleString('de-DE')} €`

/**
 * Die Faustregel als KONTROLLE neben der Summe — nie als Quelle eines Preises.
 * Weicht die Kalkulation ab, ist das ein Hinweis auf die drei Stellschrauben, an
 * denen es liegen kann; korrigiert wird nichts automatisch.
 */
export function faustregelKontrolle(
  netto: number, f: Referenzprojekt['faustregel'],
): { imRahmen: boolean; text: string } {
  const spanne = `Faustregel ${eur(f.von)}–${eur(f.bis)}`
  if (netto < f.von) {
    return { imRahmen: false, text: `${spanne} — liegt darunter: prüfe Materialansatz, Stundensätze, Zeitrichtwerte.` }
  }
  if (netto > f.bis) {
    return { imRahmen: false, text: `${spanne} — liegt darüber: prüfe Materialansatz, Stundensätze, Zeitrichtwerte.` }
  }
  return { imRahmen: true, text: `${spanne} — liegt im Rahmen.` }
}
