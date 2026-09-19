import puppeteer from 'puppeteer-core'
const b = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null })
const t = (await b.pages()).find(p => p.url().includes('craftflow-git-dev'))
await t.bringToFront()
await t.evaluate(() => { [...document.querySelectorAll('button, div')].filter(e => { const s = getComputedStyle(e); const r = e.getBoundingClientRect(); return s.position === 'fixed' && r.width < 120 && r.height < 120 && r.x > 1200 }).forEach(e => (e.dataset.weg='1', e.style.visibility='hidden')) })

const setzeZahl = async (wert) => t.evaluate(w => {
  // Stückzahlfeld der ZWEITEN Position
  const felder = [...document.querySelectorAll('input')].filter(e => e.type === 'number')
  const ziel = felder[1] || felder[0]
  const p = HTMLInputElement.prototype
  Object.getOwnPropertyDescriptor(p, 'value').set.call(ziel, String(w))
  ziel.dispatchEvent(new Event('input', { bubbles: true }))
  return felder.length
}, wert)
console.log('Zahlenfelder:', await setzeZahl(20))
await new Promise(r => setTimeout(r, 1500))
const zeile = await t.evaluate(() => {
  const e = [...document.querySelectorAll('input')].find(x => x.type === 'text' && /Fensterbank/.test(x.value))
  let p = e
  while (p && p.getBoundingClientRect().height < 40) p = p.parentElement
  const r = p.getBoundingClientRect()
  return { x: Math.round(r.x) - 10, y: Math.round(r.y) - 10, w: Math.round(r.width) + 20, h: Math.round(r.height) + 20, text: p.textContent.replace(/\s+/g,' ').slice(0, 80) }
})
console.log(JSON.stringify(zeile))
await t.screenshot({ path: '.tmp-cu/p-stueckzahl.png', clip: { x: zeile.x, y: zeile.y, width: zeile.w, height: zeile.h }, captureBeyondViewport: false })
await b.disconnect()
