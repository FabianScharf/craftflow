import puppeteer from 'puppeteer-core'
const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null })
const page = await browser.newPage()
await page.goto('https://app.getcraftflow.de/', { waitUntil: 'networkidle2', timeout: 60000 })
const r = await page.evaluate(async () => {
  const out = {}
  for (const u of ['/api/projects', '/api/settings/betriebsprofil', '/api/settings/kalibrierung', '/api/settings/kostenstellen', '/api/customers', '/api/wuensche', '/api/usage']) {
    const res = await fetch(u, { cache: 'no-store' }); const t = await res.text()
    out[u] = res.status + ' ' + (t.length > 80 ? t.slice(0, 80).replace(/\s+/g, ' ') + '…' : t)
  }
  return out
})
console.log(JSON.stringify(r, null, 1))
await page.close(); browser.disconnect()
