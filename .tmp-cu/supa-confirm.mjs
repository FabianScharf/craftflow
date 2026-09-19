import puppeteer from 'puppeteer-core'
const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null, protocolTimeout: 120000 })
const sleep = ms => new Promise(r => setTimeout(r, ms))
const page = await browser.newPage()
await page.setViewport({ width: 1366, height: 1100 })
await page.goto('https://supabase.com/dashboard/project/fepfjvixfxksvduzwsgq/auth/templates', { waitUntil: 'networkidle2', timeout: 90000 }); await sleep(5000)
await page.evaluate(() => { const el = [...document.querySelectorAll('button, a, div, h3, span')].find(e => e.children.length <= 2 && e.innerText && e.innerText.trim() === 'Confirm sign up'); el && el.click() }); await sleep(3500)
let t = await page.evaluate(() => document.body.innerText)
let i = t.indexOf('Confirm sign up', t.indexOf('SMTP Settings')); console.log('--- CONFIRM ---\n' + t.slice(i, i + 1800))
const felder = await page.evaluate(() => ({
  inputs: [...document.querySelectorAll('input')].map(x => ({ id: x.id, name: x.name, v: x.value })).filter(x => x.v),
  monaco: [...document.querySelectorAll('.monaco-editor .view-lines')].map(e => e.innerText).join('\n---\n').slice(0, 3000),
  textareas: [...document.querySelectorAll('textarea')].map(x => x.value.slice(0, 3000)),
}))
console.log(JSON.stringify(felder, null, 1).slice(0, 5000))
await page.screenshot({ path: '/tmp/cfshots/supa-confirm.png', fullPage: true })
// SMTP-Einstellungen
await page.evaluate(() => { const el = [...document.querySelectorAll('button, a')].find(e => e.innerText && e.innerText.trim() === 'SMTP Settings'); el && el.click() }); await sleep(3500)
t = await page.evaluate(() => document.body.innerText); i = t.indexOf('SMTP Settings', t.indexOf('Templates')); console.log('--- SMTP ---\n' + t.slice(i, i + 1500))
const smtp = await page.evaluate(() => ({ inputs: [...document.querySelectorAll('input')].map(x => ({ id: x.id, name: x.name, type: x.type, v: x.type === 'password' ? (x.value ? '***' : '') : x.value, checked: x.checked })).filter(x => x.v || x.type === 'checkbox'), switches: [...document.querySelectorAll('[role=switch]')].map(s => s.getAttribute('aria-checked')) }))
console.log(JSON.stringify(smtp, null, 1).slice(0, 2500))
await page.screenshot({ path: '/tmp/cfshots/supa-smtp.png', fullPage: true })
browser.disconnect()
