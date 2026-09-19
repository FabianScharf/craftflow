import puppeteer from 'puppeteer-core'
const sleep = ms => new Promise(r => setTimeout(r, ms))
const DEV = 'https://craftflow-git-dev-fabian-scharf-s-projects.vercel.app'
const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null })
const page = await browser.newPage(); await page.setViewport({ width: 1280, height: 900 })
await page.goto(DEV + '/', { waitUntil: 'networkidle2', timeout: 90000 }); await sleep(4000)
const konto = await page.evaluate(async () => (await (await fetch('/api/konto', { cache: 'no-store' })).json()))
const projekte = await page.evaluate(async () => (await fetch('/api/projects', { cache: 'no-store' })).status)
console.log(JSON.stringify({ url: page.url(), zustand: konto.zustand, kontoId: konto.kontoId, projekteStatus: projekte, text: (await page.evaluate(() => document.body.innerText.slice(0, 260).replace(/\s+/g, ' '))) }))
await page.screenshot({ path: ".tmp-cu/ma-zurueck.png" })
await page.close(); browser.disconnect()
