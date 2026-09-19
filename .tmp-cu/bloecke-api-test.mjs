// API-Live-Test Teil C (ohne Browser-Ablauf): Upload → Vorbereiten → EIN Block (KI, ~0,2 $)
import puppeteer from 'puppeteer-core'
import { readFileSync } from 'node:fs'
const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null, protocolTimeout: 400000 })
const sleep = ms => new Promise(r => setTimeout(r, ms))
const page = await browser.newPage()
await page.goto('https://craftflow-git-dev-fabian-scharf-s-projects.vercel.app/', { waitUntil: 'domcontentloaded', timeout: 90000 }); await sleep(3000)
const dateien = [['leistungsverzeichnis.pdf', 'application/pdf'], ...[1,2,3,4,5,6,7,8].map(i => [`foto-${i}.png`, 'image/png'])].map(([n, t]) => ({ name: n, typ: t, b64: readFileSync('/tmp/lvtest/' + n).toString('base64') }))
const r = await page.evaluate(async (dateien, nurBlock) => {
  const out = { uploads: [] }
  let projektId = null
  for (const d of dateien) {
    const bin = Uint8Array.from(atob(d.b64), c => c.charCodeAt(0))
    const fd = new FormData(); fd.append('file', new File([bin], d.name, { type: d.typ })); if (projektId) fd.append('projekt_id', projektId)
    const res = await fetch('/api/upload', { method: 'POST', body: fd }); const j = await res.json().catch(() => ({}))
    if (!projektId) projektId = j.projekt_id
    out.uploads.push(res.status + (j.error ? ' ' + j.error.slice(0, 50) : ''))
  }
  out.projektId = projektId
  const t0 = Date.now()
  const v = await fetch('/api/analyze/vorbereiten', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projekt_id: projektId, text: 'Bitte alle Positionen des Leistungsverzeichnisses kalkulieren. Kunde: Beispiel Bau GmbH, Musterstraße 12, 63450 Hanau.' }) })
  const vj = await v.json().catch(() => ({}))
  out.vorbereiten = { status: v.status, sekunden: Math.round((Date.now() - t0) / 1000), error: vj.error, bloecke: (vj.bloecke || []).map(b => ({ nr: b.nr, zeichen: b.zeichen, bilder: b.bilder, vorschau: String(b.vorschau).slice(0, 60) })), nichtVerarbeitet: vj.nichtVerarbeitet }
  if (nurBlock && vj.bloecke?.length) {
    const t1 = Date.now()
    const b = await fetch('/api/analyze/block', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projekt_id: projektId, blockNr: 1, kontext: null }) })
    const bj = await b.json().catch(() => ({}))
    out.block1 = { status: b.status, sekunden: Math.round((Date.now() - t1) / 1000), success: bj.success, error: bj.error, positionen: (bj.data?.positionen || []).length, titel: (bj.data?.positionen || []).slice(0, 4).map(p => p.titel) }
  }
  return out
}, dateien, true)
console.log(JSON.stringify(r, null, 1))
await page.close(); browser.disconnect()
