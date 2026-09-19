import puppeteer from 'puppeteer-core'
const b = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null })
const t = (await b.pages()).find(p => p.url().includes('craftflow-git-dev'))
await t.bringToFront()
await t.evaluate(() => { const k = [...document.querySelectorAll('button')].find(e => /Kalkulation/.test(e.textContent) && e.textContent.length < 20); if (k) k.click() })
await new Promise(r => setTimeout(r, 2000))
// alle Positionen zuklappen
await t.evaluate(() => { [...document.querySelectorAll('button, div, span')].filter(x => x.textContent.trim() === '▼').forEach(e => e.click()) })
await new Promise(r => setTimeout(r, 1200))
const d = await t.evaluate(() => {
  const titel = [...document.querySelectorAll('input')].filter(e => e.type === 'text' && /Einbauschrank|Fensterbank/.test(e.value))
  return titel.map(e => { const r = e.closest('div')?.parentElement?.getBoundingClientRect() || e.getBoundingClientRect(); return `"${e.value}" y=${Math.round(r.y)} h=${Math.round(r.height)}` })
})
console.log(d.join('\n'))
await t.screenshot({ path: '.tmp-cu/pos-uebersicht.png', captureBeyondViewport: false })
await b.disconnect()
