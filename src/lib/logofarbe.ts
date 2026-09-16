// Kräftigste Farbe eines Logos aus seinen Bildpunkten lesen.
//
// Importiert bewusst NICHTS, damit `npm run test` die Datei direkt ausführt.
//
// ANLASS (16.09.2026, Tischlerei Lembeck): Der Kunde tippte als Akzentfarbe #75001D
// ein — sein Logo hat #813732. Ein Schreiner kennt seinen Farbcode selten; er rät
// oder nimmt den Wert aus dem Farbfenster des Betriebssystems (das Codes umrechnet).
// Das Logo liegt aber ohnehin in CraftFlow. Diese Funktion holt die Farbe daraus.
//
// Regeln: Durchsichtige, fast weiße, fast schwarze und graue Bildpunkte zählen nicht
// (Hintergrund, Schrift, Schatten). Von den übrigen wird der häufigste Farbton genommen
// und aus seinen Bildpunkten der Mittelwert gebildet — so bleibt ein Logo mit einem
// Rot und weißer Schrift bei seinem Rot, nicht bei einem Mischton.

export const MINDEST_ANTEIL = 0.005 // unter 0,5 % aller sichtbaren Punkte ist es Rauschen

type Kandidat = { n: number; r: number; g: number; b: number }

const zuHex = (r: number, g: number, b: number): string =>
  '#' + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0').toUpperCase()).join('')

/** Sättigung 0..1 (HSV): Grau hat 0, reines Rot 1. */
function saettigung(r: number, g: number, b: number): number {
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  return max === 0 ? 0 : (max - min) / max
}

/**
 * Liefert die kräftigste Farbe als "#RRGGBB" oder null, wenn das Logo nur aus
 * Schwarz, Weiß, Grau und Durchsichtigem besteht.
 * `pixel` sind RGBA-Werte, vier je Bildpunkt (wie ImageData.data).
 */
export function dominanteFarbe(pixel: ArrayLike<number> | null | undefined): string | null {
  if (!pixel || pixel.length < 4) return null
  const eimer = new Map<string, Kandidat>()
  let sichtbar = 0
  for (let i = 0; i + 3 < pixel.length; i += 4) {
    const r = pixel[i], g = pixel[i + 1], b = pixel[i + 2], a = pixel[i + 3]
    if (a < 128) continue
    sichtbar++
    const max = Math.max(r, g, b), min = Math.min(r, g, b)
    if (min > 235) continue            // fast weiß
    if (max < 40) continue             // fast schwarz
    if (saettigung(r, g, b) < 0.25) continue // grau / ausgewaschen
    // Grobe Eimer (16er-Schritte), damit JPEG-Rauschen und Kantenglättung zusammenfallen.
    const k = `${r >> 4},${g >> 4},${b >> 4}`
    const e = eimer.get(k) ?? { n: 0, r: 0, g: 0, b: 0 }
    e.n++; e.r += r; e.g += g; e.b += b
    eimer.set(k, e)
  }
  if (sichtbar === 0 || eimer.size === 0) return null
  let bester: Kandidat | null = null
  for (const e of eimer.values()) if (!bester || e.n > bester.n) bester = e
  if (!bester || bester.n / sichtbar < MINDEST_ANTEIL) return null
  return zuHex(bester.r / bester.n, bester.g / bester.n, bester.b / bester.n)
}
