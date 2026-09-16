// Große Projekte in Blöcken — die reine Teil-Logik. Importiert bewusst NICHTS
// (auch nicht plaene.ts), damit `npm run test` die Datei direkt ausführt.
//
// WARUM DAS DER KERN IST: Bis zum 2026-09-16 hat /api/analyze jeden Text nach 10.000
// Zeichen abgeschnitten — schweigend. Ein 40-seitiges Leistungsverzeichnis verlor
// dabei den größten Teil seiner Positionen, und im Angebot fehlten sie einfach.
// Diese Datei ist die Gegenprobe: Was hier hineingeht, kommt vollständig wieder
// heraus, verteilt auf Blöcke. Der Test prüft nicht die Schnittstellen allein,
// sondern dass sich der Ausgangstext wieder zusammensetzen lässt.

export const MAX_ZEICHEN_JE_BLOCK = 8000
export const MAX_BILDER_JE_BLOCK = 6

/** Zeile beginnt mit einer Positionsnummer: "1.2", "01.03.0040", "4)", "Pos. 4". */
const POSITIONSNUMMER = /^\s*(?:Pos\.?\s*)?\d{1,4}(?:[.\-]\d{1,4}){0,3}[.)]?\s+\S/
/** Seitenumbruch: Seitenvorschub oder eine Zeile wie "--- Seite 12 ---". */
const SEITENUMBRUCH = /^\s*(?:\f|-{0,3}\s*Seite\s+\d+)/i

/**
 * Wie gut eignet sich diese Zeile als Blockanfang?
 * 3 = Positionsnummer, 2 = Seitengrenze, 1 = Absatzanfang, 0 = mitten im Text.
 */
export function schnittRang(zeile: string, vorige: string): 0 | 1 | 2 | 3 {
  const z = String(zeile ?? '')
  if (!z.trim()) return 0
  if (POSITIONSNUMMER.test(z)) return 3
  if (SEITENUMBRUCH.test(z)) return 2
  if (String(vorige ?? '').trim() === '') return 1
  return 0
}

/**
 * Schneidet den Text in Stücke von höchstens `maxZeichen` Zeichen.
 * Der Schnitt fällt auf die beste Grenze innerhalb des Stücks — Positionsnummer vor
 * Seitengrenze vor Absatz. Gibt es keine, wird an der Zeilengrenze geschnitten.
 * Eine einzelne Zeile, die für sich länger ist als `maxZeichen`, bildet ihren
 * eigenen Block: lieber ein zu großer Block als eine verschwundene Zeile.
 */
export function schneideText(text: string, maxZeichen = MAX_ZEICHEN_JE_BLOCK): string[] {
  const roh = String(text ?? '').replace(/\r\n?/g, '\n')
  if (!roh.trim()) return []
  if (roh.length <= maxZeichen) return [roh.trim()]

  const zeilen = roh.split('\n')
  const rang = zeilen.map((z, i) => schnittRang(z, i > 0 ? zeilen[i - 1] : ''))
  const teile: string[] = []
  let start = 0

  while (start < zeilen.length) {
    let ende = start
    let laenge = 0
    while (ende < zeilen.length) {
      const zusatz = (ende === start ? 0 : 1) + zeilen[ende].length
      if (laenge + zusatz > maxZeichen && ende > start) break
      laenge += zusatz
      ende++
    }
    if (ende < zeilen.length) {
      // Rückwärts die beste Grenze suchen: erst Positionsnummern, dann Seiten,
      // dann Absätze. Gefunden wird der ANFANG des nächsten Blocks.
      let gewaehlt = -1
      for (const r of [3, 2, 1] as const) {
        for (let i = ende; i > start; i--) if (rang[i] === r) { gewaehlt = i; break }
        if (gewaehlt > start) break
      }
      if (gewaehlt > start) ende = gewaehlt
    }
    const stueck = zeilen.slice(start, ende).join('\n').trim()
    if (stueck) teile.push(stueck)
    start = ende
  }
  return teile
}

export type Block = { nr: number; text: string; bilder: string[] }

/**
 * Text und Bilder auf Blöcke verteilen. Bilder gehen in Upload-Reihenfolge, je Block
 * höchstens `maxBilder`. Gibt es mehr Bilderblöcke als Textblöcke, entstehen Blöcke
 * mit leerem Text — Bilder ohne Text sind eine gültige Anfrage (Fotos vom Aufmaß).
 */
export function teileInBloecke(
  text: string,
  bilder: string[],
  maxZeichen = MAX_ZEICHEN_JE_BLOCK,
  maxBilder = MAX_BILDER_JE_BLOCK,
): Block[] {
  const texte = schneideText(text, maxZeichen)
  const liste = (Array.isArray(bilder) ? bilder : []).filter(Boolean)
  const anzahl = Math.max(texte.length, Math.ceil(liste.length / maxBilder))
  const bloecke: Block[] = []
  for (let i = 0; i < anzahl; i++) {
    bloecke.push({
      nr: i + 1,
      text: texte[i] ?? '',
      bilder: liste.slice(i * maxBilder, (i + 1) * maxBilder),
    })
  }
  return bloecke
}

export type BlockInfo = { nr: number; vorschau: string; zeichen: number; bilder: number }

/** Was der Browser über die Blöcke wissen muss — ohne den ganzen Text zu übertragen. */
export function blockInfos(bloecke: Block[]): BlockInfo[] {
  return (bloecke ?? []).map(b => {
    const einzeilig = String(b.text ?? '').replace(/\s+/g, ' ').trim()
    return {
      nr: b.nr,
      vorschau: einzeilig.length > 120 ? `${einzeilig.slice(0, 121)} …` : einzeilig,
      zeichen: String(b.text ?? '').length,
      bilder: (b.bilder ?? []).length,
    }
  })
}
