import puppeteer from 'puppeteer-core'
const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null })
const page = await browser.newPage()
await page.goto('https://craftflow-git-dev-fabian-scharf-s-projects.vercel.app/', { waitUntil: 'domcontentloaded', timeout: 90000 }); await new Promise(r => setTimeout(r, 4000))
console.log(JSON.stringify(await page.evaluate(async () => {
  const a = await fetch('/api/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: 'Deckeltest — Limit voll, darf die KI nicht erreichen' }) })
  const j = await a.json().catch(() => ({}))
  const u = await (await fetch('/api/usage')).json().catch(() => ({}))
  return { analyze: { status: a.status, error: j.error, minPlan: j.minPlan }, usage: { plan: u.plan, count: u.count, limit: u.limit, erlaubt: u.erlaubt } }
})))
await page.close(); browser.disconnect()
