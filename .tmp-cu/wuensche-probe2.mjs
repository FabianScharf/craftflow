import puppeteer from 'puppeteer-core'
const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null })
const page = await browser.newPage()
await page.goto('https://craftflow-git-dev-fabian-scharf-s-projects.vercel.app/settings', { waitUntil: 'domcontentloaded', timeout: 90000 }); await new Promise(r => setTimeout(r, 3500))
console.log(JSON.stringify(await page.evaluate(async () => {
  const j = async (r) => ({ status: r.status, ...(await r.json().catch(() => ({}))) })
  const g = await j(await fetch('/api/wuensche'))
  const v = await j(await fetch('/api/wuensche/b802e6e6-33ec-445b-82da-0ff3c00d8273/stimme', { method: 'POST' }))
  const o = await j(await fetch('/api/wuensche/oeffentlich'))
  return { budget: g.budget, stimmeB: { status: v.status, error: (v.error || '').slice(0, 90), minPlan: v.minPlan }, oeffentlich: (o.wuensche || []).map(w => w.titel + ':' + w.status + ':' + w.stimmen) }
})))
await page.close(); browser.disconnect()
