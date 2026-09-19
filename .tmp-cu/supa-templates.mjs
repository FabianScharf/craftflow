import puppeteer from 'puppeteer-core'
const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null, protocolTimeout: 120000 })
const page = await browser.newPage()
await page.setViewport({ width: 1366, height: 1000 })
await page.goto('https://supabase.com/dashboard/project/fepfjvixfxksvduzwsgq/auth/templates', { waitUntil: 'networkidle2', timeout: 90000 })
await new Promise(r => setTimeout(r, 5000))
const t = await page.evaluate(() => document.body.innerText)
const i = t.indexOf('Email Templates'); console.log(t.slice(i, i + 1500))
// Betreff + Body des Confirm-Templates
const felder = await page.evaluate(() => ({
  inputs: [...document.querySelectorAll('input')].map(x => ({ id: x.id, v: x.value })).filter(x => x.v),
  editor: [...document.querySelectorAll('.monaco-editor, textarea, [contenteditable]')].map(e => (e.innerText || e.value || '').slice(0, 3000)),
}))
console.log(JSON.stringify(felder, null, 1).slice(0, 4000))
await page.screenshot({ path: '/tmp/cfshots/supa-templates.png', fullPage: true })
browser.disconnect()
