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
// Importiert NUR aus ./types.ts und ./handarbeit.ts — kein React, kein Supabase,
// sonst laeuft `npm run test` nicht (Node fuehrt die .ts-Dateien direkt aus).

import type { Angebotsposition, MaterialPosten, ArbeitsPosten } from './types.ts'
import {
  calcAngebotspos, materialkostenGesamt, stundenGesamt,
  materialRabatt, zeitFaktorFuer, stueckzahlVon, normalizeKsId,
} from './types.ts'
// handarbeit.ts importiert selbst nichts — bleibt also mit `npm run test` vertraeglich.
import { bucheUm, HANDARBEIT_ZIEL } from './handarbeit.ts'

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
      // 25,00 €/m²: FABIANS WERT (2026-09-17) fuer Dekorspanplatte beidseitig
      // beschichtet inkl. Verschnitt und Zuschnitt. Vorher standen hier 14 €/m²
      // (aus CLAUDE.md 7.1: 35–55 €/Platte à 5,80 m² zurueckgerechnet) — das war
      // der reine Plattenpreis ohne Verschnitt, zu guenstig fuer ein Mittelfeld.
      m('Dekorspanplatte 19 mm weiß U999', 15.0, 'm²', 25.00),
      // Annahme: duenne Rueckwandplatte, in CLAUDE.md 7.1 nicht eigens gelistet;
      // derselbe Wert wie in der Kueche (Kleinzuschnitte).
      m('Rückwand Dekorspanplatte 8 mm weiß', 5.0, 'm²', 10.00),
      // NUR DIE FRONTKANTEN: vier Tueren (je rund 5,6 lfm Umfang) und zwei
      // Schubfronten = rund 27 lfm. Boeden und Korpus laufen mit werkseitig
      // bekanteten Plattenkanten.
      // 26 lfm war die Menge, die zusammen mit dem Griffpreis die urspruenglich
      // gemessenen 409,50 € Material-EK traf. Seit Fabians Plattenpreis von 25 €/m²
      // (2026-09-17) ist der gemessene EK kein Anker mehr — die Summe liegt jetzt
      // bei 584,50 €. Die 190 min Bekantung sind auf 26 lfm 7,3 min/lfm und damit
      // ueber dem Band 3–5 min/lfm (CLAUDE.md 3.1); Fabian will die Zeiten im
      // oberen Mittelfeld, deshalb bleiben sie.
      m('ABS-Kante 1 mm weiß', 26, 'lfm', 1.20),
      m('Topfscharnier Blum Clip top gedämpft', 8, 'Stk', 2.50),   // CLAUDE.md 7.2: 1,50–3,00 €
      m('Systemauszug Blum Vollauszug gedämpft', 2, 'Stk', 26.00), // CLAUDE.md 7.2: Tandembox 20–45 €
      // Annahme: Kleiderstange oval 2,00 m mit zwei Lagern. Steht nicht in
      // CLAUDE.md 7.2 — Erfahrungswert aus dem Beschlagkatalog.
      m('Kleiderstange oval inkl. Lager', 1, 'Stk', 11.00),
      // Annahme: Standard-Bodentraeger 5 mm, Stahl verzinkt, Schuettgut.
      // Nicht in CLAUDE.md 7.2 gelistet, weil zu kleinteilig.
      m('Bodenträger 5 mm', 32, 'Stk', 0.15),
      // CLAUDE.md 7.2: Tuergriff Standard bis Mittelklasse 5–40 € — 6,00 € ist das
      // untere Ende des Bandes (einfacher Edelstahl-Buegelgriff 128 mm).
      // Vorher standen hier 2,20 €; das lag UNTER dem Richtbereich.
      m('Griff Edelstahl 128 mm', 6, 'Stk', 6.00),
      // Annahme: Schrauben, Duebel, Sockelverstellfuesse. Pauschale, kein
      // CLAUDE.md-Richtwert — die uebliche Restgroesse einer Stueckliste.
      m('Kleinmaterial (Schrauben, Dübel, Sockelverstellfüße)', 1, 'psch', 4.50),
      // Summe EK = 584,50 € (vor Fabians Plattenpreis: 409,50 € gemessen).
    ],
    [
      z('Besprechung', 20),          // gemessen
      z('Planung', 30),              // gemessen
      z('Konstruktion', 60),         // gemessen
      z('Arbeitsvorbereitung', 45),  // gemessen
      z('Zuschnitt', 216),           // gemessen (CLAUDE.md 3.1: 8–15 min je Platte)
      z('Bekantung', 190),           // gemessen (CLAUDE.md 3.1: 3–5 min je lfm)
      // CNC: Lochreihen fuer 32 Bodentraeger, 8 Topfbohrungen, Auszugs- und
      // Griffbohrungen, Verbinder. Fabian 2026-09-17: "Die Kostenstelle CNC fehlt
      // komplett" — vorher steckte diese Arbeit stillschweigend im Zusammenbau.
      // Aus den gemessenen 479 min Zusammenbau herausgeloest (479 → 419), damit
      // die Gesamtzeit gleich bleibt; sie laeuft jetzt zum CNC-Satz. Betriebe OHNE
      // CNC bekommen sie ueber umgebucht() als Handarbeit zurueck (× 1,6).
      // CLAUDE.md 3.1: Duebelloecher bohren, Verbinder setzen 5–10 min je Bauteil.
      z('CNC', 60),
      z('Zusammenbau', 419),         // gemessen 479, davon 60 min zur CNC (siehe oben)
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
              // 14,52 m² statt 15,0 m²: Die Menge ist — wie bei der Grundposition —
              // gegen den GEMESSENEN Massiv-EK von 1.770 € gerechnet. Massivholz
              // wird in Leimholzplatten gekauft, die Rueckwand faellt in dieselbe
              // Position; der Preis je m² bleibt der Richtwert aus CLAUDE.md 7.1
              // (Eiche 25 mm 80–140 €/m²). Die Beschlaege bleiben unveraendert
              // stehen, deshalb aendert der angehobene Griffpreis auch hier die
              // Holzmenge (vorher 14,73 m² bei 2,20 € je Griff).
              'Dekorspanplatte', 'Eiche-Leimholz 25 mm', 110.00, 14.52),
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
// im Referenztext.

