import puppeteer from 'puppeteer-core'
const b = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null })
const app = (await b.pages()).find(p => p.url().includes('vercel.app'))
await app.bringToFront()
// in den Angebots-Reiter und speichern
await app.evaluate(() => { const k = [...document.querySelectorAll('button')].find(e => /Angebot/.test(e.textContent) && e.textContent.length < 20); if (k) k.click() })
await new Promise(r => setTimeout(r, 1200))
await app.evaluate(() => { const k = [...document.querySelectorAll('button')].find(e => /Änderungen speichern|Gespeichert/.test(e.textContent)); if (k) k.click() })
await new Promise(r => setTimeout(r, 2500))
const status = await app.evaluate(() => { const k = [...document.querySelectorAll('button')].find(e => /speicher|Gespeichert/i.test(e.textContent)); return k ? k.textContent.trim() : '?' })
console.log('Knopf danach:', status)
// zurueck in die Kalkulation und etwas aendern
await app.evaluate(() => { const k = [...document.querySelectorAll('button')].find(e => /Kalkulation/.test(e.textContent) && e.textContent.length < 20); if (k) k.click() })
await new Promise(r => setTimeout(r, 1200))
await app.evaluate(() => {
  const f = [...document.querySelectorAll('input')].filter(e => e.type === 'number' && e.value === '660')
  if (f[0]) { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(f[0], '690'); f[0].dispatchEvent(new Event('input', { bubbles: true })) }
})
await new Promise(r => setTimeout(r, 1200))
const leiste = await app.evaluate(() => {
  const e = [...document.querySelectorAll('div')].find(x => { const s = getComputedStyle(x); return s.position === 'fixed' && /Nicht gespeicherte/.test(x.textContent || '') })
  return e ? { da: true, y: Math.round(e.getBoundingClientRect().y), h: Math.round(e.getBoundingClientRect().height) } : { da: false }
})
console.log('Speicherleiste:', JSON.stringify(leiste))
await b.disconnect()
