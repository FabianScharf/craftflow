import puppeteer from 'puppeteer-core'
const b = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null })
const t = (await b.pages()).find(p => p.url().includes('craftflow-git-dev'))
await t.bringToFront()
const setze = async (js) => t.evaluate(js)
const rahmen = async (suche, obenExtra = 10) => t.evaluate((s, o) => {
  const e = [...document.querySelectorAll('input')].find(x => x.type === 'text' && new RegExp(s).test(x.value))
  let p = e
  while (p && p.getBoundingClientRect().height < 40) p = p.parentElement
  const a = p.getBoundingClientRect()
  return { x: Math.round(a.x) - 10, y: Math.round(a.y) - o, width: Math.round(a.width) + 20, height: Math.round(a.height) + o + 10 }
}, suche, obenExtra)

// Stueckzahl zurueck auf 1
await setze(() => {
  const f = [...document.querySelectorAll('input')].filter(e => e.type === 'number')
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(f[1], '1')
  f[1].dispatchEvent(new Event('input', { bubbles: true }))
})
await new Promise(r => setTimeout(r, 1400))
await t.screenshot({ path: '.tmp-cu/p-alternativ.png', clip: await rahmen('Fensterbank'), captureBeyondViewport: false })
console.log('Alternativ neu aufgenommen')

// Haken weg, Gruppe eintragen
await setze(() => { const k = [...document.querySelectorAll('input')].filter(e => e.type === 'checkbox'); k[1].click() })
await new Promise(r => setTimeout(r, 900))
await setze(() => {
  const s = (el, w) => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, w); el.dispatchEvent(new Event('input', { bubbles: true })) }
  const g = [...document.querySelectorAll('input')].filter(e => /Gruppe \(optional\)/.test(e.placeholder || ''))
  g.forEach(e => s(e, 'Flur'))
})
await new Promise(r => setTimeout(r, 1500))
const beide = await t.evaluate(() => {
  const a = [...document.querySelectorAll('input')].find(x => x.type === 'text' && /Einbauschrank/.test(x.value))
  const c = [...document.querySelectorAll('input')].find(x => x.type === 'text' && /Fensterbank/.test(x.value))
  const hoch = e => { let p = e; while (p && p.getBoundingClientRect().height < 40) p = p.parentElement; return p.getBoundingClientRect() }
  const r1 = hoch(a), r2 = hoch(c)
  return { x: Math.round(r1.x) - 12, y: Math.round(r1.y) - 38, width: Math.round(r1.width) + 24, height: Math.round(r2.bottom - r1.y) + 50 }
})
await t.screenshot({ path: '.tmp-cu/p-gruppe.png', clip: beide, captureBeyondViewport: false })
console.log('Gruppenbild:', JSON.stringify(beide))
await b.disconnect()
