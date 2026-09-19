// Verifiziert Fix 1 ohne Netzwerk: fährt exakt den Extraktionsweg der Route
// (getDocumentProxy + zeilenAusTextstuecken) über das Test-PDF und zählt.
import { readFileSync } from 'node:fs'
import { getDocumentProxy } from 'unpdf'
import { zeilenAusTextstuecken, schneideText, schnittRang } from '../src/lib/bloecke.ts'

const bytes = new Uint8Array(readFileSync('/tmp/lvtest/leistungsverzeichnis.pdf'))
const pdf = await getDocumentProxy(bytes)
const seiten = []
for (let seite = 1; seite <= pdf.numPages; seite++) {
  const tc = await (await pdf.getPage(seite)).getTextContent()
  const stuecke = tc.items
    .filter(it => typeof it.str === 'string')
    .map(it => ({ str: it.str, y: it.transform?.[5] ?? 0, eol: it.hasEOL }))
  seiten.push(zeilenAusTextstuecken(stuecke))
}
const text = seiten.join('\n\n')

const zeilen = text.split('\n')
const raenge = zeilen.map((z, i) => schnittRang(z, i > 0 ? zeilen[i - 1] : ''))
const rang3 = raenge.filter(r => r === 3).length

const bloecke = schneideText(text)

console.log('Seiten:', pdf.numPages)
console.log('Anzahl Zeilen:', zeilen.length)
console.log('Rang-3-Zeilen (Positionszeilen):', rang3)
console.log('Anzahl Blöcke:', bloecke.length)
console.log('Positionen je Block:', bloecke.map(b => (b.match(/^Pos\.\s+\d+\.\d+/gm) ?? []).length))
console.log('--- erste 5 Zeilen ---')
console.log(zeilen.slice(0, 5).join('\n---\n'))
