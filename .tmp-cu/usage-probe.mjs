import puppeteer from 'puppeteer-core'
const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null })
const page = await browser.newPage()
await page.goto('https://craftflow-git-dev-fabian-scharf-s-projects.vercel.app/', { waitUntil: 'domcontentloaded', timeout: 90000 }); await new Promise(r => setTimeout(r, 3000))
console.log(JSON.stringify(await page.evaluate(async () => {
  const a = await fetch('/api/usage', { cache: 'no-store' }); const ja = await a.json()
  const b = await fetch('/api/usage'); const jb = await b.json()
  return { noStore: { count: ja.count, plan: ja.plan, cacheHeader: a.headers.get('cache-control'), age: a.headers.get('age'), xcache: a.headers.get('x-vercel-cache') }, normal: { count: jb.count, xcache: b.headers.get('x-vercel-cache') } }
})))
await page.close(); browser.disconnect()
