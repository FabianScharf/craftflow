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

export type Band = {
  schluessel: string
  text: string
  mitte: number | null
  /** Kurze Erlaeuterung unter der Bezeichnung, wenn sie sonst mehrdeutig waere. */
  hinweis?: string
}

// ── Weitere Referenzmoebel je Schwerpunkt ────────────────────────────────────
//
// Fabian am 2026-09-07: "Das Referenzprojekt an die Kernarbeit des Betriebes
// anzupassen finde ich sehr gut." — Zu Recht: Ein Treppenbauer, der sich an einem
// Flurschrank kalibriert, bekommt geratene Faktoren.
//
// WOHER DIE ZAHLEN KOMMEN — nicht erfunden, sondern aus Fabians eigener
// Wissensbasis abgeleitet:
//   Preis        aus den Preisfaustregeln (CLAUDE.md, Abschnitt 6.1)
//   Materialanteil aus den Materialverhaeltnis-Richtwerten (Abschnitt 6.2)
// Die Minuten entstehen daraus rechnerisch: Lohnsumme = Preis x (1 - Materialanteil),
// geteilt durch einen Referenzsatz von 70 EUR/h. Bewertet wird spaeter mit den
// Saetzen des jeweiligen Nutzers — deshalb misst der Faktor die ZEIT, nicht den Satz.
//
// ZU PRUEFEN VON FABIAN: Die Aufteilung in Planung, Werkstatt und Montage ist eine
// fachliche Setzung. Sie ist plausibel, aber nicht gemessen wie beim Einbauschrank.

const REFERENZSATZ = 70

type ReferenzSpec = {
  name: string
  text: string
  preis: number
  materialAnteil: number
  anteilFix: number
  anteilWerkstatt: number
  /** Anteil Oberflaechenarbeit — bei Massivholzstuecken der groesste Einzelposten. */
  anteilOberflaeche: number
  anteilMontage: number
  /** Zu behandelnde Sichtflaeche in m2 — treibt Lack- und Massivholzfrage. */
  flaecheM2: number
  /**
   * Die Fragetexte. Ein fehlender Schluessel bedeutet: Diese Frage wird bei diesem
   * Referenzmoebel NICHT gestellt (der zugehoerige Faktor bleibt 1,0). So entfaellt
   * die Massivholzfrage bei Treppe und Tisch — die sind schon massiv.
   */
  fragen: Partial<Record<'grund' | 'lack' | 'massiv' | 'montage', string>>
}

// Aus der Flaeche entstehen die Zahlen der Lack- und der Massivholzfrage. Die
// Kennwerte stammen aus CLAUDE.md, Abschnitt 4 und 7:
//   40 min/m2   3-Schicht-Lackaufbau seidenmatt inkl. Zwischenschliff (Band 35-55)
//    4 EUR/m2   Grundierung + 2x Decklack, ca. 350 ml/m2
//  110 EUR/m2   Eiche massiv 25 mm (Band 80-140)
//   20 min/m2   zweimal oelen inkl. Abziehen (Band 20-30, unteres Ende)
//
// GEGENPROBE, die diese Kennwerte stuetzt: Auf den gemessenen Einbauschrank
// (16,1 m2 Plattenflaeche) angewandt ergeben sie 644 / 64 / 1.771 / 322 gegen die
// gemessenen 600 / 60 / 1.770 / 300. Der Materialwert trifft auf 1 EUR. Als Test
// festgeschrieben in tests/kalibrierung.test.mjs.
const LACK_MIN_JE_M2 = 40
const LACK_EK_JE_M2 = 4
const MASSIV_EK_JE_M2 = 110
const OELEN_MIN_JE_M2 = 20

