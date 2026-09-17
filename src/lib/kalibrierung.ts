// Betriebskalibrierung: die Referenzkalkulationen (siehe referenzprojekte.ts) und
// die daraus abgeleiteten Zeitfaktoren.
//
// Importiert referenzprojekte.ts (Daten der fuenf Referenzprojekte) und types.ts
// (Stueckzahl/Serienstaffel-Formeln — dieselben, mit denen App, PDF und Export
// rechnen). Beides importfreie oder fast importfreie reine Rechenmodule, kein React,
// kein Supabase. Alles, was Supabase braucht, liegt in kalibrierungsspeicher.ts.
//
// WARUM FEST HINTERLEGT: Ein KI-Aufruf mitten im Onboarding wuerde ein bis zwei
// Minuten dauern, Geld kosten und bei jedem Nutzer leicht andere Zahlen liefern —
// der Faktor waere nicht reproduzierbar.
//
// STAND 2026-09-17 (Task R2): Vorher entstand die Bandbasis aus einer FORMEL
// (SPECS/baueReferenz) — Faustregelpreis mal Materialanteil, die Minuten rueckwaerts
// daraus. Jetzt kommt sie aus referenzAusProjekt() direkt aus den Stuecklisten in
// referenzprojekte.ts (Task R1). Kein Preis mehr aus einer Faustregel.

import { REFERENZPROJEKTE } from './referenzprojekte.ts'
import type { Referenzprojekt, ReferenzPosition, Variante } from './referenzprojekte.ts'
import { stueckzahlVon, zeitFaktorFuer, materialRabatt, normalizeKsId } from './types.ts'

export type Saetze = Record<string, number>
export type Zeitposten = { kostenstelle: string; minuten: number }

// Welche Kostenstelle von welchem Faktor beruehrt wird. Liegt auf den
// KOSTENSTELLEN_GRUPPEN aus types.ts, hier absichtlich als eigene Liste gefuehrt
// (referenzAusProjekt unten gruppiert die Zeitposten der Referenzprojekte damit).
export const WERKSTATT_KS = [
  'Zuschnitt', 'Bekantung', 'CNC', 'Zusammenbau', 'Warenhandling', 'Produktion', 'Verpacken',
]
export const OBERFLAECHE_KS = ['Oberfläche']
export const MONTAGE_KS = ['Montage', 'Lieferung']
// Besprechung, Planung, Konstruktion, Arbeitsvorbereitung bleiben unberuehrt: Sie
// decken einen Sockel ab, der nicht mit der Betriebsgroesse skaliert.

type Kostenstellengruppe = 'fix' | 'werkstatt' | 'montage'

function gruppeVon(kostenstelle: string): Kostenstellengruppe {
  if (MONTAGE_KS.includes(kostenstelle)) return 'montage'
  if (WERKSTATT_KS.includes(kostenstelle) || OBERFLAECHE_KS.includes(kostenstelle)) return 'werkstatt'
  return 'fix'
}

// Die Standardsaetze der Handwerkskammer. Hier (statt weiter unten bei den
// Antwortskalen) definiert, weil referenzAusProjekt() sie schon beim Aufbau der
// Bandbasis braucht (Lack-/Massiv-Anker als ECHTE Preisdifferenz der Alternative,
// siehe unten) — REFERENZ/REFERENZEN entstehen bei Modulstart, vor der spaeteren
// STANDARDSAETZE-Nutzung in baueBaender/berechneFaktoren. Absichtlich hier
// wiederholt statt importiert (siehe Dateikopf): Sie bestimmen nur die
// Beschriftung/den Anker; gerechnet wird spaeter mit den Saetzen des Nutzers.
const STANDARDSAETZE: Saetze = {
  Besprechung: 65, Planung: 85, Konstruktion: 75, Arbeitsvorbereitung: 75,
  Produktion: 65, Warenhandling: 65, Zuschnitt: 72, Bekantung: 100, CNC: 120,
  'Oberfläche': 72, Zusammenbau: 65, Verpacken: 65, Azubi: 52,
  Montage: 65, Lieferung: 65,
}

/**
 * Arbeitspreis (EUR) einer Positionsliste bei den angegebenen Saetzen — Stueckzahl
 * UND Serienstaffel eingerechnet (zeitFaktorFuer), ueber ALLE Kostenstellen. Bei
 * einer Alternativposition (stueckzahl 1) ist zeitFaktorFuer immer genau 1, das
 * ist dann einfach ihr eigener Arbeitspreis — dieselbe Rechnung wie
 * arbeitszeitPreisPos in types.ts.
 */
function arbeitspreisVon(positionen: readonly ReferenzPosition[], saetze: Saetze): number {
  return positionen.reduce((summe, pos) => {
    const n = stueckzahlVon(pos)
    return summe + pos.arbeitszeit.reduce((s, a) =>
      s + (a.minuten / 60) * (saetze[a.kostenstelle] ?? 65) * zeitFaktorFuer(normalizeKsId(a.kostenstelle), n), 0)
  }, 0)
}

/** Wie arbeitspreisVon, aber nur die Werkstatt-Kostenstellen OHNE Oberflaeche. */
function werkstattpreisReinerVon(positionen: readonly ReferenzPosition[], saetze: Saetze): number {
  return positionen.reduce((summe, pos) => {
    const n = stueckzahlVon(pos)
    return summe + pos.arbeitszeit
      .filter(a => gruppeVon(a.kostenstelle) === 'werkstatt' && a.kostenstelle !== 'Oberfläche')
      .reduce((s, a) => s + (a.minuten / 60) * (saetze[a.kostenstelle] ?? 65) * zeitFaktorFuer(normalizeKsId(a.kostenstelle), n), 0)
  }, 0)
}

/**
 * Effektive Minuten EINER Kostenstelle ueber eine Positionsliste — Stueckzahl UND
 * Serienstaffel eingerechnet, exakt wie stundenPos in types.ts (zeitFaktorFuer
 * deckt Fixkosten/Montage/Werkstatt bereits unterschiedlich ab). Bei einer
 * Alternativposition (stueckzahl 1) ist das einfach ihr eigener Wert.
 */
