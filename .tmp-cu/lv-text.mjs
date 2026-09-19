import { readFileSync } from 'node:fs'
import { extractText, getDocumentProxy } from 'unpdf'
import { schneideText, schnittRang } from '../src/lib/bloecke.ts'
const pdf = await getDocumentProxy(new Uint8Array(readFileSync('/tmp/lvtest/leistungsverzeichnis.pdf')))
const { text } = await extractText(pdf, { mergePages: true })
const zeilen = text.split('\n')
console.log('zeichen', text.length, 'zeilen', zeilen.length, 'rang3', zeilen.filter((z, i) => schnittRang(z, zeilen[i-1] ?? '') === 3).length)
console.log(JSON.stringify(zeilen.slice(0, 12)))
console.log('bloecke', schneideText(text).map(t => t.length))
