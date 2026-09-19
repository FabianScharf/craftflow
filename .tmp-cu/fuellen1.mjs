import puppeteer from 'puppeteer-core'
const b = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null })
const app = (await b.pages()).find(p => p.url().includes('vercel.app'))
await app.bringToFront()
await app.evaluate(() => {
  const setze = (el, wert) => {
    const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, wert)
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
  }
  const f = [...document.querySelectorAll('input, textarea')]
  setze(f[0], 'Einbauschrank Flur, 2,40 m')
  setze(f[4], 'Raumhoher Einbauschrank, 2400 x 2500 x 600 mm. Korpus Spanplatte weiss beschichtet 19 mm, Fronten Eiche furniert, seidenmatt lackiert. Vier Drehtueren mit Topfscharnieren, zwei Schubkaesten auf Vollauszug, sechs Einlegeboeden. Aufmass und Montage vor Ort.')
})
await new Promise(r => setTimeout(r, 400))
// Materialzeile anlegen und Felder ansehen
await app.evaluate(() => {
  const k = [...document.querySelectorAll('button')].find(e => e.textContent.includes('+ Materialzeile'))
  if (k) k.click()
})
await new Promise(r => setTimeout(r, 700))
const f = await app.evaluate(() => [...document.querySelectorAll('input, textarea, select')].map((e, i) =>
  `${i} ${e.tagName}/${e.type} ph="${e.placeholder || ''}" wert="${(e.value||'').slice(0,22)}" @${Math.round(e.getBoundingClientRect().x)},${Math.round(e.getBoundingClientRect().y)}`))
console.log(f.join('\n'))
await b.disconnect()