function minutenVon(positionen: readonly ReferenzPosition[], kostenstelle: string): number {
  return positionen.reduce((summe, pos) => {
    const n = stueckzahlVon(pos)
    return summe + pos.arbeitszeit
      .filter(a => a.kostenstelle === kostenstelle)
      .reduce((s, a) => s + a.minuten * zeitFaktorFuer(normalizeKsId(a.kostenstelle), n), 0)
  }, 0)
}

/** Dieselbe Rechnung wie minutenVon, aber ueber eine ganze Kostenstellengruppe. */
function minutenGruppe(positionen: readonly ReferenzPosition[], gruppe: Kostenstellengruppe): number {
  return positionen.reduce((summe, pos) => {
    const n = stueckzahlVon(pos)
    return summe + pos.arbeitszeit
      .filter(a => gruppeVon(a.kostenstelle) === gruppe)
      .reduce((s, a) => s + a.minuten * zeitFaktorFuer(normalizeKsId(a.kostenstelle), n), 0)
  }, 0)
}

/** Zeitposten einer Gruppe, je Kostenstelle summiert — Grundlage von fixsockel/werkstatt/montage. */
function zeitJeGruppe(positionen: readonly ReferenzPosition[], gruppe: Kostenstellengruppe): Zeitposten[] {
  const summen = new Map<string, number>()
  for (const pos of positionen) {
    const n = stueckzahlVon(pos)
    for (const a of pos.arbeitszeit) {
      if (gruppeVon(a.kostenstelle) !== gruppe) continue
      summen.set(a.kostenstelle, (summen.get(a.kostenstelle) ?? 0) + a.minuten * zeitFaktorFuer(normalizeKsId(a.kostenstelle), n))
    }
  }
  return [...summen.entries()].map(([kostenstelle, minuten]) => ({ kostenstelle, minuten: Math.round(minuten) }))
}

/** Material-EK (ohne Aufschlag) einer Positionsliste, mit Stueckzahl und Materialrabatt-Staffel. */
function materialEkVon(positionen: readonly ReferenzPosition[]): number {
  return positionen.reduce((summe, pos) => {
    const n = stueckzahlVon(pos)
    const faktor = n * (1 - materialRabatt(n))
    return summe + pos.material.reduce((s, x) => s + x.menge * x.ekPreis * faktor, 0)
  }, 0)
}

/**
 * Baut die Bandbasis eines Referenzmoebels direkt aus seinem Referenzprojekt
 * (referenzprojekte.ts): Grundsumme aus den Grundpositionen, die drei Zusatzfragen
 * (Lack, Massiv, Montage) aus der jeweiligen Alternativposition. Eine Alternativ-
 * position beschreibt IMMER das ganze Projekt (fasseZusammen in referenzprojekte.ts),
 * nicht nur den Unterschied — deshalb wird hier die Differenz zur Grundsumme gebildet.
 *
 * WICHTIG bei "massiv": massivMaterialEk ist der GESAMTPREIS mit Massivholz —
 * Grundmaterial plus die Differenz der Massiv-Alternative, NICHT ein Ersatzwert.
 * Sonst saehe eine Kueche, bei der nur die Fronten wechseln, so aus, als waere das
 * ganze Projekt neu bepreist.
 *
 * Fehlt eine Alternative (Treppe/Tisch fragen nicht nach Massivholz — sie SIND schon
 * massiv), bleibt der jeweilige Faktor neutral (1,0 bzw. 0 Minuten Differenz): Die
 * Frage wird ohnehin nicht gestellt (siehe mitBaendern), der Wert wird nirgends gelesen.
 */
export function referenzAusProjekt(p: Referenzprojekt) {
  const grund = p.positionen.filter(q => !q.alternativ)
  const alternative = (v: Variante) => p.positionen.find(q => q.alternativ && q.variante === v)

  const materialEk = materialEkVon(grund)
  const grundLabour = arbeitspreisVon(grund, STANDARDSAETZE)
  const grundWerkstattReiner = werkstattpreisReinerVon(grund, STANDARDSAETZE)
  const grundOberflaeche = minutenVon(grund, 'Oberfläche')
  const grundMontageGesamt = minutenGruppe(grund, 'montage')

  const lackPos = alternative('lack')
  const lackMaterial = lackPos ? materialEkVon([lackPos]) : materialEk
  // FIX RUNDE 2 (Controller-Fund, Live-Preview Einbauschrank): Die Preisdifferenz
  // der Lack-Alternative muss ueber ALLE Kostenstellen gebildet werden, nicht nur
  // ueber Oberflaeche — sonst fehlt z.B. beim Einbauschrank die eingesparte
  // Bekantung (190 min à 100 €/h), und der Anker "CraftFlow rechnet + 441 € dazu"
  // fiel in Band 1 statt 3 (die alte Rechnung kam auf +758 €, weil sie nur die
  // ZUSAETZLICHEN Oberflaeche-Minuten zaehlte). Der Preis-Delta bei STANDARDSAETZE
  // wird danach in ein Oberflaeche-Minuten-Aequivalent zurueckgerechnet (÷
  // Oberflaeche-Satz), damit baueBaender/berechneFaktoren dieselbe Formel wie
  // bisher (lackZeitwert = lackMinuten/60 × Oberflaeche-Satz) weiterverwenden
  // koennen und trotzdem die ECHTE Preisdifferenz reproduzieren.
  const lackLabourDelta = lackPos ? arbeitspreisVon([lackPos], STANDARDSAETZE) - grundLabour : 0

  const massivPos = alternative('massiv')
  // Verhaeltnis der WERKSTATTPREISE (bei STANDARDSAETZE), nicht der rohen Minuten:
  // Eine Kostenstelle mit hohem Satz (Bekantung 100 €/h), die in der Massiv-
  // Alternative komplett wegfaellt, wuerde ein reines Minutenverhaeltnis zu klein
  // ausweisen. Kleinere Nebenwirkung desselben Fundes wie bei "lack" oben.
  const massivWerkstattReiner = massivPos ? werkstattpreisReinerVon([massivPos], STANDARDSAETZE) : grundWerkstattReiner
  const massivOberflaeche = massivPos ? minutenVon([massivPos], 'Oberfläche') : grundOberflaeche
  const massivMaterial = massivPos ? materialEkVon([massivPos]) : materialEk

  // FIX RUNDE 2 (R4-Review): Die Montagefrage misst die ON-SITE-ZEIT der Montage-
  // Alternative direkt — Montage UND Lieferung, weil wendeFaktorenAn (zeitfaktoren.ts)
  // den Montagefaktor auf BEIDE Kostenstellen anwendet. Keine Ableitung mehr aus
  // "Grund-Montage-Minuten × altbauFaktor" (Feld entfaellt) — das Feld unten
  // (montageMinuten) IST bereits die volle erwartete Alternativzeit.
  const montagePos = alternative('montage')
  const montageAltMinuten = montagePos ? minutenGruppe([montagePos], 'montage') : grundMontageGesamt

  return {
    // Rueckweg zum Referenzprojekt (referenzprojekte.ts REFERENZPROJEKTE) — Task R3
    // braucht Kunde, Positionen und Faustregel des ganzen Projekts, nicht nur die
    // Bandbasis. Ohne dieses Feld haette die Route raten muessen, welches Projekt
    // zu einem Referenzmoebel gehoert.
    schluessel: p.schluessel,
    name: p.name,
    text: p.text,
    fragen: p.fragen,
    fragenHinweis: p.fragenHinweis ?? {},
    // Referenzprojekt.ohneMaterial ist auf 'grund'|'massiv' eingeschraenkt (nur dort
    // gibt es ueberhaupt einen Materialwert im Sockel) — hier auf die volle
    // Fragenschluessel-Union geweitet, die baueBaender/berechneFaktoren erwarten.
    ohneMaterial: (p.ohneMaterial ?? []) as Fragenschluessel[],
    teiler: p.teiler ?? {},
    materialEk: Math.round(materialEk),
    fixsockel: zeitJeGruppe(grund, 'fix'),
    werkstatt: zeitJeGruppe(grund, 'werkstatt'),
    montage: zeitJeGruppe(grund, 'montage'),
    lackMinuten: Math.round(lackLabourDelta * 60 / STANDARDSAETZE['Oberfläche']),
    lackMaterialEk: Math.round(lackMaterial - materialEk),
    massivMaterialEk: Math.round(materialEk + (massivMaterial - materialEk)),
    massivWerkstattFaktor: grundWerkstattReiner > 0 ? massivWerkstattReiner / grundWerkstattReiner : 1,
    massivOberflaecheMinuten: Math.round(massivOberflaeche - grundOberflaeche),
    // Ersetzt das fruehere "altbauFaktor" (Verhaeltnis) — siehe Kommentar oben.
    montageMinuten: montageAltMinuten,
  }
}

