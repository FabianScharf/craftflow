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
  const mat = [
    [5, 'Spanplatte weiß beschichtet 19 mm', 14, 'm²', 18.5, 25],
    [10, 'Eiche furniert 19 mm, lackierfähig', 6, 'm²', 62, 25],
    [15, 'Beschläge (Scharniere, Auszüge, Griffe)', 1, 'Satz', 240, 20],
  ]
  for (const [i, bez, menge, einheit, ek, auf] of mat) {
    setze(f[i], bez); setze(f[i + 1], menge); setze(f[i + 2], einheit); setze(f[i + 3], ek); setze(f[i + 4], auf)
  }
  setze(f[20], 600); setze(f[21], 300); setze(f[22], 480)
})
await new Promise(r => setTimeout(r, 1200))
const t = await app.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').slice(300, 1100))
console.log(t)
await b.disconnect()
