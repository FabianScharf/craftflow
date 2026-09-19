import puppeteer from 'puppeteer-core'
const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null })
const page = await browser.newPage()
await page.goto('https://craftflow-git-dev-fabian-scharf-s-projects.vercel.app/settings', { waitUntil: 'networkidle2', timeout: 90000 })
const r = await page.evaluate(async () => {
  const ks = async () => { const j = await (await fetch('/api/settings/kostenstellen')).json(); const l = j.kostenstellen ?? j; return Object.fromEntries(l.filter(k => /CNC|Bekantung|Montage/.test(k.bezeichnung) || /03_03|03_04|Montage/i.test(k.code)).map(k => [k.bezeichnung, k.aktiv])) }
  const kal = await (await fetch('/api/settings/kalibrierung')).json()
  const k = kal.kalibrierung
  const vorher = await ks()
  // 1) Speichern mit den heutigen Antworten (keine CNC, keine Kantenanleimmaschine)
  const p1 = await fetch('/api/settings/kalibrierung', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(k) })
  const j1 = await p1.json()
  const nach1 = await ks()
  // 2) Kantenanleimmaschine dazu → Bekantung muss wieder an
  const p2 = await fetch('/api/settings/kalibrierung', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...k, maschinen: [...new Set([...(k.maschinen ?? []), 'kantenanleim'])] }) })
  const j2 = await p2.json()
  const nach2 = await ks()
  // 3) Zurueck auf den echten Stand
  await fetch('/api/settings/kalibrierung', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(k) })
  const ende = await ks()
  return { maschinen: k.maschinen, vorher, schritt1: { status: p1.status, geaendert: j1.kostenstellen, kostenstellen: nach1 }, schritt2: { status: p2.status, geaendert: j2.kostenstellen, kostenstellen: nach2 }, ende }
})
console.log(JSON.stringify(r, null, 1))
await page.close(); browser.disconnect()
