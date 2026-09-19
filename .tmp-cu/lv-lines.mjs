import { readFileSync } from 'node:fs'
import { getDocumentProxy } from 'unpdf'
const pdf = await getDocumentProxy(new Uint8Array(readFileSync('/tmp/lvtest/leistungsverzeichnis.pdf')))
let alle = []
for (let p = 1; p <= pdf.numPages; p++) {
  const page = await pdf.getPage(p); const tc = await page.getTextContent()
  const items = tc.items.filter(i => 'str' in i).map(i => ({ str: i.str, x: i.transform[4], y: i.transform[5], eol: i.hasEOL }))
  alle.push({ seite: p, n: items.length, eol: items.filter(i => i.eol).length, ys: new Set(items.map(i => Math.round(i.y))).size, probe: items.slice(0, 6) })
}
console.log(JSON.stringify(alle, null, 0).slice(0, 1200))
console.log('unpdf', JSON.parse(readFileSync('node_modules/unpdf/package.json')).version)
