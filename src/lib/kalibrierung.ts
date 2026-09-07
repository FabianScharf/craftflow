// Betriebskalibrierung: fest hinterlegte Referenzkalkulation und die daraus
// abgeleiteten Zeitfaktoren.
//
// Importiert bewusst NICHTS — wie learn.ts, lernwerkzeuge.ts, laufmeter.ts.
// Alles, was Supabase braucht, liegt in kalibrierungsspeicher.ts.
//
// WARUM FEST HINTERLEGT: Ein KI-Aufruf mitten im Onboarding wuerde ein bis zwei
// Minuten dauern, Geld kosten und bei jedem Nutzer leicht andere Zahlen liefern —
// der Faktor waere nicht reproduzierbar. Die Zahlen unten stammen aus der gemessenen
// Kalkulation vom 2026-09-07 (nach dem Laufmeter-Fix), gerundet auf Richtwerte.

export type Saetze = Record<string, number>
export type Zeitposten = { kostenstelle: string; minuten: number }

// Grundmoebel: Einbauschrank Flur 2,00 x 2,40 x 0,60 m, Egger Dekor weiss,
// 4 Drehtueren, 2 Schubkaesten auf Systemauszuegen, Kleiderstange, je Fach
// 2 Einlegeboeden, Sockel, Rueckwand, Montage im Neubau, 20 km.
export const REFERENZ = {
  materialEk: 409.5,
  fixsockel: [
    { kostenstelle: 'Besprechung', minuten: 20 },
    { kostenstelle: 'Planung', minuten: 30 },
    { kostenstelle: 'Konstruktion', minuten: 60 },
    { kostenstelle: 'Arbeitsvorbereitung', minuten: 45 },
  ] as Zeitposten[],
  werkstatt: [
    { kostenstelle: 'Zuschnitt', minuten: 216 },
    { kostenstelle: 'Bekantung', minuten: 190 },
    { kostenstelle: 'Zusammenbau', minuten: 479 },
    { kostenstelle: 'Warenhandling', minuten: 20 },
    { kostenstelle: 'Produktion', minuten: 30 },
    { kostenstelle: 'Verpacken', minuten: 30 },
  ] as Zeitposten[],
  montage: [
    { kostenstelle: 'Montage', minuten: 240 },
    { kostenstelle: 'Lieferung', minuten: 70 },
  ] as Zeitposten[],
  lackMinuten: 600,
  lackMaterialEk: 60,
  massivMaterialEk: 1770,
  massivWerkstattFaktor: 1.3,
  massivOberflaecheMinuten: 300,
  altbauFaktor: 1.6,
} as const

// Welche Kostenstelle von welchem Faktor beruehrt wird. Liegt auf den
// KOSTENSTELLEN_GRUPPEN aus types.ts, hier absichtlich ohne Import wiederholt.
export const WERKSTATT_KS = [
  'Zuschnitt', 'Bekantung', 'CNC', 'Zusammenbau', 'Warenhandling', 'Produktion', 'Verpacken',
]
export const OBERFLAECHE_KS = ['Oberfläche']
export const MONTAGE_KS = ['Montage', 'Lieferung']
// Besprechung, Planung, Konstruktion, Arbeitsvorbereitung bleiben unberuehrt: Sie
// decken einen Sockel ab, der nicht mit der Betriebsgroesse skaliert.

export type Band = { schluessel: string; text: string; mitte: number | null }

