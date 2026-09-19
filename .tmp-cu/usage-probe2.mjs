import puppeteer from 'puppeteer-core'
const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null })
const page = await browser.newPage()
await page.goto('https://craftflow-git-dev-fabian-scharf-s-projects.vercel.app/', { waitUntil: 'domcontentloaded', timeout: 90000 }); await new Promise(r => setTimeout(r, 3000))
console.log(JSON.stringify(await page.evaluate(async () => {
  const g0 = await (await fetch('/api/usage', { cache: 'no-store' })).json()
  const p = await fetch('/api/usage', { method: 'POST' }); const jp = await p.json().catch(() => ({}))
  const g1 = await (await fetch('/api/usage', { cache: 'no-store' })).json()
  const me = await (await fetch('/api/settings/betriebsprofil')).json().catch(() => ({}))
  return { vorher: g0.count, post: { status: p.status, count: jp.count, ok: jp.ok }, nachher: g1.count, plan: g1.plan, profilUserId: me.profil?.user_id }
})))
await page.close(); browser.disconnect()