function baueReferenz(spec: ReferenzSpec) {
  const lohn = spec.preis * (1 - spec.materialAnteil)
  const minutenGesamt = (lohn / REFERENZSATZ) * 60
  const m = (anteil: number) => Math.round(minutenGesamt * anteil)
  const fix = m(spec.anteilFix)
  const werk = m(spec.anteilWerkstatt)
  const ober = m(spec.anteilOberflaeche)
  const mont = m(spec.anteilMontage)
  return {
    name: spec.name,
    text: spec.text,
    fragen: spec.fragen,
    materialEk: Math.round(spec.preis * spec.materialAnteil / 1.3),
    // Der Fixsockel verteilt sich wie beim Einbauschrank auf die vier Kostenstellen.
    fixsockel: [
      { kostenstelle: 'Besprechung', minuten: Math.round(fix * 0.13) },
      { kostenstelle: 'Planung', minuten: Math.round(fix * 0.19) },
      { kostenstelle: 'Konstruktion', minuten: Math.round(fix * 0.39) },
      { kostenstelle: 'Arbeitsvorbereitung', minuten: Math.round(fix * 0.29) },
    ] as Zeitposten[],
    // Enthaelt bewusst auch die Oberflaeche: Das Feld beziffert den WERKSTATTPREIS,
    // nicht die Faktorgruppe. Ohne diesen Posten fehlte einer geoelten Treppe oder
    // einem Massivholztisch die Oberflaechenzeit in der Referenz.
    werkstatt: [
      { kostenstelle: 'Zuschnitt', minuten: Math.round(werk * 0.25) },
      { kostenstelle: 'Bekantung', minuten: Math.round(werk * 0.18) },
      { kostenstelle: 'Zusammenbau', minuten: Math.round(werk * 0.50) },
      { kostenstelle: 'Warenhandling', minuten: Math.round(werk * 0.04) },
      { kostenstelle: 'Verpacken', minuten: Math.round(werk * 0.03) },
      { kostenstelle: 'Oberfläche', minuten: ober },
    ] as Zeitposten[],
    montage: [
      { kostenstelle: 'Montage', minuten: Math.round(mont * 0.78) },
      { kostenstelle: 'Lieferung', minuten: Math.round(mont * 0.22) },
    ] as Zeitposten[],
    lackMinuten: Math.round(spec.flaecheM2 * LACK_MIN_JE_M2),
    lackMaterialEk: Math.round(spec.flaecheM2 * LACK_EK_JE_M2),
    massivMaterialEk: Math.round(spec.flaecheM2 * MASSIV_EK_JE_M2),
    massivWerkstattFaktor: 1.3,
    massivOberflaecheMinuten: Math.round(spec.flaecheM2 * OELEN_MIN_JE_M2),
    altbauFaktor: 1.6,
  }
}