export const BAENDER: Record<string, Band[]> = {
  grund: [
    { schluessel: 'unter-1200', text: 'unter 1.200 €',   mitte: 1000 },
    { schluessel: '1200-1600',  text: '1.200 – 1.600 €', mitte: 1400 },
    { schluessel: '1600-2100',  text: '1.600 – 2.100 €', mitte: 1850 },
    { schluessel: '2100-2700',  text: '2.100 – 2.700 €', mitte: 2400 },
    { schluessel: 'ueber-2700', text: 'über 2.700 €',    mitte: 3100 },
  ],
  lack: [
    { schluessel: '200-400',   text: '+ 200 – 400 €',     mitte: 300 },
    { schluessel: '400-700',   text: '+ 400 – 700 €',     mitte: 550 },
    { schluessel: '700-1100',  text: '+ 700 – 1.100 €',   mitte: 900 },
    { schluessel: '1100-1600', text: '+ 1.100 – 1.600 €', mitte: 1350 },
    { schluessel: 'mehr',      text: 'mehr',              mitte: 1900 },
    { schluessel: 'nicht',     text: 'mache ich nicht',        mitte: null },
    { schluessel: 'unbekannt', text: 'weiß ich gerade nicht',  mitte: null },
  ],
  massiv: [
    { schluessel: 'unter-2500', text: 'unter 2.500 €',   mitte: 2200 },
    { schluessel: '2500-3500',  text: '2.500 – 3.500 €', mitte: 3000 },
    { schluessel: '3500-4500',  text: '3.500 – 4.500 €', mitte: 4000 },
    { schluessel: '4500-6000',  text: '4.500 – 6.000 €', mitte: 5250 },
    { schluessel: 'ueber-6000', text: 'über 6.000 €',    mitte: 7000 },
    { schluessel: 'nicht',      text: 'mache ich nicht',       mitte: null },
    { schluessel: 'unbekannt',  text: 'weiß ich gerade nicht', mitte: null },
  ],
  // In Tagen, weil ein Schreiner so darueber denkt. 1 Tag = 480 min.
  montage: [
    { schluessel: 'halber-tag', text: 'ein halber Tag',  mitte: 240 },
    { schluessel: 'ein-tag',    text: 'ein Tag',         mitte: 480 },
    { schluessel: 'anderthalb', text: 'anderthalb Tage', mitte: 720 },
    { schluessel: 'zwei-tage',  text: 'zwei Tage',       mitte: 960 },
    { schluessel: 'laenger',    text: 'länger',          mitte: 1250 },
    { schluessel: 'nicht',      text: 'montiere ich nicht',    mitte: null },
    { schluessel: 'unbekannt',  text: 'weiß ich gerade nicht', mitte: null },
  ],
}

// Die fuenf Betriebsfragen. Liegen hier, damit Erst-Anmeldung und Einstellungen
// dieselbe Quelle nutzen — zwei Listen wuerden auseinanderlaufen.
export const BETRIEBSFRAGEN: Record<string, Band[]> = {
  mitarbeiter: [
    { schluessel: 'solo', text: 'nur ich',    mitte: null },
    { schluessel: '2-3',  text: '2 bis 3',    mitte: null },
    { schluessel: '4-10', text: '4 bis 10',   mitte: null },
    { schluessel: 'mehr', text: 'mehr',       mitte: null },
  ],
  maschinen: [
    { schluessel: 'formatsaege',   text: 'Formatkreissäge',      mitte: null },
    { schluessel: 'kantenanleim',  text: 'Kantenanleimmaschine', mitte: null },
    { schluessel: 'cnc',           text: 'CNC',                  mitte: null },
    { schluessel: 'lackierkabine', text: 'Lackierkabine',        mitte: null },
    { schluessel: 'keine',         text: 'keine davon',          mitte: null },
  ],
  schwerpunkt: [
    { schluessel: 'moebel',      text: 'Möbel nach Maß',                 mitte: null },
    { schluessel: 'innenausbau', text: 'Innenausbau und Einbauschränke', mitte: null },
    { schluessel: 'kuechen',     text: 'Küchen',                         mitte: null },
    { schluessel: 'tueren',      text: 'Türen und Böden',                mitte: null },
    { schluessel: 'gemischt',    text: 'gemischt',                       mitte: null },
  ],
  montage_selbst: [
    { schluessel: 'immer',    text: 'immer',    mitte: null },
    { schluessel: 'manchmal', text: 'manchmal', mitte: null },
    { schluessel: 'nie',      text: 'nie',      mitte: null },
  ],
  stueckzahlen: [
    { schluessel: 'einzel',   text: 'fast nur Einzelstücke', mitte: null },
    { schluessel: 'gemischt', text: 'gemischt',              mitte: null },
    { schluessel: 'serien',   text: 'oft Serien',            mitte: null },
  ],
}

const MIN_FAKTOR = 0.6
const MAX_FAKTOR = 1.4

export function deckele(faktor: number): number {
  if (!Number.isFinite(faktor)) return 1
  return Math.min(MAX_FAKTOR, Math.max(MIN_FAKTOR, Math.round(faktor * 100) / 100))
}

function wert(posten: readonly Zeitposten[], saetze: Saetze, faktor = 1): number {
  return posten.reduce((s, p) => s + (p.minuten * faktor / 60) * (saetze[p.kostenstelle] ?? 65), 0)
}

