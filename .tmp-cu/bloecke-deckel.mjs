// Live-Test Teil C, kostenfreie Schritte 1-3: Upload-Sperre (solo), Dateideckel (starter), Blöcke ab Pro (starter)
// Aufruf: node .tmp-cu/bloecke-deckel.mjs <upload403|deckel5|bloecke403>
import puppeteer from 'puppeteer-core'
import { readFileSync } from 'node:fs'
const modus = process.argv[2]
const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null, protocolTimeout: 300000 })
const sleep = ms => new Promise(r => setTimeout(r, ms))
const page = await browser.newPage()
await page.goto('https://craftflow-git-dev-fabian-scharf-s-projects.vercel.app/', { waitUntil: 'domcontentloaded', timeout: 90000 }); await sleep(3000)
const lade = n => readFileSync('/tmp/lvtest/' + n).toString('base64')
const plan = {
  upload403: [['foto-1.png', 'image/png']],
  deckel5: [1, 2, 3, 4, 5, 6].map(i => [`foto-${i}.png`, 'image/png']),
  bloecke403: [['leistungsverzeichnis.pdf', 'application/pdf'], ['foto-1.png', 'image/png']],
}[modus]
const dateien = plan.map(([n, t]) => ({ name: n, typ: t, b64: lade(n) }))
const r = await page.evaluate(async (dateien, modus) => {
  const out = { uploads: [] }
  let projektId = null
  for (const d of dateien) {
    const bin = Uint8Array.from(atob(d.b64), c => c.charCodeAt(0))
    const fd = new FormData(); fd.append('file', new File([bin], d.name, { type: d.typ })); if (projektId) fd.append('projekt_id', projektId)
    const res = await fetch('/api/upload', { method: 'POST', body: fd }); const j = await res.json().catch(() => ({}))
    if (!projektId && j.projekt_id) projektId = j.projekt_id
    out.uploads.push(res.status + (j.error ? ' ' + j.error : '') + (j.minPlan ? ' [minPlan ' + j.minPlan + ']' : ''))
  }
  out.projektId = projektId
  if (modus === 'bloecke403' && projektId) {
    const v = await fetch('/api/analyze/vorbereiten', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projekt_id: projektId, text: 'Alle Positionen kalkulieren.' }) })
    const vj = await v.json().catch(() => ({}))
    out.vorbereiten = { status: v.status, error: vj.error, minPlan: vj.minPlan, bloecke: (vj.bloecke || []).length }
  }
  // Aufräumen: Projekt löschen (Dateien hängen am Projekt-Pfad; Route löscht das Projekt, Storage-Reste räumt der Controller)
  if (projektId) { const d = await fetch('/api/projects/' + projektId, { method: 'DELETE' }); out.geloescht = d.status }
  return out
}, dateien, modus)
console.log(modus + ':', JSON.stringify(r))
await page.close(); browser.disconnect()
