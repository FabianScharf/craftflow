import puppeteer from 'puppeteer-core'
const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null, protocolTimeout: 200000 })
const page = await browser.newPage()
await page.goto('https://craftflow-git-dev-fabian-scharf-s-projects.vercel.app/', { waitUntil: 'domcontentloaded', timeout: 90000 }); await new Promise(r => setTimeout(r, 3000))
console.log(JSON.stringify(await page.evaluate(async () => {
  const offer = { kunde: { name: 'Test' }, positionen: [{ titel: 'Regalbrett', beschreibung: 'Eiche 1000x300x25', menge: 1, material: [], arbeitszeit: [] }] }
  const t0 = Date.now()
  const r = await fetch('/api/optimize', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ offerData: offer, chatHistory: [], message: 'Antworte nur mit einem Satz: Passt so.', projectId: 'rundentest-' + Date.now() }) })
  const j = await r.json().catch(() => ({}))
  return { status: r.status, sekunden: Math.round((Date.now() - t0) / 1000), ok: j.success, antwort: String(j.message || j.error || '').slice(0, 80) }
})))
await page.close(); browser.disconnect()
