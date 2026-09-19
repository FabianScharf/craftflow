import puppeteer from 'puppeteer-core'
const b = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null })
const app = (await b.pages()).find(p => p.url().includes('vercel.app'))
await app.bringToFront()
await app.evaluate(() => {
  const setze = (el, wert) => {
    const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, String(wert))
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
  }
  const f = [...document.querySelectorAll('input, textarea')]
  setze(f[28], 'Eiche massiv 40 mm, gehobelt'); setze(f[29], 0.4); setze(f[30], 'm²'); setze(f[31], 118); setze(f[32], 25)
  setze(f[33], 150)
})
await new Promise(r => setTimeout(r, 1200))
const t = await app.evaluate(() => document.body.innerText.replace(/\s+/g, ' '))
console.log(t.slice(280, 560))
console.log('---')
console.log(t.slice(t.indexOf('Fensterbank') > 0 ? 0 : 0, 0) || '')
await b.disconnect()
