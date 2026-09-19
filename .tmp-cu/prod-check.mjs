import puppeteer from 'puppeteer-core'
const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null })
const sleep = ms => new Promise(r => setTimeout(r, ms))
const page = await browser.newPage()
await page.setViewport({ width: 1280, height: 900 })
await page.goto('https://app.getcraftflow.de/settings', { waitUntil: 'networkidle2', timeout: 90000 }); await sleep(3000)
console.log('URL:', page.url())
await page.evaluate(() => { const el = [...document.querySelectorAll('button, div, span, a')].find(e => e.children.length <= 2 && e.innerText && e.innerText.trim() === 'Marketing & CI'); el && el.click() }); await sleep(1000)
const info = await page.evaluate(() => {
  const cs = getComputedStyle(document.documentElement)
  return { neuerHinweis: document.body.innerText.includes('Farbfenster von Mac und iPhone'), vars: { text: cs.getPropertyValue('--c-text').trim(), surface1: cs.getPropertyValue('--c-surface1').trim(), accent: cs.getPropertyValue('--c-accent').trim() }, toenungen: document.querySelectorAll('[style*="color-mix"]').length, cache: !!localStorage.getItem('craftflow-palette') }
})
console.log(JSON.stringify(info))
await page.screenshot({ path: '/tmp/cfshots/prod-ci.png' })
await page.close(); browser.disconnect()
