import puppeteer from 'puppeteer-core'
const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null, protocolTimeout: 60000 })
const page = (await browser.pages()).find(p => p.url().includes('resend.com'))
const sleep = ms => new Promise(r => setTimeout(r, ms))
const text = () => page.evaluate(() => document.body.innerText)
const tables = () => page.evaluate(() => [...document.querySelectorAll('table tr')].map(tr => [...tr.querySelectorAll('th,td')].map(td => { const c = td.querySelector('[aria-label^="Copy "]'); return c ? c.getAttribute('aria-label').slice(5) : td.innerText.trim().replace(/\n/g, ' ') }).join(' | ')))
// fscrafted.de Detailseite
await page.goto('https://resend.com/domains/81a6ebbc-720c-48d8-97ab-2725c51bb765', { waitUntil: 'networkidle2' }); await sleep(4000)
let t = await text(); let i = t.indexOf('fscrafted.de', t.indexOf('Need help?')); console.log('--- DETAIL fscrafted.de ---\n' + t.slice(i, i + 2200))
console.log('--- TABELLEN ---\n' + (await tables()).join('\n'))
console.log('Buttons:', JSON.stringify(await page.evaluate(() => [...document.querySelectorAll('button')].map(b => b.innerText.trim()).filter(x => x && x.length < 40))))
await page.screenshot({ path: '/tmp/cfshots/resend-fscrafted.png', fullPage: true })
browser.disconnect()
