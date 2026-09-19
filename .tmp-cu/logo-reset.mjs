import puppeteer from 'puppeteer-core'
const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null })
const page = await browser.newPage()
await page.goto('https://craftflow-git-dev-fabian-scharf-s-projects.vercel.app/', { waitUntil: 'domcontentloaded', timeout: 90000 }); await new Promise(r => setTimeout(r, 3000))
console.log(JSON.stringify(await page.evaluate(async () => {
  const r = await fetch('/api/settings/betriebsprofil', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ logo_url: null }) })
  const g = await fetch('/api/settings/betriebsprofil'); const j = await g.json().catch(() => ({}))
  return { patch: r.status, logo_url: j.profil?.logo_url ?? j.logo_url ?? null, akzent: j.profil?.farbe_akzent ?? j.farbe_akzent }
})))
await page.close(); browser.disconnect()
