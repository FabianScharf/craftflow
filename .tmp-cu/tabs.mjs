import puppeteer from 'puppeteer-core'
const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null })
for (const p of await browser.pages()) console.log((await p.title()).slice(0,60), '|', p.url().slice(0,120))
browser.disconnect()
