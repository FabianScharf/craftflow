// Räumt Storage-Reste des Testkontos über die App-Route weg (DELETE /api/upload prüft Besitz). Pfade aus Datei, eine je Zeile.
import puppeteer from 'puppeteer-core'
import { readFileSync } from 'node:fs'
const pfade = readFileSync(process.argv[2], 'utf8').split('\n').map(s => s.trim()).filter(Boolean)
const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null, protocolTimeout: 300000 })
const page = await browser.newPage()
await page.goto('https://craftflow-git-dev-fabian-scharf-s-projects.vercel.app/', { waitUntil: 'domcontentloaded', timeout: 90000 }); await new Promise(r => setTimeout(r, 3000))
const r = await page.evaluate(async (pfade) => {
  const out = []
  for (const pfad of pfade) { const d = await fetch('/api/upload', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pfad }) }); out.push(d.status) }
  return out
}, pfade)
console.log('gelöscht:', r.join(','))
await page.close(); browser.disconnect()