// Preis und Materialanteil je Referenz — beides aus Fabians Wissensbasis.
// Die Oberflaeche ist aus dem Werkstattanteil herausgeloest, nicht zusaetzlich:
// Kueche 0,58 -> 0,54 + 0,04, Tueren 0,20 -> 0,18 + 0,02, Treppe 0,36 -> 0,28 + 0,08,
// Tisch 0,78 -> 0,58 + 0,20. Beim Tisch ist das Oelen der groesste Einzelposten.
const SPECS: Record<string, ReferenzSpec> = {
  kueche: {
    name: 'Einbauküche',
    text: 'Einbauküche L-Form, 3,60 m × 2,20 m. Korpusse Dekorspanplatte 19 mm, Fronten weiß matt, 8 Unterschränke davon 3 mit Auszügen, 4 Oberschränke, Spülenschrank, Arbeitsplatte 38 mm. Lieferung und Montage beim Kunden, Neubau.',
    preis: 10000, materialAnteil: 0.45,
    anteilFix: 0.12, anteilWerkstatt: 0.54, anteilOberflaeche: 0.04, anteilMontage: 0.30,
    flaecheM2: 18,
    fragen: {
      grund: 'Was nimmst du für so eine Küche, netto?',
      lack: 'Dieselbe Küche, aber Fronten weiß lackiert seidenmatt statt Dekor. Was kommt dazu?',
      massiv: 'Dieselbe Küche mit Fronten in Eiche massiv, geölt. Was nimmst du?',
      montage: 'Dieselbe Küche im Altbau: Wände nicht im Lot, alte Leitungen, kein Aufzug. Wie lange bist du dran?',
    },
  },
  tueren: {
    name: 'Innentüren',
    text: '5 Innentüren mit Zargen, weiß beschichtet, Standardmaß, liefern und einpassen. Altbau, Wände nicht überall im Lot, Zargen kürzen.',
    preis: 2900, materialAnteil: 0.55,
    anteilFix: 0.10, anteilWerkstatt: 0.18, anteilOberflaeche: 0.02, anteilMontage: 0.70,
    flaecheM2: 20,
    fragen: {
      grund: 'Was nimmst du für die fünf Türen mit Zargen, netto?',
      lack: 'Dieselben Türen, aber von dir weiß lackiert seidenmatt statt beschichtet gekauft. Was kommt dazu?',
      massiv: 'Dieselben fünf Türen in Eiche massiv, geölt. Was nimmst du?',
      montage: 'Dieselben fünf Türen im Altbau: alte Zargen raus, Wände nicht im Lot, Böden schief. Wie lange bist du dran?',
    },
  },
  treppen: {
    name: 'Treppe',
    text: 'Geradläufige Treppe, Buche massiv, 13 Steigungen, mit Geländer und Handlauf. Rohtreppe zugekauft, Einbau und Anpassung vor Ort.',
    preis: 5000, materialAnteil: 0.55,
    anteilFix: 0.14, anteilWerkstatt: 0.28, anteilOberflaeche: 0.08, anteilMontage: 0.50,
    flaecheM2: 12,
    // Keine Massivholzfrage: Die Treppe IST schon Buche massiv. Die Grundfrage misst
    // die Massivholzarbeit hier bereits mit — ein zweites Mal danach zu fragen waere
    // eine Scheinfrage, deren Antwort nichts hergibt.
    fragen: {
      grund: 'Was nimmst du für so eine Treppe, netto?',
      lack: 'Dieselbe Treppe, aber weiß lackiert seidenmatt statt geölt. Was kommt dazu?',
      montage: 'Dieselbe Treppe im Altbau: schiefe Wände, Podest anpassen, enges Treppenhaus. Wie lange bist du dran?',
    },
  },
  solitaer: {
    name: 'Massivholztisch',
    text: 'Massivholztisch Eiche, 200 × 90 cm, 4 cm Platte, geölt, mit Wangengestell. Lieferung, keine Montage vor Ort.',
    preis: 3000, materialAnteil: 0.35,
    anteilFix: 0.14, anteilWerkstatt: 0.58, anteilOberflaeche: 0.20, anteilMontage: 0.08,
    flaecheM2: 5,
    // Ebenfalls keine Massivholzfrage — der Tisch ist Eiche massiv.
    fragen: {
      grund: 'Was nimmst du für so einen Tisch, netto?',
      lack: 'Derselbe Tisch, aber weiß lackiert seidenmatt statt geölt. Was kommt dazu?',
      montage: 'Derselbe Tisch, geliefert in den zweiten Stock ohne Aufzug, Gestell vor Ort montiert. Wie lange bist du dran?',
    },
  },
}

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

