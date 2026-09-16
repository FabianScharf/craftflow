// Farbschema der App aus zwei Nutzerfarben ableiten.
//
// ANLASS (Kundenrueckmeldung 2026-09-15, Tischlerei ueber Instagram): Wer als
// Primaerfarbe Weiss waehlte, sah fast nichts mehr — die Schrift war fest auf
// "hell auf dunkel" eingestellt. Ausserdem "ging der Rotton leicht ins Lila": der
// Farbwaehler des Betriebssystems rechnet eingetippte Codes in ein anderes Farbprofil
// um. Deshalb ist das Textfeld fuehrend und wird hier bereinigt.
//
// Reine Funktionen ohne Importe — `npm run test` fuehrt sie direkt aus (Node-Type-
// Stripping). Nichts hier darf Supabase oder React brauchen.

export type Palette = {
  primary: string   // Hintergrund der App
  accent: string    // Buttons, Highlights, Linien im PDF
  text: string      // Haupttext
  textMid: string   // Nebentext, Labels
  surface1: string  // Kaesten, Karten
  surface2: string  // Eingabefelder, zweite Ebene
  border: string    // Rahmen, Trennlinien
  darkbg: string    // Kopfzeile, Leisten
  onAccent: string  // Schrift AUF der Akzentfarbe (Knopfbeschriftung)
  ok: string        // Erfolg, "gespeichert", gewonnen
  err: string       // Fehler, verloren, Warnkasten
  warn: string      // Hinweis, Testversion, offen
}

/** Die Palette von heute — bleibt fuer jede dunkle Primaerfarbe byte-identisch. */
export const PALETTE_DUNKEL: Palette = {
  primary: '#0D0D0D',
  accent: '#C8885A',
  text: '#F5F2EE',
  textMid: '#8A8A8A',
  surface1: '#1E1E1E',
  surface2: '#2A2A2A',
  border: '#2E2E2E',
  darkbg: '#141414',
  onAccent: '#0D0D0D',
  ok: '#5ABE6A',
  err: '#E05A5A',
  warn: '#F5C518',
}

/**
 * "#c8102e", "c8102e", " #C8102E ", "#f00" → "#C8102E" bzw. "#FF0000".
 * Alles andere → null. Niemals raten.
 */
export function normalisiereHex(eingabe: string | null | undefined): string | null {
  if (typeof eingabe !== 'string') return null
  let s = eingabe.trim().replace(/^#/, '').toUpperCase()
  if (/^[0-9A-F]{3}$/.test(s)) s = s.split('').map(c => c + c).join('')
  if (!/^[0-9A-F]{6}$/.test(s)) return null
  return '#' + s
}

function kanaele(hex: string): [number, number, number] {
  const h = normalisiereHex(hex) ?? '#000000'
  return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]
}

function zuHex(r: number, g: number, b: number): string {
  const k = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0').toUpperCase()
  return '#' + k(r) + k(g) + k(b)
}

