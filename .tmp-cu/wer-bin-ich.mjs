import puppeteer from 'puppeteer-core'
const DEV = 'https://craftflow-git-dev-fabian-scharf-s-projects.vercel.app'
const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null })
const page = await browser.newPage()
await page.goto(DEV + '/settings', { waitUntil: 'networkidle2', timeout: 90000 })
console.log(JSON.stringify(await page.evaluate(async () => { const k = await (await fetch('/api/konto', { cache: 'no-store' })).json(); const t = await (await fetch('/api/team', { cache: 'no-store' })).json(); return { zustand: k.zustand, betrieb: k.betriebName, inhaber: t.inhaber?.email } })))
await page.close(); browser.disconnect()