// Die Standardsaetze der Handwerkskammer, mit denen die Baender beziffert werden.
// Absichtlich hier wiederholt statt importiert (siehe Dateikopf). Sie bestimmen nur
// die Beschriftung; gerechnet wird spaeter mit den Saetzen des Nutzers. Wer teurer
// kalkuliert als der Standard und trotzdem das mittlere Band waehlt, bekommt einen
// Faktor unter 1 — und das ist richtig: Dann sind seine Zeiten kuerzer, als seine
// eigenen Saetze es hergeben.
const STANDARDSAETZE: Saetze = {
  Besprechung: 65, Planung: 85, Konstruktion: 75, Arbeitsvorbereitung: 75,
  Produktion: 65, Warenhandling: 65, Zuschnitt: 72, Bekantung: 100, CNC: 120,
  'Oberfläche': 72, Zusammenbau: 65, Verpacken: 65, Azubi: 52,
  Montage: 65, Lieferung: 65,
}
const STANDARDAUFSCHLAG = 0.30

const rund = (n: number) => Math.round(n / 50) * 50
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
const inTagen = (min: number) => einheit(min / 480, 'Tag', 'Tage')
const inStunden = (min: number) => einheit(min / 60, 'Stunde', 'Stunden')
/** Tage, wenn es lange dauert — sonst Stunden. Stunden als Ausweichstufe. */
const dauerFormen = (grenzeMin: number) =>
  grenzeMin >= 9 * 60 ? [inTagen, inStunden] : [inStunden]

type Bandbasis = ReturnType<typeof baueReferenz>

/**
 * Die Antwortskalen eines Referenzmoebels — nur zu den Fragen, die es stellt.
 */
function baueBaender(r: Bandbasis): Record<string, Band[]> {
  const w = (posten: readonly Zeitposten[], faktor = 1) => wert(posten, STANDARDSAETZE, faktor)
  const material = r.materialEk * (1 + STANDARDAUFSCHLAG)
  const fix = w(r.fixsockel)
  const montage = w(r.montage)
  const alle: Record<string, Band[]> = {}

  // Grundfrage: der Gesamtpreis des Moebels.
  alle.grund = skala(material + fix, w(r.werkstatt) + montage, n => eur(rund(n)))

  // Lackfrage: nur der AUFSCHLAG gegenueber der Standardoberflaeche, deshalb ohne
  // Sockel und ohne Montage.
  const lackZeitwert = (r.lackMinuten / 60) * STANDARDSAETZE['Oberfläche']
  alle.lack = skala(r.lackMaterialEk * (1 + STANDARDAUFSCHLAG), lackZeitwert,
    n => eur(rund(n))).map(b => ({ ...b, text: `+ ${b.text}` }))

  // Massivholzfrage: wieder ein Gesamtpreis, aber mit Massivholzmaterial, laengerer
  // Werkstattzeit und Oberflaeche statt Bekantung.
  const massivZeit = w(r.werkstatt, r.massivWerkstattFaktor)
    + (r.massivOberflaecheMinuten / 60) * STANDARDSAETZE['Oberfläche']
  alle.massiv = skala(
    r.massivMaterialEk * (1 + STANDARDAUFSCHLAG) + fix + montage, massivZeit,
    n => eur(rund(n)))

  // Montagefrage: eine DAUER im Altbau, nicht ein Preis. Ohne Sockel, weil der
  // Faktor die reine Montagezeit gegen unsere Altbau-Erwartung stellt.
  const basisMontage = r.montage.find(p => p.kostenstelle === 'Montage')?.minuten ?? 240
  const erwartet = basisMontage * r.altbauFaktor
  alle.montage = skala(0, erwartet, dauerFormen(erwartet))

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
  fragenliste: Array<{ schluessel: string; text: string; baender: Band[] }>
}

function mitBaendern(r: Bandbasis): Referenzmoebel {
  const baender = baueBaender(r)
  const fragenliste = (['grund', 'lack', 'massiv', 'montage'] as const)
    .filter(k => r.fragen[k] && baender[k])
    .map(k => ({ schluessel: k, text: r.fragen[k] as string, baender: baender[k] }))
  return { ...r, baender, fragenliste }
}

