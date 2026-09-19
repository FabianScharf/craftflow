import puppeteer from 'puppeteer-core'
const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null, protocolTimeout: 400000 })
const page = await browser.newPage()
await page.goto('https://craftflow-git-dev-fabian-scharf-s-projects.vercel.app/', { waitUntil: 'domcontentloaded', timeout: 90000 }); await new Promise(r => setTimeout(r, 3000))
console.log(JSON.stringify(await page.evaluate(async (pid) => {
  const t1 = Date.now()
  const b = await fetch('/api/analyze/block', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projekt_id: pid, blockNr: 1, kontext: null }) })
  const bj = await b.json().catch(() => ({}))
  const pos = bj.data?.positionen || []
  return { status: b.status, sekunden: Math.round((Date.now() - t1) / 1000), success: bj.success, error: (bj.error || '').slice(0, 120), hinweise: bj.hinweise, positionen: pos.length, titel: pos.slice(0, 6).map(p => p.titel), preisfaktorGestempelt: pos.some(p => p.preisfaktor !== undefined) }
}, '53a0ebf4-0a41-4c8e-b861-1ebc725250d1'), null, 1))
await page.close(); browser.disconnect()