// Rueckwaertskompatibler Export: die Bandbasis des Einbauschranks, jetzt aus seinem
// Referenzprojekt abgeleitet statt hart hinterlegt.
export const REFERENZ = referenzAusProjekt(REFERENZPROJEKTE.einbauschrank)

export type Band = {
  schluessel: string
  text: string
  mitte: number | null
  /** Kurze Erlaeuterung unter der Bezeichnung, wenn sie sonst mehrdeutig waere. */
  hinweis?: string
}

// ── Referenzmoebel je Schwerpunkt ────────────────────────────────────────────
//
// Fabian am 2026-09-07: "Das Referenzprojekt an die Kernarbeit des Betriebes
// anzupassen finde ich sehr gut." — Zu Recht: Ein Treppenbauer, der sich an einem
// Flurschrank kalibriert, bekommt geratene Faktoren.
//
// Bis Task R2 kamen Kueche/Tueren/Treppe/Tisch aus einer FORMEL (SPECS/baueReferenz,
// siehe git-Historie): Faustregelpreis mal Materialanteil, die Minuten rueckwaerts
// daraus. Jetzt liefert referenzAusProjekt() (oben) die Bandbasis aller fuenf direkt
// aus den Stuecklisten in referenzprojekte.ts (Task R1) — kein Preis mehr aus einer
// Faustregel, die Faustregel bleibt dort nur noch Kontrolle.

export type Fragenschluessel = 'grund' | 'lack' | 'massiv' | 'montage'

// ── Die vier Antwortskalen ───────────────────────────────────────────────────
//
// Alle vier werden RUECKWAERTS aus den Zielfaktoren gerechnet, nicht geraten. Fuer
// jede Frage gilt dieselbe Umkehrung ihrer eigenen Faktorformel, zum Beispiel bei
// der Grundfrage:
//
//   Bandpreis(f) = Material + Fixsockel + f x (Werkstatt + Montage)
//
// Ergebnis: Jedes Band trifft seinen Zielfaktor auf zwei Stellen, das mittlere Band
// ergibt 1,0, und die beiden offenen Randbaender landen genau auf den Deckeln.
//
// DREI FEHLER, DIE DAS BEHEBT (alle am 2026-09-07 gemessen):
//   1. Die alten Grundbaender lagen UNTER dem Referenzpreis. Wer genau das nahm,
//      was CraftFlow rechnet, bekam Faktor 0,74 — 26 % gekuerzte Zeiten. Erbe aus
//      der Zeit, als Fabians Faustregel noch falsch gelesen war (1.200-2.000 mit
//      Montage statt ~2.000 ohne).
//   2. Zentriert man dieselben Prozentsaetze, kollabieren die unteren zwei Baender
//      auf denselben Deckelwert (0,60 / 0,60): Material und Fixsockel haben bei
//      Kueche, Tueren und Treppe einen viel groesseren Anteil am Preis als beim
//      Flurschrank. EIN Prozentsatz kann nicht fuer alle Referenzen passen — die
//      Umkehrrechnung braucht keinen.
//   3. Lack-, Massivholz- und Montagefrage hatten FESTE Skalen, die nur zum
//      Flurschrank passten. Ein Kuechenbauer konnte bei der Montagefrage nie ueber
//      Faktor 0,71 kommen: Seine Altbau-Erwartung liegt bei 3,7 Tagen, die
//      Auswahl endete bei "laenger" = 1.250 min. Die Frage war fuer ihn kaputt.
const ZIEL_FAKTOREN = [0.60, 0.80, 1.00, 1.20, 1.40]