export function referenzPreis(saetze: Saetze, aufschlag: number) {
  const material  = REFERENZ.materialEk * (1 + aufschlag)
  const fixsockel = wert(REFERENZ.fixsockel, saetze)
  const werkstatt = wert(REFERENZ.werkstatt, saetze)
  const montage   = wert(REFERENZ.montage, saetze)
  return { material, fixsockel, werkstatt, montage, gesamt: material + fixsockel + werkstatt + montage }
}

// Testschluessel "test:<zahl>" erlaubt es, die Bandmitte im Test genau auf den
// eigenen Referenzpreis zu setzen. In der Oberflaeche kommt so ein Wert nie vor.
function mitte(frage: string, schluessel: string): number | null {
  if (schluessel.startsWith('test:')) {
    const z = Number(schluessel.slice(5))
    return Number.isFinite(z) ? z : null
  }
  const band = (BAENDER[frage] ?? []).find(b => b.schluessel === schluessel)
  return band ? band.mitte : null
}

export type Antworten = { grund: string; lack: string; massiv: string; montage: string }
export type Faktoren = { werkstatt: number; oberflaeche: number; massivholz: number; montage: number }

/**
 * Leitet die vier Faktoren aus den Antworten ab.
 *
 *   Faktor = (Zahl des Nutzers − unser Materialanteil − nicht skalierbarer Sockel)
 *            ─────────────────────────────────────────────────────────────────────
 *                       unser skalierbarer Zeitanteil in diesem Bereich
 *
 * Nicht beantwortet, "nicht" oder "unbekannt" ergeben immer genau 1,0 — eine
 * uebersprungene Frage darf nirgends wie eine beantwortete aussehen.
 */
export function berechneFaktoren(a: Antworten, saetze: Saetze, aufschlag: number): Faktoren {
  const r = referenzPreis(saetze, aufschlag)
  const f: Faktoren = { werkstatt: 1, oberflaeche: 1, massivholz: 1, montage: 1 }

  // Die Differenz faellt auf ALLE skalierbare Arbeitszeit, nicht nur auf die
  // Werkstatt. Nur auf den Werkstattblock gerechnet, sprang der Faktor zwischen
  // benachbarten Baendern um 0,46 (gemessen 2026-09-07) — jedes Band waere ein
  // Sprung ins Extrem gewesen.
  const grund = mitte('grund', a.grund)
  const skalierbar = r.werkstatt + r.montage
  if (grund !== null && skalierbar > 0) {
    f.werkstatt = deckele((grund - r.material - r.fixsockel) / skalierbar)
    // Ohne eigene Montage-Antwort erbt die Montage die Geschwindigkeit des Betriebs.
    f.montage = f.werkstatt
  }

  const lack = mitte('lack', a.lack)
  if (lack !== null) {
    const lackMaterial = REFERENZ.lackMaterialEk * (1 + aufschlag)
    const lackZeitwert = (REFERENZ.lackMinuten / 60) * (saetze['Oberfläche'] ?? 72)
    if (lackZeitwert > 0) f.oberflaeche = deckele((lack - lackMaterial) / lackZeitwert)
  }

  const massiv = mitte('massiv', a.massiv)
  if (massiv !== null) {
    const massivMaterial = REFERENZ.massivMaterialEk * (1 + aufschlag)
    const massivWerkstatt = wert(REFERENZ.werkstatt, saetze, REFERENZ.massivWerkstattFaktor)
    const massivOberflaeche = (REFERENZ.massivOberflaecheMinuten / 60) * (saetze['Oberfläche'] ?? 72)
    const zeitanteil = massivWerkstatt + massivOberflaeche
    if (zeitanteil > 0) {
      f.massivholz = deckele((massiv - massivMaterial - r.fixsockel - r.montage) / zeitanteil)
    }
  }

  // Gefragt wird die ALTBAU-Dauer in Tagen, verglichen gegen unsere Altbau-Erwartung
  // (Neubau x 1,6, ohne Fahrt). Der Faktor gilt dann fuer alle Montage; der
  // Altbau-Zuschlag selbst bleibt Sache der Engine.
  // Ueberschreibt die geerbte Montage, wenn ausdruecklich beantwortet.
  const montage = mitte('montage', a.montage)
  if (montage !== null) {
    const basis = REFERENZ.montage.find(p => p.kostenstelle === 'Montage')?.minuten ?? 240
    const erwartetMin = basis * REFERENZ.altbauFaktor
    if (erwartetMin > 0) f.montage = deckele(montage / erwartetMin)
  }

  return f
}
