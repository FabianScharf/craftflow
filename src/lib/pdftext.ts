// Textaufbereitung und Struktur für das Angebots-PDF.
//
// Importiert bewusst NICHTS — nur so laufen die Tests ohne Bundler (Node kann in
// einer .ts-Datei keine Import-Pfade ohne Endung auflösen). Deshalb liegt hier die
// Logik und in pdf.ts nur noch die Vorlage.
//
// Alles in dieser Datei geht auf die Rückmeldung von Constantin Ludewigt
// (Tischlerei Lilie) vom 2026-08-26 zurück.

// ── Absätze ─────────────────────────────────────────────────────────────────
//
// "Wenn ich Absätze einbaue, um das Geschriebene übersichtlich zu gestalten, dann
// werden die Absätze nicht übernommen und sind in der PDF als absatzfreier
// Fließtext eingesetzt."
//
// Er hatte recht, und zwar an sechs von acht Stellen: Nur der Hinweisblock und die
// Grußformel wandelten Zeilenumbrüche um. Anschreiben, Widerrufstext,
// Zahlungskondition, Massivholzhinweis, Unterschriftstext und Anrede nicht.
//
// Leerzeile = neuer Absatz mit Abstand. Einzelner Umbruch = Zeilenwechsel ohne
// Abstand. Genau so, wie man es in ein Textfeld tippt.
export function alsAbsaetze(text: string): string {
  return String(text ?? '')
    .replace(/\r\n?/g, '\n')
    .split(/\n{2,}/)
    .map(a => a.trim())
    .filter(Boolean)
    .map(a => `<p>${a.replace(/\n/g, '<br>')}</p>`)
    .join('')
}

// ── Schriften ───────────────────────────────────────────────────────────────
//
// GEMESSEN AM 2026-09-08: Auf Vercel rendert das PDF mit @sparticuz/chromium, und
// dort ist GENAU EINE Schrift installiert. Ein Test mit vier Familien (Helvetica
// Neue, Arial, Times New Roman, Georgia) ergab im fertigen PDF exakt einen
// eingebetteten Font: OpenSans-Regular. Alle Angaben fielen darauf zurück, auch die
// beiden Serifen.
//
// Eine Schriftwahl muss die Schrift deshalb MITLIEFERN. Die Dateien liegen unter
// public/fonts/ (Lizenzen dort in LIZENZEN.md) und werden per @font-face mit
// absoluter Adresse geladen — dieselbe Adresse für die Bildschirmvorschau und für
// den Chromium auf dem Server, damit beide gleich aussehen.
export type SchriftId = 'opensans' | 'inter' | 'lato' | 'ptserif'

export const SCHRIFTEN: Record<SchriftId, { name: string; stapel: string; dateien: Array<{ gewicht: number; datei: string }> }> = {
  opensans: {
    name: 'Open Sans', stapel: "'Open Sans',Helvetica,Arial,sans-serif",
    dateien: [{ gewicht: 400, datei: 'open-sans-400.woff2' }, { gewicht: 700, datei: 'open-sans-700.woff2' }],
  },
  inter: {
    name: 'Inter', stapel: "'Inter',Helvetica,Arial,sans-serif",
    dateien: [{ gewicht: 400, datei: 'inter-400.woff2' }, { gewicht: 700, datei: 'inter-700.woff2' }],
  },
  lato: {
    name: 'Lato', stapel: "'Lato',Helvetica,Arial,sans-serif",
    dateien: [{ gewicht: 400, datei: 'lato-400.woff2' }, { gewicht: 700, datei: 'lato-700.woff2' }],
  },
  ptserif: {
    name: 'PT Serif', stapel: "'PT Serif',Georgia,'Times New Roman',serif",
    dateien: [{ gewicht: 400, datei: 'pt-serif-400.woff2' }, { gewicht: 700, datei: 'pt-serif-700.woff2' }],
  },
}

export function fontFaces(id: SchriftId, basisUrl: string): string {
  const s = SCHRIFTEN[id]
  if (!s || !basisUrl) return ''
  return s.dateien.map(d =>
    `@font-face{font-family:'${s.name}';font-style:normal;font-weight:${d.gewicht};`
    + `font-display:block;src:url('${basisUrl}/fonts/${d.datei}') format('woff2')}`
  ).join('')
}

// ── Anrede ──────────────────────────────────────────────────────────────────
//
// "In der Anrede des Angebots wird nur der pre-text (Guten Tag) geschrieben und dann
// direkt der Name. Es fehlt mir die Anrede Herr oder Frau."
//
// Vorher gab es nur {name}, deshalb konnte höchstens "Guten Tag Constantin Ludewigt"
// herauskommen — ein "Sehr geehrter Herr Ludewigt" war gar nicht baubar.
export function anredeAus(
  vorlage: string,
  kunde: { name?: string; anrede?: string; nachname?: string },
): string {
  // Fehlt der Nachname, nimmt die Vorlage das letzte Wort des Namens. Das trifft die
  // meisten Fälle, und wer es nicht braucht, muss kein zweites Feld pflegen.
  const nachname = (kunde.nachname || '').trim()
    || (kunde.name || '').trim().split(/\s+/).filter(Boolean).slice(-1)[0]
    || ''
  return (vorlage || 'Liebe/r {name},')
    .replace(/\{anrede\}/g, (kunde.anrede || '').trim())
    .replace(/\{nachname\}/g, nachname)
    .replace(/\{name\}/g, kunde.name || 'Kundin / Kunde')
    // Ohne Anrede bliebe sonst eine doppelte Lücke oder ein Leerzeichen vor dem Komma.
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\s+([,.!?])/g, '$1')
    .trim()
}

// ── Positionsstruktur ───────────────────────────────────────────────────────
//
// "Die Positionsüberschriften werden immer 2-mal aufgezählt."
//
// Er hatte recht: Der Titel stand hart in BEIDEN Zeilen — in der Gruppen- und in der
// Detailzeile. Aufeinanderfolgende Positionen mit derselben Gruppe bilden jetzt EINEN
// Block mit gemeinsamer Kopfzeile, so wie im Referenzangebot "Pos. 1  Flurschrank"
// mit 1.001 Korpusse, 1.002 Beleuchtung, 1.003 Türen darunter. Ohne Gruppe gibt es
// gar keine Kopfzeile mehr.
export type Gruppierbar = { gruppe?: string }

export function positionsBloecke<T extends Gruppierbar>(pos: readonly T[]): Array<{ gruppe?: string; teile: T[] }> {
  const bloecke: Array<{ gruppe?: string; teile: T[] }> = []
  for (const p of pos ?? []) {
    const g = (p?.gruppe ?? '').trim()
    const letzter = bloecke[bloecke.length - 1]
    if (g && letzter && letzter.gruppe === g) letzter.teile.push(p)
    else bloecke.push({ gruppe: g || undefined, teile: [p] })
  }
  return bloecke
}

/** Positionsnummer wie im Referenzangebot: 1.001, 1.002, … */
export function unterNummer(block: number, teil: number): string {
  return `${block}.${String(teil).padStart(3, '0')}`
}
