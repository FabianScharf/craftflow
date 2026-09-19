import puppeteer from 'puppeteer-core'
const b = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null })
const t = (await b.pages()).find(p => p.url().includes('craftflow-git-dev'))
await t.bringToFront()
await t.evaluate(() => {
  const s = (el, w) => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, w); el.dispatchEvent(new Event('input', { bubbles: true })) }
  ;[...document.querySelectorAll('input')].filter(e => /Gruppe \(optional\)/.test(e.placeholder || '')).forEach(e => s(e, ''))
})
await new Promise(r => setTimeout(r, 1400))
const beide = await t.evaluate(() => {
  const a = [...document.querySelectorAll('input')].find(x => x.type === 'text' && /Einbauschrank/.test(x.value))
  const c = [...document.querySelectorAll('input')].find(x => x.type === 'text' && /Fensterbank/.test(x.value))
  const hoch = e => { let p = e; while (p && p.getBoundingClientRect().height < 40) p = p.parentElement; return p.getBoundingClientRect() }
  const r1 = hoch(a), r2 = hoch(c)
  return { x: Math.round(r1.x) - 12, y: Math.round(r1.y) - 10, width: Math.round(r1.width) + 24, height: Math.round(r2.bottom - r1.y) + 22 }
})
await t.screenshot({ path: '.tmp-cu/p-sortieren.png', clip: beide, captureBeyondViewport: false })
console.log('ok')
await b.disconnect()
