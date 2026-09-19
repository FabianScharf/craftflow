import puppeteer from 'puppeteer-core'
const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null, protocolTimeout: 400000 })
const sleep = ms => new Promise(r => setTimeout(r, ms))
const page = await browser.newPage()
await page.goto('https://craftflow-git-dev-fabian-scharf-s-projects.vercel.app/', { waitUntil: 'networkidle2', timeout: 90000 }); await sleep(2000)
if (!page.url().includes('vercel.app/')) { console.log('nicht eingeloggt:', page.url()); process.exit(2) }
const analyse = (text) => page.evaluate(async (text) => {
  const t0 = Date.now()
  const r = await fetch('/api/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) })
  const j = await r.json()
  return { status: r.status, sekunden: Math.round((Date.now() - t0) / 1000), ok: j.success, nutzung: j.nutzung, positionen: j.data?.positionen?.length ?? j.data?.length ?? null }
}, text)
console.log('1. Aufruf (Cache wird geschrieben) …')
console.log(JSON.stringify(await analyse('Kunde Testkunde, Musterstraße 1, 63450 Hanau. Rollcontainer für die Werkstatt, Dekor weiß, 3 Schubladen, 600 mm hoch, 420 mm breit, 580 mm tief, Rollen. Ergänze den Rest.')))
console.log('2. Aufruf (Cache muss gelesen werden) …')
console.log(JSON.stringify(await analyse('Kunde Testkunde, Musterstraße 1, 63450 Hanau. Wandregal Eiche massiv geölt, 1200 x 300 x 25 mm, zwei Konsolen unsichtbar. Ergänze den Rest.')))
await page.close(); browser.disconnect()