const kuecheGrund: ReferenzPosition[] = [
  // ZEITEN JE KORPUS — Fabian 2026-09-17: "Das ist insgesamt sehr wenig Zeit. Hier
  // haben wir die Kalkulationslogik sehr weit nach unten korrigiert." und "Wir
  // muessen ein gutes Mittelfeld abbilden, damit die Faktoren auch funktionieren."
  // Vorher lag jeder Wert am UNTEREN Rand der CLAUDE.md-Baender (Unterschrank 135
  // min = 2,25 h Werkstatt). Jetzt obere Haelfte der Baender, dazu die Kostenstelle
  // CNC (Lochreihen, Topf- und Verbinderbohrungen, Griffbohrungen), die vorher
  // komplett fehlte — "wenn das haendisch gemacht werden muss, reicht die Zeit
  // lange nicht." Betriebe ohne CNC: umgebucht() bucht die Minuten × 1,6 auf den
  // Zusammenbau (src/lib/handarbeit.ts, dieselbe Regel wie in der Kalkulation).
  //
  // PLATTENPREIS 25 €/m²: Fabians Wert (2026-09-17), vorher 15 €/m².
  p('Unterschrank mit Drehtür',
    'Korpus Dekorspanplatte 19 mm weiß, Rückwand 8 mm, zwei Drehtüren mit Blum-Topfscharnieren gedämpft, ein Einlegeboden, Front weiß matt mit ABS-Kante, zwei Griffe Edelstahl 160 mm, Sockelverstellfüße.',
    [
      m('Dekorspanplatte 19 mm weiß (Korpus)', 1.8, 'm²', 25.00),  // Fabian 2026-09-17: 25 €/m² inkl. Verschnitt und Zuschnitt
      m('Rückwand 8 mm weiß', 0.5, 'm²', 10.00),  // Annahme: 8 mm Dekorplatte in Kleinzuschnitten; in CLAUDE.md 7.1 nicht gelistet
      m('Topfscharnier Blum gedämpft', 4, 'Stk', 2.50),          // CLAUDE.md 7.2
      m('Front Dekorspanplatte 19 mm weiß matt', 0.55, 'm²', 30.00),  // Annahme: Frontqualitaet weiß matt, rund 20 % ueber der Korpusplatte (CLAUDE.md 7.1 kennt nur die Standardplatte)
      m('Griff Edelstahl 160 mm', 2, 'Stk', 12.00),              // CLAUDE.md 7.2: 5–40 €; zwei Tueren = zwei Griffe (vorher stand hier einer)
      m('Kleinmaterial (Sockelverstellfüße, Verbinder, Schrauben)', 1, 'psch', 4.00),  // Annahme: Restgroesse einer Korpus-Stueckliste; kein CLAUDE.md-Richtwert
    ],
    [
      z('Zuschnitt', 35),      // CLAUDE.md 3.1: 8–15 min je Platte — Seiten, Boden, Traversen, Einlegeboden, zwei Fronten
      z('Bekantung', 30),      // CLAUDE.md 3.1: 3–5 min/lfm — rund 8 lfm Sichtkanten (Korpusfront und Tuerumfang)
      z('CNC', 25),            // CLAUDE.md 3.1: Duebelloecher/Verbinder 5–10 min je Bauteil — Lochreihen beidseitig, 4 Topfbohrungen, Griffbohrungen, Verbinder
      z('Zusammenbau', 125),   // CLAUDE.md 3.1: Korpus 30–60 (55) + Rueckwand 15–25 (20) + Einlegeboden 10–20 (10) + 3.3: 2 Tueren à 15–25 (40)
      z('Warenhandling', 10),  // Annahme: Korpus ein-, aus- und umlagern, je Stueck
      z('Verpacken', 10),      // Annahme: Kantenschutz und Folie, je Stueck
    ], 5),
  p('Unterschrank mit drei Auszügen',
    'Korpus wie Drehtürschrank, statt Tür drei Blum-Legrabox-Auszüge mit Schubfronten weiß matt und Griffen.',
    [
      m('Dekorspanplatte 19 mm weiß (Korpus)', 1.8, 'm²', 25.00),  // Fabian 2026-09-17: 25 €/m²
      m('Rückwand 8 mm weiß', 0.5, 'm²', 10.00),  // Annahme wie oben
      m('Schubkasten Blum Legrabox', 3, 'Stk', 55.00),           // CLAUDE.md 7.2: 35–80 €
      m('Front Dekorspanplatte 19 mm weiß matt', 0.55, 'm²', 30.00),  // Annahme wie oben
      m('Griff Edelstahl 160 mm', 3, 'Stk', 12.00),  // CLAUDE.md 7.2: 5–40 €, drei Schubfronten = drei Griffe
      m('Kleinmaterial (Sockelverstellfüße, Verbinder, Schrauben)', 1, 'psch', 4.00),  // Annahme wie oben
    ],
    [
      z('Zuschnitt', 40),      // CLAUDE.md 3.1: 8–15 min je Platte — wie Drehtuerschrank plus drei Schubfronten
      z('Bekantung', 35),      // CLAUDE.md 3.1: 3–5 min/lfm — drei Fronten haben mehr Kante als zwei Tueren
      z('CNC', 30),            // CLAUDE.md 3.1: 5–10 min je Bauteil — Lochreihen, Auszugsbohrungen fuer drei Schienenpaare, Griffbohrungen
      z('Zusammenbau', 200),   // CLAUDE.md 3.1: Korpus 55 + Rueckwand 20 + 3.2: 3 Systemschuebe à 20–35 (30) + 3 Schubfronten à 10–20 (15) = 210, leicht gerundet
      z('Warenhandling', 10),  // Annahme, je Stueck
      z('Verpacken', 10),      // Annahme, je Stueck
    ], 3),
  p('Spülenunterschrank 900 mm',
    'Aufbau wie Drehtürschrank, 900 mm breit, Boden mit Schutzwanne, Rückwand für Anschlüsse ausgeschnitten, zwei Drehtüren. Spüle und Armatur stellt der Kunde.',
    [
      m('Dekorspanplatte 19 mm weiß (Korpus)', 2.2, 'm²', 25.00),  // Fabian 2026-09-17: 25 €/m²; 900 statt 600 mm breit
      m('Rückwand 8 mm weiß', 0.7, 'm²', 10.00),  // Annahme wie oben, breiterer Korpus
      m('Topfscharnier Blum gedämpft', 4, 'Stk', 2.50),  // CLAUDE.md 7.2
      m('Front Dekorspanplatte 19 mm weiß matt', 0.8, 'm²', 30.00),  // Annahme wie oben, zwei Tueren à 450 mm
      m('Griff Edelstahl 160 mm', 2, 'Stk', 12.00),  // CLAUDE.md 7.2; zwei Tueren = zwei Griffe
      m('Bodenschutzwanne Spülenschrank 900 mm', 1, 'Stk', 14.00),  // Annahme: Kunststoffwanne aus dem Beschlagkatalog; kein CLAUDE.md-Richtwert
      m('Kleinmaterial (Sockelverstellfüße, Verbinder, Schrauben)', 1, 'psch', 4.00),  // Annahme wie oben
    ],
    [
      z('Zuschnitt', 40),      // CLAUDE.md 3.1: 8–15 min je Platte — breiterer Korpus, Rueckwandausschnitte
      z('Bekantung', 30),      // CLAUDE.md 3.1: 3–5 min/lfm
      z('CNC', 30),            // CLAUDE.md 3.1: 5–10 min je Bauteil — Lochreihen, Topfbohrungen, Ausschnitte fuer Anschluesse
      z('Zusammenbau', 135),   // CLAUDE.md 3.1: Korpus 55 + Rueckwand 20 + Wanne einlegen 20 + 3.3: 2 Tueren à 20
      z('Warenhandling', 10),  // Annahme, je Stueck
      z('Verpacken', 10),      // Annahme, je Stueck
    ], 1),
  p('Oberschrank 900 mm hoch',
    'Korpus Dekorspanplatte 19 mm weiß, Rückwand 8 mm, zwei Drehtüren mit Blum-Topfscharnieren gedämpft, zwei Einlegeböden, Front weiß matt, zwei Griffe, Schrankaufhänger mit Wandschiene.',
    [
      m('Dekorspanplatte 19 mm weiß (Korpus)', 1.3, 'm²', 25.00),  // Fabian 2026-09-17: 25 €/m²; kleinerer Korpus, weniger m²
      m('Rückwand 8 mm weiß', 0.5, 'm²', 10.00),  // Annahme wie oben
      m('Topfscharnier Blum gedämpft', 4, 'Stk', 2.50),  // CLAUDE.md 7.2
      m('Front Dekorspanplatte 19 mm weiß matt', 0.45, 'm²', 30.00),  // Annahme wie oben, kleinere Frontflaeche
      m('Griff Edelstahl 160 mm', 2, 'Stk', 12.00),  // CLAUDE.md 7.2; zwei Tueren = zwei Griffe
      m('Schrankaufhänger mit Wandschiene', 1, 'Satz', 6.00),  // Annahme: verstellbarer Aufhaenger je Oberschrank; kein CLAUDE.md-Richtwert
    ],
    [
      z('Zuschnitt', 30),      // CLAUDE.md 3.1: 8–15 min je Platte — kleinerer Korpus als unten
      z('Bekantung', 25),      // CLAUDE.md 3.1: 3–5 min/lfm, kleinerer Korpus
      z('CNC', 25),            // CLAUDE.md 3.1: 5–10 min je Bauteil — Lochreihen fuer zwei Boeden, Topfbohrungen, Aufhaengerfraesung
      z('Zusammenbau', 110),   // CLAUDE.md 3.1: Korpus 45 + Rueckwand 15 + 2 Boeden 10 + 3.3: 2 Tueren à 20
      z('Warenhandling', 10),  // Annahme, je Stueck
      z('Verpacken', 10),      // Annahme, je Stueck
    ], 4),
  p('Arbeitsplatte Schichtstoff 38 mm',
    'Arbeitsplatte 5,80 lfm in L-Form mit Gehrungsstoß, Ausschnitten für Spüle und Kochfeld, Kanten umleimt, Wandabschlussleiste.',
    [
      m('Arbeitsplatte Schichtstoff 38 mm', 5.8, 'lfm', 55.00),  // Annahme: Schichtstoffplatte 38 mm nach lfm; Arbeitsplatten stehen nicht in CLAUDE.md 7.1
      m('Wandabschlussleiste', 5.8, 'lfm', 8.00),  // Annahme: Alu-/Kunststoffprofil mit Dichtung, Zubehoer zur Arbeitsplatte; kein CLAUDE.md-Richtwert
    ],
    [
      z('Zuschnitt', 90),      // CLAUDE.md 3.1: Zuschnitt + Formatieren — zwei Platten auf Laenge, Gehrungsstoss der L-Form
      z('CNC', 60),            // Annahme: zwei Ausschnitte (Spuele, Kochfeld) und Fraesungen fuer die Gehrungsverbinder; kein CLAUDE.md-Richtwert
      z('Zusammenbau', 120),   // Annahme: Kanten umleimen, Gehrung verleimen und verbinden, Wandabschlussleiste vorbereiten; kein CLAUDE.md-Richtwert
      z('Warenhandling', 15),  // Annahme: schwere Platten, zweimal umlagern
      z('Verpacken', 15),      // Annahme: Kantenschutz, Folie, Transportsicherung
    ]),
  p('Sockelblenden 100 mm',
    'Sockelblenden 5,80 lfm mit Dichtlippe, auf Sockelfüße geklipst.',
    [m('Sockelblende 100 mm weiß', 5.8, 'lfm', 6.00)],  // Annahme: beschichtete Sockelblende 100 mm inkl. Dichtlippe; kein CLAUDE.md-Richtwert
    [
      z('Zuschnitt', 30),      // CLAUDE.md 5.5: Blenden 8–15 min/lfm, hier reine Werkstattzeit
      z('Zusammenbau', 15),    // Annahme: Sockelclips setzen, Eckverbinder
    ]),
  p('Planung und Konstruktion',
    'Aufmaß vor Ort, Küchenplanung mit Ansichten, Konstruktion der Korpusse und Fronten, Arbeitsvorbereitung und Bestellung.',
    [],
    [
      z('Besprechung', 90),           // CLAUDE.md 2.1: Aufmaß komplexer Innenausbau 1,5–3,0 h
      z('Planung', 120),              // CLAUDE.md 2.1: Angebotserstellung 1,0–2,5 h
      z('Konstruktion', 240),         // CLAUDE.md 2.1: CAD Einbaumöbel mit Detailplanung 2,0–4,0 h
      z('Arbeitsvorbereitung', 120),  // CLAUDE.md 2.1: Angebotsskizze und Vorbereitung; hier für dreizehn Korpusse zusammen
    ]),
  p('Lieferung und Montage, Neubau',
    'Anlieferung 20 km, Korpusse aufstellen und ausrichten, Arbeitsplatte anpassen und anschließen, Fronten einstellen, Sockel setzen. Zwei Monteure, ein Tag.',
    [],
    [
      // ANNAHME (fuer Fabian zu pruefen): 2 Monteure × 8 h = 16 h = 960 min.
      // Gestuetzt auf CLAUDE.md 5.1 — "Raumhoher Schrank (2 Mann, 3 lfm, Neubau):
      // ca. 1 Tag" und 1,5–2,5 h/lfm, bei 5,8 lfm also 9–15 h reine Korpusmontage.
      // Oben drauf kommen Arbeitsplatte anpassen und anschliessen, Fronten
      // einstellen und Sockel setzen — deshalb das obere Ende plus Zuschlag.
      // Es gibt in CLAUDE.md keinen eigenen Richtwert fuer die Kuechenmontage;
      // die 960 min sind eine Setzung, kein abgelesener Wert.
      z('Montage', 960),
      z('Lieferung', 60),  // Annahme: Anfahrt 20 km mit beladenem Transporter, einmal je Küche
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
    // LACK: nur die FRONTEN werden lackiert (ca. 6,75 m² Frontflaeche). Traegermaterial
    // wechselt von Dekor 30 €/m² auf MDF roh 18 €/m², dazu 40 min/m² Oberflaeche
    // (CLAUDE.md 4.4: 35–55 min/m² 3-Schicht seidenmatt) und 4 €/m² Lack
    // (CLAUDE.md 4.6). Korpusse bleiben Dekor — so baut es jeder Betrieb.
    // BEIDSEITIG (Fabian 2026-09-17, "Ja verdoppeln"): Kuechenfronten werden vorne
    // und hinten gespritzt — Zeit und Lackmenge auf 2 × Frontflaeche. Vorher
    // einseitig, der Aufpreis lag bei nur 213 €.
    variante('lack', 'Alternative: Fronten weiß lackiert seidenmatt',
      'Fronten aus MDF roh, von uns grundiert, zwischengeschliffen und zweimal weiß seidenmatt lackiert. Korpusse bleiben Dekor weiß.',
      kuecheGrund, pos => {
        const flaeche = frontflaeche(pos)
        if (flaeche === 0) return pos
        const beidseitig = flaeche * 2
        return zeitPlus(
          mitMaterialzeile(
            tauscheMaterial(pos, 'Front', 'Front MDF roh 19 mm (Lackträger)', 18.00),  // CLAUDE.md 7.1: MDF 18 mm 30–50 €/Platte à 5,80 m² = 5–9 €/m² roh, mit Verschnitt und Zuschnitt 18 €/m² (Verhaeltnis wie Spanplatte 6–9,50 → 25)
            m('Lack: Grundierung + 2× Decklack seidenmatt (beidseitig)', beidseitig, 'm²', 4.00)),
          { 'Oberfläche': beidseitig * 40 })
      }),
    // MASSIV: Fronten Eiche massiv 110 €/m² (CLAUDE.md 7.1: 80–140 €/m²),
    // Werkstattzeit der Frontpositionen × 1,3 (CLAUDE.md 3.4: +30–60 %, unteres
    // Ende), dazu 20 min/m² zweimal oelen (CLAUDE.md 4.2: 20–30 min/m²) —
    // BEIDSEITIG wie die Lackvariante (CLAUDE.md 4.2: "Beide Seiten behandeln,
    // Schuesselung vermeiden"), also 2 × Frontflaeche.
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
          { 'Oberfläche': flaeche * 2 * 20 })
      }),
    // ALTBAU: Montage × 1,6 (CLAUDE.md 5.1 Altbau 2,5–4,0 gegen 1,5–2,5 h/lfm,
    // CLAUDE.md 8.2: +25–30 % plus fehlender Aufzug).
    variante('montage', 'Alternative: Montage im Altbau',
      'Wände nicht im Lot, alte Leitungen, kein Aufzug: Korpusse einzeln tragen, Anschlüsse anpassen, Arbeitsplatte an die Wand anscribeln, Sockel ausgleichen.',
      kuecheGrund, pos => zeitMal(pos, { Montage: 1.6 })),
  ],
  // CLAUDE.md 6.1: Einbauküche nach Maß 5.000–20.000 € netto.
  // OHNE Geräte, Spüle und Armatur — deshalb in der unteren Haelfte der Spanne.
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
      m('Türblatt Röhrenspan CPL weiß 860 × 1.985 mm', 1, 'Stk', 95.00),  // Annahme: aus CLAUDE.md 6.1 (Innentür liefern + montieren 350–800 €/Stk) und 6.2 zurückgerechnet, Materialanteil rund 55 %
      m('Umfassungszarge weiß, Wandstärke 120–140 mm', 1, 'Stk', 85.00),  // Annahme wie Türblatt: Zarge liegt erfahrungsgemäß knapp unter dem Türblatt
      m('Bänder, Buntbartschloss, Drückergarnitur Edelstahl', 1, 'Satz', 45.00),  // Annahme: Bänder V 3420 + Buntbartschloss + Drückergarnitur Edelstahl als Satz; Einzelbeschläge stehen nicht in CLAUDE.md 7.2
    ],
    [
      // FIX RUNDE 1 (Controller-Entscheid): Der Referenztext ist ausdrücklich
      // ALTBAU mit "Zargen kürzen" — die vorherigen 90 min Montage lagen am
      // unteren Rand von CLAUDE.md 5.2 und trafen die Grundfrage (180/230/270/
      // 320 €/Tür) nicht mehr, nachdem referenzAusProjekt() (Task R2) mit der
      // echten Serienstaffel statt der alten Formel rechnet. Angehoben, jeweils
      // im CLAUDE.md-Band:
      z('Zuschnitt', 30),      // CLAUDE.md 5.2: "Zimmertür kürzen (Säge vor Ort) 20–40 min" — Zarge kürzen, Werkstattanteil, Bandmitte
      z('Zusammenbau', 20),    // Zarge vorbereiten, Bänder und Schloss setzen (unverändert)
      z('Montage', 167),       // CLAUDE.md 5.2: "Innentür + Zarge (Altbau, Kürzen, Einpassen) 1,5–3,0 h" (90–180 min) — oberes Drittel, weil der Referenztext ausdrücklich alte Zarge/Kürzen nennt
      z('Lieferung', 15),  // Annahme: Anteil der Anfahrt (20 km) je Tür (unverändert)
    ], 5),
  p('Planung und Aufmaß',
    'Aufmaß der fünf Öffnungen, Wandstärken und Bandseiten festlegen, Bestellung und Arbeitsvorbereitung.',
    [],
    [
      // Fixsockel 112 min gesamt, Aufteilung wie beim gemessenen Einbauschrank
      // (0,13 / 0,19 / 0,39 / 0,29). ANNAHME in der Aufteilung.
      z('Besprechung', 15),          // CLAUDE.md 2.1: Aufmaß einfacher Raum 0,5–1,0 h
      z('Planung', 21),  // Fixsockel-Aufteilung wie beim gemessenen Einbauschrank (0,13 / 0,19 / 0,39 / 0,29 des Sockels)
      z('Konstruktion', 44),  // dieselbe Aufteilung
      z('Arbeitsvorbereitung', 32),  // dieselbe Aufteilung
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
      m('Geländer mit Füllstäben und Handlauf rund 42 mm', 1, 'Stk', 650.00),  // Annahme: Rest des Materialanteils (CLAUDE.md 6.2: Treppe 50–60 %) nach Abzug der Rohtreppe; Geländer stehen in 6.1 nur als Montagezeit
      m('Kleinmaterial (Dübel, Anker, Schrauben, Leim)', 1, 'psch', 120.00),  // Annahme: Befestigungs- und Verbrauchsmaterial als Pauschale; kein CLAUDE.md-Richtwert
    ],
    [
      z('Warenhandling', 40),  // Annahme: Treppe abladen, zwischenlagern, ans Treppenloch bringen
      z('Zuschnitt', 108),     // Wangen an Wand und Decke anpassen, Handlauf ablängen
      z('Zusammenbau', 162),   // CLAUDE.md 5.4: Geländer 30–60 min/lfm, Füllstäbe 60–90
      z('Oberfläche', 154),    // CLAUDE.md 4.1/4.2: Nacharbeit an den angepassten Teilen
    ]),
  p('Planung und Konstruktion',
    'Aufmaß am Rohbau, Steigungsverhältnis prüfen, Bestellzeichnung für den Treppenbauer, Arbeitsvorbereitung.',
    [],
    [
      // Fixsockel 269 min gesamt, aufgeteilt in denselben Anteilen wie beim
      // gemessenen Einbauschrank (0,13 / 0,19 / 0,39 / 0,29 — so stand es auch in
      // der abgeloesten SPECS-Formel in kalibrierung.ts). CLAUDE.md 2.1 stuetzt die
      // Groessenordnung: Aufmass komplexer Innenausbau 1,5–3,0 h, CAD mit
      // Detailplanung 2,0–4,0 h. ANNAHME in der Aufteilung, nicht gemessen.
      z('Besprechung', 35), z('Planung', 51), z('Konstruktion', 105), z('Arbeitsvorbereitung', 78),
    ]),
  p('Lieferung und Montage, Neubau',
    'Anlieferung 20 km, Treppe einbringen und aufstellen, an Wand und Decke anpassen, Auflager setzen, Geländer montieren.',
    [],
    [
      z('Montage', 752),   // CLAUDE.md 5.4: gerade Treppe 1–2 Tage (2 Mann) + Geländer
      z('Lieferung', 212),  // Annahme: Speditionsgut, zwei Mann beim Abladen und Einbringen
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
      m('Eiche massiv 60 mm (Wangengestell)', 1.3, 'm²', 140.00),  // CLAUDE.md 7.1: Eiche massiv 25 mm 80–140 €/m²; 60 mm am oberen Ende
      m('Hartwachsöl', 1.5, 'l', 22.00),                     // CLAUDE.md 4.6: 80–120 ml/m² je Auftrag
      m('Kleinmaterial (Metall-Zarge, Nutensteine, Schrauben)', 1, 'psch', 25.00),  // Annahme: Tischbeschlag als Pauschale; kein CLAUDE.md-Richtwert
    ],
    [
      z('Zuschnitt', 242),     // CLAUDE.md 3.4: Abrichten und Hobeln 3–8 min/lfm, Lamellen zuschneiden
      // ANNAHME (fuer Fabian zu pruefen): 485 min. CLAUDE.md 3.4 gibt fuer das
      // Verleimen von Massivholzplatten 30–60 min/m² Leimflaeche — auf 2,1 m²
      // Platte sind das 63–126 min. Der Rest ist Gestellbau (Wangen zapfen,
      // Metall-Zarge einlassen, Pressen und Ausrichten), fuer den CLAUDE.md keinen
      // eigenen Richtwert kennt. Die 485 min sind eine Setzung.
      z('Zusammenbau', 485),
      z('Warenhandling', 39),  // Annahme: Rohware holen, Platte mehrfach umlegen (schweres Einzelstück)
      z('Verpacken', 29),      // Annahme: Kantenschutz, Decken, Verzurren für den Transport
      z('Oberfläche', 334),    // CLAUDE.md 4.1 + 4.2: Schleifen 8–15 min/m² + 2× ölen 20–30 min/m², beidseitig
    ]),
  p('Planung und Konstruktion',
    'Entwurf, Maßabstimmung, Konstruktion von Platte und Gestell, Holzauswahl und Arbeitsvorbereitung.',
    [],
    // Fixsockel 233 min gesamt, in denselben Anteilen aufgeteilt wie beim
    // gemessenen Einbauschrank (0,13 / 0,19 / 0,39 / 0,29 — Aufteilung der
    // abgeloesten SPECS-Formel). CLAUDE.md 2.1: Angebotsskizze 0,5–1,5 h,
    // CAD einfaches Möbel 1,0–2,0 h. ANNAHME in der Aufteilung, nicht gemessen.
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
 * Das Referenzprojekt fuer einen Betrieb OHNE bestimmte Maschinen: Die Minuten der
 * abgeschalteten Kostenstellen (CNC, Bekantung) wandern × 1,6 auf den Zusammenbau —
 * genau die Regel, mit der die Kalkulation dieses Betriebs rechnet (bucheUm in
 * handarbeit.ts). Sonst stuende in der Referenz eine CNC-Zeile zu 120 €/h, die es
 * in diesem Betrieb gar nicht gibt, und die Antwortbaender waeren gegen ein Moebel
 * gebaut, das er so nie kalkuliert bekommt.
 *
 * Nur Kostenstellen mit einem Handarbeits-Ziel (HANDARBEIT_ZIEL) werden umgebucht.
 * "Montage nie" veraendert die Referenz NICHT: Die Montagefrage misst eine Dauer,
 * ohne Montagezeile gaebe es kein Band mehr.
 *
 * Gibt eine KOPIE zurueck; die Vorlage bleibt unberuehrt. Ohne betroffene
 * Kostenstelle kommt das Projekt unveraendert zurueck.
 */
export function umgebucht(projekt: Referenzprojekt, deaktiviert: Iterable<string>): Referenzprojekt {
  const betroffen = new Set([...deaktiviert].filter(k => k in HANDARBEIT_ZIEL))
  if (betroffen.size === 0) return projekt
  return {
    ...projekt,
    positionen: projekt.positionen.map(q => ({
      ...q,
      arbeitszeit: bucheUm(q.arbeitszeit.map(a => ({ ...a })), betroffen, STANDARDSAETZE_REFERENZ)
        .map(a => (a.id ? a : { ...a, id: ++zeilenId })),
    })),
  }
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
): { imRahmen: boolean; text: string; anzeigen: boolean } {
  // Fabian 2026-09-17: "Faustregel 5.000–20.000 € liegt im Rahmen" unter der Kueche
  // "sollte dort nicht stehen. Die Spanne ist zu gross und verwirrt." Eine Spanne,
  // deren oberes Ende mehr als das Dreifache des unteren ist, sagt dem Nutzer
  // nichts — sie bleibt Kontrolle in den Tests, wird aber nicht angezeigt.
  const anzeigen = f.bis <= f.von * FAUSTREGEL_MAX_SPANNE
  const spanne = `Faustregel ${eur(f.von)}–${eur(f.bis)}`
  if (netto < f.von) {
    return { imRahmen: false, anzeigen, text: `${spanne} — liegt darunter: prüfe Materialansatz, Stundensätze, Zeitrichtwerte.` }
  }
  if (netto > f.bis) {
    return { imRahmen: false, anzeigen, text: `${spanne} — liegt darüber: prüfe Materialansatz, Stundensätze, Zeitrichtwerte.` }
  }
  return { imRahmen: true, anzeigen, text: `${spanne} — liegt im Rahmen.` }
}

/** Breiter als das Dreifache: nur noch Kontrolle, keine Anzeige (Kueche 5.000–20.000 €). */
export const FAUSTREGEL_MAX_SPANNE = 3

/** Die Projektdaten, die "Als Projekt öffnen" fürs Angebot-Objekt braucht. */
export type ReferenzprojektDaten = {
  kunde: { name: string; zusatz: string; strasse: string; ort: string; projekt: string }
  pos: Angebotsposition[]
  docNr: string
  docTyp: 'Angebot'
  anschr: string
  widerruf: boolean
  angebotsdatum: string
  bausteinIds: string[]
}

/**
 * Baut die Projektdaten fuer "Als Projekt öffnen" — GENAU die Form, in der die App
 * ein Projekt selbst speichert (uebernehmeKiErgebnis/saveProject in page.tsx):
 * kunde, pos, docNr, docTyp, anschr, widerruf, angebotsdatum, bausteinIds.
 *
 * `heute` kommt von aussen (types.ts: today()) — diese Datei bleibt importfrei bis
 * auf types.ts (Dateikopf), today() gehoert schon dorthin.
 *
 * Die Positionen bekommen frische, fortlaufende IDs (1..n) statt der IDs aus dem
 * gemeinsamen Zaehler in dieser Datei — ein neues Projekt faengt bei sich selbst an.
 * `variante` ist nur eine interne Markierung dieser Datei (siehe ReferenzPosition)
 * und gehoert nicht in Angebotsposition, wie die App sie kennt — wird gestrichen,
 * `alternativ` bleibt.
 */
export function projektDatenAus(
  projekt: Referenzprojekt, positionen: ReferenzPosition[], heute: string,
): ReferenzprojektDaten {
  const pos: Angebotsposition[] = positionen.map((q, i) => {
    const { variante: _variante, ...rest } = q
    return { ...rest, id: i + 1 }
  })
  return {
    kunde: {
      name: projekt.kunde.name,
      zusatz: '',
      strasse: projekt.kunde.strasse,
      ort: projekt.kunde.ort,
      projekt: projekt.kunde.projekt,
    },
    pos,
    docNr: '',
    docTyp: 'Angebot',
    anschr: '',
    widerruf: false,
    angebotsdatum: heute,
    bausteinIds: [],
  }
}