// STANDARDSAETZE ist oben definiert (referenzAusProjekt braucht sie schon). Sie
// bestimmen nur die Beschriftung; gerechnet wird spaeter mit den Saetzen des
// Nutzers. Wer teurer kalkuliert als der Standard und trotzdem das mittlere Band
// waehlt, bekommt einen Faktor unter 1 — und das ist richtig: Dann sind seine
// Zeiten kuerzer, als seine eigenen Saetze es hergeben.
const STANDARDAUFSCHLAG = 0.30

// Rundung nach Groessenordnung: Ein Preis je Tuer (rund 250 EUR) auf 50er gerundet
// waere unbrauchbar grob.
const rund = (n: number) => {
  const stufe = n < 500 ? 10 : n < 5000 ? 50 : 100
  return Math.round(n / stufe) * stufe
}
const eur = (n: number) => `${n.toLocaleString('de-DE')} €`

/**
 * Baut fuenf Baender aus einem nicht skalierbaren Sockel und dem skalierbaren
 * Anteil. `form` beschriftet die Bandgrenzen.
 *
 * `form` darf eine LISTE von Schreibweisen sein. Dann wird die erste genommen, mit
 * der alle vier Grenzen unterschiedlich heissen. Ohne diese Ausweichstufe entstand
 * bei den Innentueren das Band "2,5 Tage – 2,5 Tage" (gemessen 2026-09-07): Die
 * Grenzen lagen bei 1,4 / 1,8 / 2,2 / 2,6 Tagen und fielen auf halbe Tage gerundet
 * zusammen.
 */
function skala(
  sockel: number, skalierbar: number,
  form: ((n: number) => string) | Array<(n: number) => string>,
): Band[] {
  const w = ZIEL_FAKTOREN.map(f => sockel + f * skalierbar)
  const g = (i: number) => (w[i] + w[i + 1]) / 2
  const formen = Array.isArray(form) ? form : [form]
  const passt = formen.find(fo => new Set([0, 1, 2, 3].map(i => fo(g(i)))).size === 4)
  const f = passt ?? formen[formen.length - 1]
  const t = (i: number) => f(g(i))
  return [
    { schluessel: 'b1', text: `unter ${t(0)}`,        mitte: Math.round(w[0]) },
    { schluessel: 'b2', text: `${t(0)} – ${t(1)}`,    mitte: Math.round(w[1]) },
    { schluessel: 'b3', text: `${t(1)} – ${t(2)}`,    mitte: Math.round(w[2]) },
    { schluessel: 'b4', text: `${t(2)} – ${t(3)}`,    mitte: Math.round(w[3]) },
    { schluessel: 'b5', text: `über ${t(3)}`,         mitte: Math.round(w[4]) },
  ]
}

/**
 * Steht unter der Frage, sobald jemand das unterste oder oberste Band waehlt.
 *
 * WARUM: Diese beiden Baender SIND der Deckel (0,6 bzw. 1,4). Wer in Wahrheit noch
 * weiter darunter liegt, kann uns das gar nicht mitteilen — und bekaeme sonst
 * kommentarlos einen Preis, den er sich nicht erklaeren kann. Genau daran sind
 * Testkunden abgesprungen. Ein Satz, der auf die richtige Stellschraube zeigt, ist
 * mehr wert als ein weiter gedehnter Faktor.
 */
export const RANDHINWEIS = 'Das ist der äußere Rand dessen, was ich über die Zeiten ausgleichen kann. Liegst du noch deutlich darunter oder darüber, liegt es meist nicht an der Geschwindigkeit, sondern an deinen Stundensätzen oder deinem Materialaufschlag — beides steht in den Einstellungen.'

/** Die beiden Baender, die auf dem Deckel liegen. */
export const RANDBAENDER = ['b1', 'b5']

const AUSWEICHEN: Band[] = [
  { schluessel: 'nicht',     text: 'mache ich nicht',       mitte: null },
  { schluessel: 'unbekannt', text: 'weiß ich gerade nicht', mitte: null },
]

// Dauern nennt ein Schreiner in Stunden, solange es unter einem Arbeitstag bleibt,
// darueber in Tagen (8 h). Halbe Tage sind die feinste Stufe, die sich noch ehrlich
// schaetzen laesst; wenn das nicht reicht, wird auf Stunden ausgewichen.
const zahl = (n: number) => (Math.round(n * 2) / 2).toLocaleString('de-DE')
const einheit = (n: number, ein: string, viele: string) =>
  `${zahl(n)} ${Math.round(n * 2) / 2 === 1 ? ein : viele}`
// Exportiert fuer Task R4 (BetriebSettings): die Montage-Frage zeigt dort die
// Dauer der Montage-Alternative als Anker unter der Position — dieselbe
// Formatierung wie in den Bandtexten oben, keine zweite Rechenstelle.
export const inTagen = (min: number) => einheit(min / 480, 'Tag', 'Tage')
export const inStunden = (min: number) => einheit(min / 60, 'Stunde', 'Stunden')
/** Tage, wenn es lange dauert — sonst Stunden. Stunden als Ausweichstufe. */
const dauerFormen = (grenzeMin: number) =>
  grenzeMin >= 9 * 60 ? [inTagen, inStunden] : [inStunden]

type Bandbasis = ReturnType<typeof referenzAusProjekt>

/**
 * Die Antwortskalen eines Referenzmoebels — nur zu den Fragen, die es stellt.
 */
