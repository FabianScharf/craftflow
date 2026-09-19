import { readFileSync } from 'node:fs'
import { getDocumentProxy } from 'unpdf'
import { zeilenAusTextstuecken, schneideText } from '../src/lib/bloecke.ts'
import { parseLaufmeter } from '../src/lib/laufmeter.ts'
const pdf = await getDocumentProxy(new Uint8Array(readFileSync('/tmp/lvtest/leistungsverzeichnis.pdf')))
const seiten = []
for (let p = 1; p <= pdf.numPages; p++) { const tc = await (await pdf.getPage(p)).getTextContent(); seiten.push(zeilenAusTextstuecken(tc.items.filter(i => typeof i.str === 'string').map(i => ({ str: i.str, y: i.transform[5], eol: i.hasEOL })))) }
const bloecke = schneideText(seiten.join('\n\n'))
console.log('lm je Block (Gesamttext als Eingabe):', bloecke.map(b => parseLaufmeter(b)))
console.log('lm einzelne Positionen:', ['Einbauschrank Flur, raumhoch, 2.400 x 2.650 x 600 mm, Korpus Spanplatte', 'Fensterbank Eiche massiv 25 mm, 1.400 x 250 mm, geölt', 'Griffe Edelstahl gebürstet 320 mm', 'Fußleisten Eiche massiv 60 x 15 mm, geölt, 42 lfm'].map(parseLaufmeter))
