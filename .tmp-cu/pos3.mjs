import puppeteer from 'puppeteer-core'
const b = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null })
const t = (await b.pages()).find(p => p.url().includes('craftflow-git-dev'))
await t.bringToFront()
const zeile = async (suche) => t.evaluate(s => {
  const e = [...document.querySelectorAll('input')].find(x => x.type === 'text' && new RegExp(s).test(x.value))
  let p = e
  while (p && p.getBoundingClientRect().height < 40) p = p.parentElement
  const r = p.getBoundingClientRect()
  return { x: Math.round(r.x) - 10, y: Math.round(r.y) - 10, w: Math.round(r.width) + 20, h: Math.round(r.height) + 20 }
}, suche)

// 1) Alternativposition ankreuzen (zweite Position)
await t.evaluate(() => { const k = [...document.querySelectorAll('input')].filter(e => e.type === 'checkbox'); if (k[1]) k[1].click() })
await new Promise(r => setTimeout(r, 1500))
let z = await zeile('Fensterbank')
await t.screenshot({ path: '.tmp-cu/p-alternativ.png', clip: z, captureBeyondViewport: false })
const txt = await t.evaluate(() => { const e = [...document.querySelectorAll('input')].find(x => x.type === 'text' && /Fensterbank/.test(x.value)); let p = e; while (p && p.getBoundingClientRect().height < 40) p = p.parentElement; return p.textContent.replace(/\s+/g,' ').slice(0, 110) })
console.log('Alternativ:', txt)

// wieder abwaehlen
await t.evaluate(() => { const k = [...document.querySelectorAll('input')].filter(e => e.type === 'checkbox'); if (k[1]) k[1].click() })
await new Promise(r => setTimeout(r, 900))

// 2) Gruppe eintragen (beide Positionen)
await t.evaluate(() => {
  const setze = (el, w) => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, w); el.dispatchEvent(new Event('input', { bubbles: true })) }
  const g = [...document.querySelectorAll('input')].filter(e => /Gruppe \(optional\)/.test(e.placeholder || ''))
  if (g[0]) setze(g[0], 'Flur')
  if (g[1]) setze(g[1], 'Flur')
})
await new Promise(r => setTimeout(r, 1500))
const gr = await t.evaluate(() => {
  const e = [...document.querySelectorAll('input')].find(x => x.type === 'text' && /Einbauschrank/.test(x.value))
  let p = e
  while (p && p.getBoundingClientRect().height < 40) p = p.parentElement
  const a = p.getBoundingClientRect()
  const e2 = [...document.querySelectorAll('input')].find(x => x.type === 'text' && /Fensterbank/.test(x.value))
  let q = e2
  while (q && q.getBoundingClientRect().height < 40) q = q.parentElement
  const c = q.getBoundingClientRect()
  return { x: Math.round(a.x) - 12, y: Math.round(a.y) - 34, w: Math.round(a.width) + 24, h: Math.round(c.bottom - a.y) + 46 }
})
await t.screenshot({ path: '.tmp-cu/p-gruppe.png', clip: gr, captureBeyondViewport: false })
console.log('Gruppenbild:', JSON.stringify(gr))
await b.disconnect()
