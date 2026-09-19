import puppeteer from 'puppeteer-core'
const DEV = 'https://craftflow-git-dev-fabian-scharf-s-projects.vercel.app'
const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null })
const page = await browser.newPage()
await page.goto(DEV + '/settings', { waitUntil: 'networkidle2', timeout: 90000 })
console.log(JSON.stringify(await page.evaluate(async () => { const out = {}; for (const u of ['/api/konto', '/api/team', '/api/projects', '/api/settings/betriebsprofil', '/api/usage']) { const r = await fetch(u, { cache: 'no-store' }); const t = await r.text(); out[u] = r.status + ' ' + t.slice(0, 70).replace(/\s+/g, ' ') } return out }), null, 1))
await page.close(); browser.disconnect()