/** Relative Leuchtdichte nach WCAG, 0 (schwarz) bis 1 (weiss). */
export function leuchtdichte(hex: string): number {
  const [r, g, b] = kanaele(hex).map(v => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** Kontrastverhaeltnis nach WCAG (1 bis 21). */
export function kontrast(a: string, b: string): number {
  const la = leuchtdichte(a), lb = leuchtdichte(b)
  const [hell, dunkel] = la > lb ? [la, lb] : [lb, la]
  return Math.round(((hell + 0.05) / (dunkel + 0.05)) * 100) / 100
}

/**
 * Hell heisst: dunkle Schrift liest sich besser als helle. Die Grenze liegt dort,
 * wo Schwarz und Weiss denselben Kontrast erreichen (Leuchtdichte ≈ 0,179).
 */
export function istHell(hex: string): boolean {
  return leuchtdichte(hex) > 0.179
}

/** Mischt `anteil` (0..1) von Farbe b in Farbe a. */
export function mische(a: string, b: string, anteil: number): string {
  const [r1, g1, b1] = kanaele(a), [r2, g2, b2] = kanaele(b)
  const t = Math.max(0, Math.min(1, anteil))
  return zuHex(r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t)
}

/** Erste Farbe der Reihe, die auf dem Grund mindestens Kontrast 4,5 erreicht (sonst die letzte). */
function lesbar(kandidaten: string[], grund: string): string {
  return kandidaten.find(f => kontrast(f, grund) >= 4.5) ?? kandidaten[kandidaten.length - 1]
}

/**
 * Schrift auf der Akzentfarbe: Schwarz oder Weiss — was besser lesbar ist.
 *
 * GEFUNDEN 2026-09-16 (Farb-Audit): Knopfbeschriftungen standen ueberall als
 * `color: C.black` auf `background: C.copper`. C.black ist aber die PRIMAERfarbe
 * des Nutzers und nicht garantiert dunkel — bei hellem Primaer plus hellem Akzent
 * war die Knopfschrift praktisch unsichtbar. Der Akzent wurde nie gegen irgendetwas
 * kontrastgeprueft. Seither: C.onAccent.
 */
function schriftAufAkzent(accent: string): string {
  return kontrast('#FFFFFF', accent) >= kontrast('#0D0D0D', accent) ? '#FFFFFF' : '#0D0D0D'
}

/** Die dunkelste der drei Flaechen — darauf muss eine dunkle Statusfarbe noch lesen. */
function dunkelsterGrund(farben: string[]): string {
  return farben.reduce((a, b) => (leuchtdichte(a) <= leuchtdichte(b) ? a : b))
}

/**
 * Aus Primaer- und Akzentfarbe die komplette Palette bauen.
 * Dunkle Primaerfarbe → heutige Palette, nur mit der eigenen Hintergrundfarbe.
 * Helle Primaerfarbe → dunkle Schrift, Flaechen einen Hauch dunkler als der Grund.
 */
export function leitePaletteAb(primaer: string | null | undefined, akzent: string | null | undefined): Palette {
  const primary = normalisiereHex(primaer) ?? PALETTE_DUNKEL.primary
  const accent = normalisiereHex(akzent) ?? PALETTE_DUNKEL.accent

  if (!istHell(primary)) {
    // Auf tiefem Schwarz reichen die Standard-Statusfarben. Auf einem dunklen Blau
    // oder Gruen kann Rot zu schwach werden — dann die hellere Stufe nehmen.
    // Flaechen, Rahmen und Nebentext aus der Primaerfarbe ableiten statt aus festem Grau.
    // GEFUNDEN 16.09. (Fabian, Primaer #955050): Auf einem dunklen Rot standen pechschwarze
    // Kaesten, Eingabefelder und eine schwarze Kopfzeile — die Grautoene der Standardpalette
    // passen nur zu Schwarz. Die Mischanteile sind so gewaehlt, dass Schwarz (#0D0D0D)
    // exakt die bisherigen Werte ergibt; jede andere dunkle Farbe bekommt ihren eigenen Ton.
    // Nahe Schwarz gibt es nur eine Richtung: aufhellen. Bei einem dunklen Rot, Gruen
    // oder Blau werden Kaesten und Felder dagegen etwas DUNKLER als der Grund — so
    // bleibt die helle Schrift darauf kraeftig (Kontrast >= 4,5), und der Ton bleibt
    // erhalten. Rahmen und Nebentext werden aufgehellt, damit sie sich abheben.
    const nahSchwarz = leuchtdichte(primary) < 0.02
    const hell = (anteil: number) => mische(primary, '#FFFFFF', anteil)
    const dunkel = (anteil: number) => mische(primary, '#000000', anteil)
    return {
      ...PALETTE_DUNKEL, primary, accent,
      surface1: nahSchwarz ? hell(17 / 242) : dunkel(0.14),   // #0D0D0D → #1E1E1E
      surface2: nahSchwarz ? hell(29 / 242) : dunkel(0.24),   // → #2A2A2A
      border:   nahSchwarz ? hell(33 / 242) : hell(0.18),     // → #2E2E2E
      darkbg:   nahSchwarz ? hell(7 / 242)  : dunkel(0.10),   // → #141414
      textMid:  nahSchwarz ? hell(125 / 242) : hell(0.68),    // → #8A8A8A
      onAccent: schriftAufAkzent(accent),
      ok: lesbar(['#5ABE6A', '#8EDB9A', '#C4F0CB'], primary),
      err: lesbar(['#E05A5A', '#FF8A80', '#FFB4AD'], primary),
      warn: lesbar(['#F5C518', '#FFDD66', '#FFEEAA'], primary),
    }
  }

  // Helle Flaeche: Schrift dunkel, Nebentext dunkelgrau, Kaesten leicht abgesetzt.
  // Die Mischung erhaelt den Farbton des Grundes (Creme bleibt Creme).
  // Sehr helle Gruende bekommen etwas dunklere Kaesten; mittlere Toene (Grau) etwas
  // hellere — sonst rueckt die Flaeche der Schrift entgegen und der Kontrast kippt.
  const richtung = leuchtdichte(primary) >= 0.5 ? '#000000' : '#FFFFFF'
  const text = mische(primary, '#000000', 0.95)
  const textMid = mische(primary, '#000000', 0.62)
  const surface1 = mische(primary, richtung, 0.04)
  const surface2 = mische(primary, richtung, 0.08)
  // GEFUNDEN 2026-09-16 (Farb-Audit): Der helle Zweig setzte ok/err/warn FEST, ohne
  // `lesbar()`-Pruefung — anders als der dunkle Zweig. Bei einer nur knapp hellen
  // Primaerfarbe sank der Kontrast von z. B. #7A5F00 auf ~1,4:1. Jetzt wird wie im
  // dunklen Zweig geprueft, und zwar gegen die DUNKELSTE der drei Flaechen, auf denen
  // eine Statusfarbe stehen kann (Grund, Kaesten, Eingabefelder).
  const grund = dunkelsterGrund([primary, surface1, surface2])
  return {
    primary,
    accent,
    text,
    textMid,
    surface1,
    surface2,
    border: mische(primary, richtung, 0.16),
    darkbg: mische(primary, richtung, 0.03),
    onAccent: schriftAufAkzent(accent),
    // Statusfarben fuer hellen Grund: dunkler, damit sie als Schrift lesbar bleiben.
    ok: lesbar(['#2E7D32', '#1B5E20', '#0B3D0F'], grund),
    err: lesbar(['#B3261E', '#8C1D18', '#5A0F0C'], grund),
    warn: lesbar(['#7A5F00', '#5A4600', '#3A2D00'], grund),
  }
}

/** Namen der CSS-Variablen, die die Palette im Browser setzt. */
export const THEME_VARS: Record<keyof Palette, string> = {
  primary: '--c-primary',
  accent: '--c-accent',
  text: '--c-text',
  textMid: '--c-text-mid',
  surface1: '--c-surface1',
  surface2: '--c-surface2',
  border: '--c-border',
  darkbg: '--c-darkbg',
  onAccent: '--c-on-accent',
  ok: '--c-ok',
  err: '--c-err',
  warn: '--c-warn',
}

/** Palette auf ein Element (in der Praxis document.documentElement) schreiben. */
export function wendePaletteAn(
  ziel: { style: { setProperty(name: string, value: string): void } },
  palette: Palette,
): void {
  for (const k of Object.keys(THEME_VARS) as (keyof Palette)[]) {
    ziel.style.setProperty(THEME_VARS[k], palette[k])
  }
}

/**
 * Akzentfarbe mit Transparenz — als gueltiges CSS.
 *
 * GEFUNDEN 2026-09-15: Ueber 40 Stellen haengten "55" oder "15" an C.copper, um
 * eine zarte Toenung zu bekommen. Seit C.copper eine CSS-Variable ist, ergab das
 * "var(--c-accent, #C8885A)55" — ungueltig, die Toenung fiel stumm weg.
 * `alphaHex` ist der alte zweistellige Hex-Anhang (00..FF).
 */
export function akzentTon(alphaHex: string): string {
  return ton('var(--c-accent, #C8885A)', alphaHex)
}

/** Beliebige Farbe (auch eine CSS-Variable) mit Transparenz — gueltiges CSS. */
export function ton(farbe: string, alphaHex: string): string {
  const prozent = Math.round((parseInt(alphaHex, 16) / 255) * 100)
  return `color-mix(in srgb, ${farbe} ${prozent}%, transparent)`
}
