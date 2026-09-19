import puppeteer from 'puppeteer-core'
const b = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null })
const t = await b.newPage()
await t.setViewport({ width: 1440, height: 1200, deviceScaleFactor: 1 })
await t.goto('http://localhost:4322/werkstatt', { waitUntil: 'networkidle2', timeout: 60000 })
await new Promise(r => setTimeout(r, 1800))
const k = await t.evaluate(() => {
  const abschnitt = document.getElementById('naechstes')
  if (!abschnitt) return { fehler: 'kein Abschnitt' }
  const brett = [...abschnitt.querySelectorAll('div')].find(e => e.children.length === 4 && /Vorgeschlagen/i.test(e.textContent || ''))
  if (!brett) return { fehler: 'kein Brett', text: abschnitt.innerText.replace(/\s+/g,' ').slice(0, 200) }
  brett.scrollIntoView({ block: 'center' })
  return { ok: true }
})
if (k.fehler) { console.log(JSON.stringify(k)); await b.disconnect(); process.exit(0) }
await new Promise(r => setTimeout(r, 800))
const m = await t.evaluate(() => {
  const abschnitt = document.getElementById('naechstes')
  const brett = [...abschnitt.querySelectorAll('div')].find(e => e.children.length === 4 && /Vorgeschlagen/i.test(e.textContent || ''))
  const r = brett.getBoundingClientRect()
  return { x: Math.round(r.x) - 12, y: Math.round(r.y) - 12, width: Math.round(r.width) + 24, height: Math.round(r.height) + 24 }
})
console.log('Bretthöhe:', m.height - 24, 'px')
await t.screenshot({ path: '.tmp-cu/brett.png', clip: m, captureBeyondViewport: false })
await b.disconnect()
