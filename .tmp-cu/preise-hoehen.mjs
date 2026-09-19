// Prüft nach dem Deploy: Name, Preis und erstes Merkmal aller vier Preiskarten auf gleicher Höhe?
import puppeteer from 'puppeteer-core'
const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null })
const sleep = ms => new Promise(r => setTimeout(r, ms))
const page = await browser.newPage(); await page.setViewport({ width: 1400, height: 1000 })
await page.goto('https://craftflow-web-git-dev-fabian-scharf-s-projects.vercel.app/?nocache=' + Date.now() + '#preise', { waitUntil: 'networkidle2', timeout: 90000 }); await sleep(3000)
const r = await page.evaluate(() => {
  const karten = [...document.querySelectorAll('#preise [class*="plan"]')].filter(e => /(^|\s)[^ ]*plan(_|\s|$)/.test(e.className) && e.querySelector('ul'))
  const y = (el) => el ? Math.round(el.getBoundingClientRect().top) : null
  return karten.map(k => ({
    name: k.querySelector('[class*="planName"]')?.innerText.trim(),
    badge: k.querySelector('[class*="planBadge"]') ? (() => { const b = k.querySelector('[class*="planBadge"]').getBoundingClientRect(), kk = k.getBoundingClientRect(); return { top: Math.round(b.top - kk.top), rechts: Math.round(kk.right - b.right), rund: getComputedStyle(k.querySelector('[class*="planBadge"]')).borderRadius } })() : null,
    yName: y(k.querySelector('[class*="planName"]')), yPreis: y(k.querySelector('[class*="planPrice"]')), yMerkmal1: y(k.querySelector('ul li')),
  }))
})
console.log(JSON.stringify(r))
await page.screenshot({ path: '/tmp/cfshots/web-preise-2.png' })
await page.close(); browser.disconnect()
