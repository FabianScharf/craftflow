import puppeteer from 'puppeteer-core'
const b = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null })
const app = (await b.pages()).find(p => p.url().includes('vercel.app'))
await app.bringToFront()
await app.evaluate(() => { const k = [...document.querySelectorAll('button')].find(e => /Zurück/.test(e.textContent)); if (k) k.click() })
await new Promise(r => setTimeout(r, 1200))
await app.evaluate(() => { const k = [...document.querySelectorAll('button')].find(e => /Kalkulation/.test(e.textContent) && e.textContent.length < 20); if (k) k.click() })
await new Promise(r => setTimeout(r, 1200))
// eine Minutenzahl aendern
await app.evaluate(() => {
  const f = [...document.querySelectorAll('input')].filter(e => e.type === 'number' && e.value === '600')
  if (f[0]) {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(f[0], '660')
    f[0].dispatchEvent(new Event('input', { bubbles: true }))
  }
})
await new Promise(r => setTimeout(r, 1200))
const unten = await app.evaluate(() => {
  const fix = [...document.querySelectorAll('div, button')].filter(e => { const s = getComputedStyle(e); const r = e.getBoundingClientRect(); return (s.position === 'fixed' || s.position === 'sticky') && r.y > 700 && r.width > 200 })
  return fix.map(e => `${Math.round(e.getBoundingClientRect().y)}: "${e.textContent.replace(/\s+/g,' ').trim().slice(0, 70)}"`)
})
console.log('Leisten unten:', JSON.stringify(unten, null, 1))
await app.screenshot({ path: '.tmp-cu/k-nach-aenderung.png' })
await b.disconnect()
