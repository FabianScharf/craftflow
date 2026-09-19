import puppeteer from 'puppeteer-core'
const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null })
const page = await browser.newPage()
await page.goto('https://craftflow-git-dev-fabian-scharf-s-projects.vercel.app/settings', { waitUntil: 'domcontentloaded', timeout: 90000 }); await new Promise(r => setTimeout(r, 2500))
console.log(JSON.stringify(await page.evaluate(async () => {
  const r = await fetch('/api/wuensche/oeffentlich?cb=' + Date.now()); const j = await r.json().catch(() => ({}))
  return { status: r.status, cache: r.headers.get('cache-control'), xcache: r.headers.get('x-vercel-cache'), wuensche: (j.wuensche || []).map(w => ({ titel: w.titel, status: w.status, stimmen: w.stimmen, hatUserId: 'user_id' in w })) }
})))
await page.close(); browser.disconnect()
