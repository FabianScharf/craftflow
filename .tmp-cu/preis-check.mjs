import puppeteer from 'puppeteer-core'
const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null })
const page = await browser.newPage()
await page.goto('https://craftflow-git-dev-fabian-scharf-s-projects.vercel.app/settings', { waitUntil: 'networkidle2', timeout: 90000 })
const r = await page.evaluate(async () => {
  const out = {}
  for (const [name, id] of [['Tn1-Pro (Einstellungen)', 'price_1Tn1y0RvozvhvO9J4QXMCzje'], ['TmS-Pro (Webhook)', 'price_1TmScSRvozvhvO9J0RF42acJ']]) {
    const res = await fetch('/api/stripe/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ priceId: id }) })
    const j = await res.json().catch(() => ({}))
    out[name] = res.status + (j.url ? ' ok' : ' ' + String(j.error || '').slice(0, 120))
  }
  return out
})
console.log(JSON.stringify(r, null, 1))
await page.close(); browser.disconnect()