export const REFERENZEN: Record<string, Referenzmoebel> = {
  einbauschrank: mitBaendern({
    name: 'Einbauschrank',
    text: 'Einbauschrank Flur, 2,00 m breit × 2,40 m hoch × 0,60 m tief. Korpus und Fronten Egger Dekorspanplatte 19 mm weiß, Kanten ABS 1 mm. 4 Drehtüren mit Topfscharnieren, 2 Schubkästen auf Systemauszügen, Kleiderstange, je Fach 2 Einlegeböden, Sockel 100 mm, Rückwand. Lieferung und Montage beim Kunden, 20 km entfernt, Neubau, gerade Wände.',
    fragen: {
      grund: 'Was nimmst du für so einen Schrank, netto?',
      lack: 'Derselbe Schrank, aber alles weiß lackiert seidenmatt statt Dekor. Was kommt dazu?',
      massiv: 'Derselbe Schrank in Eiche massiv, geölt. Was nimmst du?',
      montage: 'Derselbe Schrank im Altbau: Wände nicht im Lot, Dielenboden, zweiter Stock ohne Aufzug. Wie lange bist du dran?',
    },
    ...REFERENZ,
  }),
  ...Object.fromEntries(Object.entries(SPECS).map(([k, spec]) =>
    [k, mitBaendern(baueReferenz(spec))])),
}

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
- Bei lackierten Teilen KEINE Zeit auf der Kostenstelle "Oberfläche" ansetzen.
- Stattdessen eine Materialposition anlegen: bezeichnung "${LACK_BEZEICHNUNG}", einheit "m²", menge = zu lackierende Sichtflaeche in m².
- Den Quadratmeterpreis kennst du NICHT und darfst ihn NICHT schaetzen. Lackierte Teile kosten je nach Qualitaet und Region sehr unterschiedlich. Steht in der Preisliste kein fixierter Preis dafuer, setze ekPreis auf 0 — der Nutzer traegt ihn ein.
- Oelen, Wachsen und Schleifen macht er weiterhin selbst. Dafuer bleibt "Oberfläche" mit ihrer Zeit.`
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

export function referenzPreis(
  saetze: Saetze, aufschlag: number, ref: Referenzmoebel = REFERENZEN.einbauschrank,
) {
  const material  = ref.materialEk * (1 + aufschlag)
  const fixsockel = wert(ref.fixsockel, saetze)
  const werkstatt = wert(ref.werkstatt, saetze)
  const montage   = wert(ref.montage, saetze)
  return { material, fixsockel, werkstatt, montage, gesamt: material + fixsockel + werkstatt + montage }
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
  if (grund !== null && skalierbar > 0) {
    f.werkstatt = deckele((grund - r.material - r.fixsockel) / skalierbar)
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
    const massivMaterial = ref.massivMaterialEk * (1 + aufschlag)
    const massivWerkstatt = wert(ref.werkstatt, saetze, ref.massivWerkstattFaktor)
    const massivOberflaeche = (ref.massivOberflaecheMinuten / 60) * (saetze['Oberfläche'] ?? 72)
    const zeitanteil = massivWerkstatt + massivOberflaeche
    if (zeitanteil > 0) {
      f.massivholz = deckele((massiv - massivMaterial - r.fixsockel - r.montage) / zeitanteil)
    }
  }

  // Gefragt wird die ALTBAU-Dauer in Tagen, verglichen gegen unsere Altbau-Erwartung
  // (Neubau x 1,6, ohne Fahrt). Der Faktor gilt dann fuer alle Montage; der
  // Altbau-Zuschlag selbst bleibt Sache der Engine.
  // Ueberschreibt die geerbte Montage, wenn ausdruecklich beantwortet.
  const montage = mitte('montage', a.montage, ref)
  if (montage !== null) {
    const basis = ref.montage.find(p => p.kostenstelle === 'Montage')?.minuten ?? 240
    const erwartetMin = basis * ref.altbauFaktor
    if (erwartetMin > 0) f.montage = deckele(montage / erwartetMin)
  }

  return f
}