function baueBaender(r: Bandbasis): Record<string, Band[]> {
  const w = (posten: readonly Zeitposten[], faktor = 1) => wert(posten, STANDARDSAETZE, faktor)
  const material = r.materialEk * (1 + STANDARDAUFSCHLAG)
  const fix = w(r.fixsockel)
  const montage = w(r.montage)
  const alle: Record<string, Band[]> = {}

  // Ohne Material gefragt? Dann faellt der Materialwert aus dem Sockel — sonst
  // stuende in der Frage eine andere Zahl als in der Rechnung.
  const ohne = (k: Fragenschluessel) => (r.ohneMaterial ?? []).includes(k)
  // Label je Stueck, Bandmitte bleibt der Gesamtwert: Gefragt wird "je Tuer",
  // gerechnet wird gegen die Referenz aus fuenf Tueren.
  const label = (k: Fragenschluessel) => {
    const t = r.teiler?.[k] ?? 1
    return (n: number) => eur(rund(n / t))
  }

  // Grundfrage: der Gesamtpreis des Moebels — oder nur der Arbeitspreis.
  alle.grund = skala(ohne('grund') ? fix : material + fix,
    w(r.werkstatt) + montage, label('grund'))

  // Lackfrage: nur der AUFSCHLAG gegenueber der Standardoberflaeche, deshalb ohne
  // Sockel und ohne Montage.
  const lackZeitwert = (r.lackMinuten / 60) * STANDARDSAETZE['Oberfläche']
  alle.lack = skala(r.lackMaterialEk * (1 + STANDARDAUFSCHLAG), lackZeitwert,
    label('lack')).map(b => ({ ...b, text: `+ ${b.text}` }))

  // Massivholzfrage: wieder ein Gesamtpreis, aber mit Massivholzmaterial, laengerer
  // Werkstattzeit und Oberflaeche statt Bekantung.
  const massivZeit = w(r.werkstatt, r.massivWerkstattFaktor)
    + (r.massivOberflaecheMinuten / 60) * STANDARDSAETZE['Oberfläche']
  alle.massiv = skala(
    (ohne('massiv') ? 0 : r.massivMaterialEk * (1 + STANDARDAUFSCHLAG)) + fix + montage,
    massivZeit, label('massiv'))

  // Montagefrage: eine DAUER im Altbau, nicht ein Preis. Ohne Sockel, weil der
  // Faktor die reine Montagezeit gegen die erwartete Alternativzeit stellt.
  // r.montageMinuten ist bereits die volle Montage+Lieferung-Zeit der Montage-
  // Alternative (siehe referenzAusProjekt) — keine weitere Ableitung noetig.
  const tMontage = r.teiler?.montage ?? 1
  alle.montage = skala(0, r.montageMinuten,
    dauerFormen(r.montageMinuten / tMontage).map(fo => (n: number) => fo(n / tMontage)))

  // Nur die Fragen behalten, die dieses Moebel wirklich stellt. Die Grundfrage
  // stellt jedes.
  const behalten: Record<string, Band[]> = { grund: alle.grund }
  for (const k of ['lack', 'massiv', 'montage'] as const) {
    if (r.fragen[k]) behalten[k] = [...alle[k], ...AUSWEICHEN]
  }
  return behalten
}

export type Referenzmoebel = Bandbasis & {
  baender: Record<string, Band[]>
  /** Die Fragen in Reihenfolge — Grundfrage zuerst, dann die Differenzfragen. */
  fragenliste: Array<{ schluessel: Fragenschluessel; text: string; hinweis: string; baender: Band[] }>
}

function mitBaendern(r: Bandbasis): Referenzmoebel {
  const baender = baueBaender(r)
  const fragenliste = (['grund', 'lack', 'massiv', 'montage'] as const)
    .filter(k => r.fragen[k] && baender[k])
    .map(k => ({
      schluessel: k, text: r.fragen[k] as string,
      hinweis: r.fragenHinweis?.[k] ?? '', baender: baender[k],
    }))
  return { ...r, baender, fragenliste }
}

// Alle fuenf Referenzmoebel direkt aus ihren Referenzprojekten (referenzprojekte.ts).
// Vorher stand der Einbauschrank als Sonderfall hier (die gemessene REFERENZ, von
// Hand mit fragen/fragenHinweis/ohneMaterial/teiler zusammengesteckt), die anderen
// vier kamen aus SPECS/baueReferenz. Jetzt liefert referenzAusProjekt() beides aus
// derselben Quelle — der Schrank ist kein Sonderfall mehr.
export const REFERENZEN: Record<string, Referenzmoebel> = Object.fromEntries(
  Object.values(REFERENZPROJEKTE).map(p => [p.schluessel, mitBaendern(referenzAusProjekt(p))]),
)

// Rueckwaertskompatibler Zugriff fuer Aufrufer ohne Referenz: die Skalen des
// gemessenen Einbauschranks.
export const BAENDER: Record<string, Band[]> = REFERENZEN.einbauschrank.baender

// Welcher Schwerpunkt fuehrt zu welchem Referenzmoebel. Reihenfolge = Vorrang:
// Wer Kuechen UND Einbauschraenke baut, kalibriert sich an der Kueche, weil sie das
// aufwendigere und aussagekraeftigere Stueck ist.
const SCHWERPUNKT_ZU_REFERENZ: Array<[string, string]> = [
  ['kuechen', 'kueche'],
  ['treppen', 'treppen'],
  ['tueren', 'tueren'],
  ['einbau', 'einbauschrank'],
  ['solitaer', 'solitaer'],
]

/**
 * Waehlt das Referenzmoebel zum Schwerpunkt. Ohne Angabe oder bei Schwerpunkten
 * ohne eigenes Moebel (Bad, Boeden, Verkleidung, Objekt, Aussen, Reparatur) bleibt
 * es beim Einbauschrank — er ist das einzige gemessene Stueck.
 */
export function referenzFuer(schwerpunkt: string[] | null | undefined): Referenzmoebel {
  if (Array.isArray(schwerpunkt)) {
    for (const [s, r] of SCHWERPUNKT_ZU_REFERENZ) {
      if (schwerpunkt.includes(s)) return REFERENZEN[r]
    }
  }
  return REFERENZEN.einbauschrank
}

