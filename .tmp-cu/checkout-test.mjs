import puppeteer from 'puppeteer-core'
const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null })
const sleep = ms => new Promise(r => setTimeout(r, ms))
const page = await browser.newPage()
await page.setViewport({ width: 1280, height: 1000 })
await page.goto('https://craftflow-git-dev-fabian-scharf-s-projects.vercel.app/settings', { waitUntil: 'networkidle2', timeout: 90000 }); await sleep(2000)
// Checkout-Sitzung fuer "Pro" anlegen — legt nur eine Stripe-Sitzung an, zieht nichts ein
const r = await page.evaluate(async () => {
  const res = await fetch('/api/stripe/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ priceId: 'price_1TmScSRvozvhvO9J0RF42acJ' }) })
  return { status: res.status, ...(await res.json()) }
})
console.log('Checkout-Antwort:', JSON.stringify(r).slice(0, 300))
if (!r.url) { await page.close(); browser.disconnect(); process.exit(1) }
const modus = r.url.includes('cs_test_') ? 'TEST' : r.url.includes('cs_live_') ? 'LIVE' : 'unbekannt'
console.log('Stripe-Modus:', modus)
await page.goto(r.url, { waitUntil: 'networkidle2', timeout: 90000 }); await sleep(4000)
const text = await page.evaluate(() => document.body.innerText)
const zeilen = text.split('\n').filter(z => /€|MwSt|USt|Steuer|Zwischensumme|Gesamt|Total|Tax|VAT|monatlich|month/i.test(z)).slice(0, 25)
console.log('Zusammenfassung auf der Checkout-Seite:\n' + zeilen.join('\n'))
await page.screenshot({ path: '/tmp/cfshots/checkout.png' })
await page.close(); browser.disconnect()
