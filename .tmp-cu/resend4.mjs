import puppeteer from 'puppeteer-core'
const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null, protocolTimeout: 120000 })
const page = (await browser.pages()).find(p => p.url().includes('resend.com'))
const sleep = ms => new Promise(r => setTimeout(r, ms))
await page.goto('https://resend.com/api-keys', { waitUntil: 'networkidle2', timeout: 60000 }); await sleep(3500)
let t = await page.evaluate(() => document.body.innerText); let i = t.indexOf('API Keys', t.indexOf('Need help?'))
console.log('--- API KEYS ---\n' + t.slice(i, i + 800))
await page.goto('https://resend.com/domains/add', { waitUntil: 'networkidle2', timeout: 60000 }); await sleep(3500)
t = await page.evaluate(() => document.body.innerText); i = t.indexOf('Add', t.indexOf('Need help?'))
console.log('--- ADD DOMAIN ---\n' + t.slice(i, i + 1200))
const form = await page.evaluate(() => ({
  inputs: [...document.querySelectorAll('input')].map(x => ({ name: x.name, ph: x.placeholder, type: x.type, v: x.value })),
  buttons: [...document.querySelectorAll('button')].map(b => b.innerText.trim()).filter(Boolean),
  selects: [...document.querySelectorAll('select, [role="combobox"]')].map(s => s.innerText.trim().slice(0, 80)),
}))
console.log(JSON.stringify(form, null, 1))
await page.screenshot({ path: '/tmp/cfshots/resend-add.png' })
browser.disconnect()