// Die fuenf Betriebsfragen. Liegen hier, damit Erst-Anmeldung und Einstellungen
// dieselbe Quelle nutzen — zwei Listen wuerden auseinanderlaufen.
export const BETRIEBSFRAGEN: Record<string, Band[]> = {
  // Die Mitarbeiterzahl wurde am 2026-09-07 entfernt. Fuer den Preis ist sie fast
  // egal: Er ist Personenstunden mal Satz, egal ob einer acht Stunden arbeitet oder
  // zwei je vier. Eine Frage, die nichts bewirkt, kostet nur Anmeldungen.
  // Die Spalte in der Datenbank bleibt — sie stoert nicht und laesst sich spaeter
  // wieder nutzen, falls Zweimann-Montage einmal eine Rolle spielt.
  maschinen: [
    { schluessel: 'formatsaege',   text: 'Formatkreissäge',      mitte: null },
    { schluessel: 'kantenanleim',  text: 'Kantenanleimmaschine', mitte: null },
    { schluessel: 'cnc',           text: 'CNC',                  mitte: null },
    { schluessel: 'lackierkabine', text: 'Lackierkabine',        mitte: null },
    { schluessel: 'keine',         text: 'keine davon',          mitte: null },
  ],
  // MEHRFACHAUSWAHL. Die alte Fassung hatte "Möbel nach Maß" und "Innenausbau und
  // Einbauschränke" nebeneinander — ein Einbauschrank IST ein Möbel nach Maß, die
  // Trennung war keine. Und kaum ein Betrieb baut nur eines. Fabian am 2026-09-07.
  //
  // Die Kategorien überschneiden sich jetzt nicht mehr und tragen je einen Zusatz,
  // der sagt, was gemeint ist.
  schwerpunkt: [
    { schluessel: 'einbau',      text: 'Einbauschränke und Garderoben', mitte: null,
      hinweis: 'fest eingebaut, nach Maß, Montage beim Kunden' },
    { schluessel: 'solitaer',    text: 'Freistehende Möbel', mitte: null,
      hinweis: 'Tische, Sideboards, Regale, Betten' },
    { schluessel: 'kuechen',     text: 'Küchen', mitte: null,
      hinweis: 'mit Geräteeinbau' },
    { schluessel: 'bad',         text: 'Bad- und Waschtischmöbel', mitte: null,
      hinweis: 'Feuchtraum, oft mit Aufsatzbecken' },
    { schluessel: 'tueren',      text: 'Innentüren und Zargen', mitte: null,
      hinweis: 'liefern und einpassen' },
    { schluessel: 'treppen',     text: 'Treppen', mitte: null,
      hinweis: 'auch Geländer' },
    { schluessel: 'boeden',      text: 'Böden', mitte: null,
      hinweis: 'Parkett, Dielen, Fußleisten' },
    { schluessel: 'verkleidung', text: 'Wand- und Deckenverkleidungen', mitte: null,
      hinweis: 'auch Akustikpaneele' },
    { schluessel: 'objekt',      text: 'Ladenbau und Objekteinrichtung', mitte: null,
      hinweis: 'Theken, Tresen, Praxis- und Büroeinrichtung' },
    { schluessel: 'aussen',      text: 'Außenbereich', mitte: null,
      hinweis: 'Terrasse, Sichtschutz, Carport' },
    { schluessel: 'reparatur',   text: 'Reparatur und Restaurierung', mitte: null,
      hinweis: 'Aufarbeiten statt neu bauen' },
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

// ── Was die Betriebsfragen bewirken ──────────────────────────────────────────
//
// Fabian am 2026-09-07: "Was bringen uns die Antworten? Welchen Mehrwert generieren
// wir fuer die Kalkulation, wenn wir das wissen?" — Zu Recht, denn bis dahin wurden
// sie gespeichert und nirgends gelesen.
//
// Wirksam sind genau drei Antworten. Sie schalten Kostenstellen ab; die Arbeit
// verschwindet dabei NICHT, sie wandert zur Handarbeit (src/lib/handarbeit.ts).
//
// BEWUSST NICHT verdrahtet:
// - Formatkreissaege: Zuschnitt faellt in jedem Betrieb an, mit welcher Saege auch
//   immer. Es gibt keine Kostenstelle, die man dafuer abschalten koennte.
// - Lackierkabine: "Oberflaeche" abzuschalten waere falsch — Oelen und Wachsen
//   brauchen keine Kabine. Wer nicht lackieren kann, kauft es zu; das ist eine
//   Materialfrage, keine Kostenstellenfrage. Offen.

export type Betriebsantworten = {
  maschinen?: string[]
  montage_selbst?: string
}

/** Kostenstellen, über die „Mein Betrieb“ entscheidet — nur diese werden abgeglichen. */
export const VON_BETRIEB_GESTEUERT = ['CNC', 'Bekantung', 'Montage'] as const

/**
 * Soll-Zustand je gesteuerter Kostenstelle: true = an, false = aus.
 * GEFUNDEN 2026-09-15 von Fabian: Ohne Kantenanleimmaschine rechnete die Analyse
 * „Bekantung“ zwar korrekt raus, aber unter „Kostenstellen“ stand sie weiter auf an —
 * nichts schrieb die Antwort zurück. Die Anzeige log, die Rechnung nicht.
 */
export function kostenstellenSollZustand(a: Betriebsantworten | null | undefined): Record<string, boolean> {
  const aus = new Set(abzuschaltendeKostenstellen(a))
  return Object.fromEntries(VON_BETRIEB_GESTEUERT.map(k => [k, !aus.has(k)]))
}

export function abzuschaltendeKostenstellen(a: Betriebsantworten | null | undefined): string[] {
  if (!a) return []
  const hat = (m: string) => Array.isArray(a.maschinen) && a.maschinen.includes(m)
  const aus: string[] = []

  // Kein CNC: Griffmulden und Ausschnitte entstehen von Hand, nicht zu 120 EUR/h.
  if (!hat('cnc')) aus.push('CNC')
  // Keine Kantenanleimmaschine: Kanten werden von Hand aufgebracht — laenger, aber
  // zum eigenen Satz statt zu 100 EUR/h Maschinensatz.
  if (!hat('kantenanleim')) aus.push('Bekantung')
  // Wer nicht montiert, bekommt keine Montagezeile. Lieferung bleibt: Ausliefern
  // und Aufstellen sind zweierlei.
  if (a.montage_selbst === 'nie') aus.push('Montage')

  return aus
}

// ── Lackierung ohne eigene Kabine ────────────────────────────────────────────
//
// Fabians Entscheidung 2026-09-07: "Lackierte Teile kosten je nach Qualitaet und
// Region sehr unterschiedlich" — deshalb KEIN Richtpreis, sondern eine konkrete
// Nachfrage, wenn es in der Kalkulation gebraucht wird.
//
// Warum nicht einfach die Kostenstelle "Oberflaeche" abschalten: Oelen, Wachsen und
// Schleifen brauchen keine Kabine. Wer nicht lackieren kann, kauft NUR das Lackieren
// zu — das ist eine Materialposition, kein Zeitposten.
//
// Warum keine harte Rueckfrage: Die wuerde die ganze Kalkulation blockieren. Fuer
// einen fehlenden Quadratmeterpreis ist das zu grob. Stattdessen entsteht eine
// sichtbare Zeile mit 0 EUR, deren Bezeichnung sagt, was zu tun ist.

export const LACK_BEZEICHNUNG = 'Lackierung (Zukauf) — Quadratmeterpreis eintragen'

export function lackBlockFuer(a: Betriebsantworten | null | undefined): string {
  if (!a || !Array.isArray(a.maschinen)) return ''
  if (a.maschinen.includes('lackierkabine')) return ''
  return `

== DIESER BETRIEB HAT KEINE LACKIERKABINE ==
Er lackiert nicht selbst. Lackierte Oberflaechen kauft er zu.

DIESE REGEL GILT AUSSCHLIESSLICH FUER FLAECHEN, DIE DER SCHREINER SELBST LACKIEREN
ODER FARBIG SPRITZEN WUERDE. Nur dann, wenn im Text ausdruecklich "lackiert",
"lackieren", "Lack", "gespritzt", "farbig gespritzt", "RAL" oder Gleichwertiges
steht. Sonst NICHT anwenden.
KEINE Lackierposition, sondern ganz normales Material mit EK-Preis, bei:
Dekor, dekorbeschichtet, beschichtet, Melamin, CPL, HPL, Schichtstoff, Folie,
foliert, furniert (roh), geoelt, gewachst, geseift, Hartwachsoel. "Fronten weiss
matt" ohne das Wort Lack ist DEKOR — eine weisse Dekorfront ist kein Lackteil.
(Vorfall 2026-09-17, Kuechen-Referenz: Fuer Dekorfronten legte die KI eine
Lackierposition mit 0 EUR an. Die Kueche war damit unvollstaendig kalkuliert.)

- Bei lackierten Teilen KEINE Zeit auf der Kostenstelle "Oberfläche" ansetzen.
- Stattdessen eine Materialposition anlegen: bezeichnung "${LACK_BEZEICHNUNG}", einheit "m²", menge = zu lackierende Sichtflaeche in m².
- Den Quadratmeterpreis kennst du NICHT und darfst ihn NICHT schaetzen. Lackierte Teile kosten je nach Qualitaet und Region sehr unterschiedlich. Steht in der Preisliste kein fixierter Preis dafuer, setze ekPreis auf 0 — der Nutzer traegt ihn ein.
- Oelen, Wachsen und Schleifen macht er weiterhin selbst. Dafuer bleibt "Oberfläche" mit ihrer Zeit.`
}

// Grenzen der ABLEITUNG aus den Kalibrierungsantworten. Sie bleiben, wie sie sind:
// Die fuenf Antwortbaender sind genau auf 0,60-1,40 zurueckgerechnet (ZIEL_FAKTOREN).
const MIN_FAKTOR = 0.6
const MAX_FAKTOR = 1.4

// Grenzen der HANDEINGABE in "Mein Betrieb". Fabian am 2026-09-16: Die enge Grenze
// war dort nur ein Tippfehler-Schutz und hat Betriebe ausgesperrt, die wirklich
// deutlich langsamer oder schneller arbeiten.
export const HAND_MIN = 0.5
export const HAND_MAX = 3

export function deckele(faktor: number): number {
  if (!Number.isFinite(faktor)) return 1
  return Math.min(MAX_FAKTOR, Math.max(MIN_FAKTOR, Math.round(faktor * 100) / 100))
}

/** Wie deckele, aber fuer von Hand gesetzte Faktoren: 0,50 bis 3,00. */
export function deckeleHand(faktor: number): number {
  if (!Number.isFinite(faktor)) return 1
  return Math.min(HAND_MAX, Math.max(HAND_MIN, Math.round(faktor * 100) / 100))
}

function wert(posten: readonly Zeitposten[], saetze: Saetze, faktor = 1): number {
  return posten.reduce((s, p) => s + (p.minuten * faktor / 60) * (saetze[p.kostenstelle] ?? 65), 0)
}

export function referenzPreis(
  saetze: Saetze, aufschlag: number, ref: Referenzmoebel = REFERENZEN.einbauschrank,
) {
  const material  = ref.materialEk * (1 + aufschlag)
  const fixsockel = wert(ref.fixsockel, saetze)
  const werkstatt = wert(ref.werkstatt, saetze)
  const montage   = wert(ref.montage, saetze)
  return { material, fixsockel, werkstatt, montage, gesamt: material + fixsockel + werkstatt + montage }
}

export type Anker = { wert: number; text: string }

const jeStueckSuffix = (teiler: number) => (teiler > 1 ? ' je Stück' : '')
const ohneMaterialSuffix = (ohne: boolean) => (ohne ? ' für die Arbeit, ohne Material' : '')

/**
 * Task R2 Fix Runde 2/3 (Controller-Ruling): EINE Quelle fuer den Anker-Text
 * ("CraftFlow rechnet ... — was nimmst du?"), den "Mein Betrieb" ueber jeder Frage
 * zeigt. Vorher rechnete ReferenzprojektKasten.tsx das selbst nach, mit einer
 * eigenen Formel je Frage (grundAnkerText/lackAnkerText/massivAnkerText/
 * montageAnkerText) — bei "lack" fehlte dort NICHTS, aber die zugrundeliegende
 * Bandbasis (lackMinuten) war falsch (siehe referenzAusProjekt-Kommentar), und zwei
 * Rechenstellen fuer denselben Wert waeren ohnehin auseinandergelaufen.
 *
 * Rechnet mit GENAU denselben Sockel-/Skalierbar-Formeln wie baueBaender (Faktor
 * 1,0 = "Band 3"), aber mit den Saetzen/dem Aufschlag DIESES Betriebs statt
 * STANDARDSAETZE — der Anker ist die ECHTE Kalkulation, die Baender sind die
 * (immer gleich beschrifteten) Antwortstufen. Bei STANDARDSAETZE/30 % faellt der
 * Anker deshalb (bis auf Rundung) auf die Bandmitte von Band 3 — als Konsistenz-
 * Test in kalibrierung.test.mjs festgeschrieben.
 */
export function ankerFuer(
  ref: Referenzmoebel, saetze: Saetze, aufschlag: number,
): Partial<Record<Fragenschluessel, Anker>> {
  const w = (posten: readonly Zeitposten[], faktor = 1) => wert(posten, saetze, faktor)
  const material = ref.materialEk * (1 + aufschlag)
  const fix = w(ref.fixsockel)
  const montage = w(ref.montage)
  const ohne = (k: Fragenschluessel) => (ref.ohneMaterial ?? []).includes(k)
  const teilerVon = (k: Fragenschluessel) => ref.teiler?.[k] ?? 1
  const anker: Partial<Record<Fragenschluessel, Anker>> = {}

  const grundGesamt = (ohne('grund') ? fix : material + fix) + w(ref.werkstatt) + montage
  const grundWert = Math.round(grundGesamt / teilerVon('grund'))
  anker.grund = {
    wert: grundWert,
    text: `CraftFlow rechnet ${eur(grundWert)}${jeStueckSuffix(teilerVon('grund'))}${ohneMaterialSuffix(ohne('grund'))} — was nimmst du?`,
  }

  if (ref.fragen.lack) {
    const lackZeitwert = (ref.lackMinuten / 60) * (saetze['Oberfläche'] ?? 72)
    const lackWert = Math.round((ref.lackMaterialEk * (1 + aufschlag) + lackZeitwert) / teilerVon('lack'))
    anker.lack = {
      wert: lackWert,
      text: `CraftFlow rechnet + ${eur(lackWert)}${jeStueckSuffix(teilerVon('lack'))} dazu — was nimmst du?`,
    }
  }

  if (ref.fragen.massiv) {
    const massivZeit = w(ref.werkstatt, ref.massivWerkstattFaktor) + (ref.massivOberflaecheMinuten / 60) * (saetze['Oberfläche'] ?? 72)
    const massivGesamt = (ohne('massiv') ? 0 : ref.massivMaterialEk * (1 + aufschlag)) + fix + montage + massivZeit
    const massivWert = Math.round(massivGesamt / teilerVon('massiv'))
    anker.massiv = {
      wert: massivWert,
      text: `CraftFlow rechnet ${eur(massivWert)}${jeStueckSuffix(teilerVon('massiv'))}${ohneMaterialSuffix(ohne('massiv'))} — was nimmst du?`,
    }
  }

  if (ref.fragen.montage) {
    const tMontage = teilerVon('montage')
    const minuten = ref.montageMinuten / tMontage
    const dauer = minuten >= 9 * 60 ? inTagen(minuten) : inStunden(minuten)
    anker.montage = { wert: Math.round(minuten), text: `CraftFlow rechnet ${dauer} — was nimmst du?` }
  }

  return anker
}

// Testschluessel "test:<zahl>" erlaubt es, die Bandmitte im Test genau auf den
// eigenen Referenzpreis zu setzen. In der Oberflaeche kommt so ein Wert nie vor.
function mitte(frage: string, schluessel: string, ref?: Referenzmoebel): number | null {
  if (schluessel.startsWith('test:')) {
    const z = Number(schluessel.slice(5))
    return Number.isFinite(z) ? z : null
  }
  // ALLE vier Skalen kommen vom Referenzmoebel — eine Kueche hat andere Preisstufen
  // und andere Montagedauern als ein Flurschrank.
  const liste = (ref ?? REFERENZEN.einbauschrank).baender[frage] ?? []
  const band = liste.find(b => b.schluessel === schluessel)
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
export function berechneFaktoren(
  a: Antworten, saetze: Saetze, aufschlag: number,
  ref: Referenzmoebel = REFERENZEN.einbauschrank,
): Faktoren {
  const r = referenzPreis(saetze, aufschlag, ref)
  const f: Faktoren = { werkstatt: 1, oberflaeche: 1, massivholz: 1, montage: 1 }

  // Die Differenz faellt auf ALLE skalierbare Arbeitszeit, nicht nur auf die
  // Werkstatt. Nur auf den Werkstattblock gerechnet, sprang der Faktor zwischen
  // benachbarten Baendern um 0,46 (gemessen 2026-09-07) — jedes Band waere ein
  // Sprung ins Extrem gewesen.
  const grund = mitte('grund', a.grund, ref)
  const skalierbar = r.werkstatt + r.montage
  const ohneMaterial = (k: Fragenschluessel) => (ref.ohneMaterial ?? []).includes(k)
  if (grund !== null && skalierbar > 0) {
    const sockel = ohneMaterial('grund') ? r.fixsockel : r.material + r.fixsockel
    f.werkstatt = deckele((grund - sockel) / skalierbar)
    // Ohne eigene Montage-Antwort erbt die Montage die Geschwindigkeit des Betriebs.
    f.montage = f.werkstatt
  }

  const lack = mitte('lack', a.lack, ref)
  if (lack !== null) {
    const lackMaterial = ref.lackMaterialEk * (1 + aufschlag)
    const lackZeitwert = (ref.lackMinuten / 60) * (saetze['Oberfläche'] ?? 72)
    if (lackZeitwert > 0) f.oberflaeche = deckele((lack - lackMaterial) / lackZeitwert)
  }

  const massiv = mitte('massiv', a.massiv, ref)
  if (massiv !== null) {
    const massivMaterial = ohneMaterial('massiv') ? 0 : ref.massivMaterialEk * (1 + aufschlag)
    const massivWerkstatt = wert(ref.werkstatt, saetze, ref.massivWerkstattFaktor)
    const massivOberflaeche = (ref.massivOberflaecheMinuten / 60) * (saetze['Oberfläche'] ?? 72)
    const zeitanteil = massivWerkstatt + massivOberflaeche
    if (zeitanteil > 0) {
      f.massivholz = deckele((massiv - massivMaterial - r.fixsockel - r.montage) / zeitanteil)
    }
  }

  // Gefragt wird die ALTBAU-Dauer in Tagen, verglichen gegen ref.montageMinuten —
  // die volle Montage+Lieferung-Zeit der Montage-Alternative (referenzAusProjekt).
  // Der Faktor gilt dann fuer alle Montage; der Altbau-Zuschlag selbst steckt schon
  // in der Alternative. Ueberschreibt die geerbte Montage, wenn ausdruecklich
  // beantwortet.
  const montage = mitte('montage', a.montage, ref)
  if (montage !== null) {
    const erwartetMin = ref.montageMinuten
    if (erwartetMin > 0) f.montage = deckele(montage / erwartetMin)
  }

  return f
}
