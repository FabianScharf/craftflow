import puppeteer from 'puppeteer-core'
const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null })
const sleep = ms => new Promise(r => setTimeout(r, ms))
const page = await browser.newPage()
await page.setViewport({ width: 1280, height: 900 })
await page.goto('https://tischlerei-lembeck.de/', { waitUntil: 'networkidle2', timeout: 90000 }); await sleep(3000)
await page.screenshot({ path: '/tmp/cfshots/lembeck.png' })
const daten = await page.evaluate(() => {
  const zaehl = {}
  const merk = (c, wo) => { if (!c || c === 'rgba(0, 0, 0, 0)' || c === 'transparent') return; const k = c; zaehl[k] = zaehl[k] || { n: 0, wo: new Set() }; zaehl[k].n++; zaehl[k].wo.add(wo) }
  for (const el of document.querySelectorAll('*')) {
    const cs = getComputedStyle(el)
    merk(cs.color, 'text'); merk(cs.backgroundColor, 'bg'); merk(cs.borderTopColor, 'border')
  }
  const vars = {}
  for (const sheet of document.styleSheets) { try { for (const r of sheet.cssRules) { if (r.style) for (const p of r.style) if (p.startsWith('--') && /color|farbe|primary|accent|red|rot/i.test(p)) vars[p] = r.style.getPropertyValue(p).trim() } } catch {} }
  const liste = Object.entries(zaehl).map(([c, v]) => ({ c, n: v.n, wo: [...v.wo].join('/') }))
  // Rot-Kandidaten: R deutlich groesser als G und B
  const rot = liste.filter(x => { const m = x.c.match(/rgba?\((\d+), (\d+), (\d+)/); return m && +m[1] > 120 && +m[1] > +m[2] * 1.8 && +m[1] > +m[3] * 1.8 })
  return { titel: document.title, rot, vars, top: liste.sort((a, b) => b.n - a.n).slice(0, 12) }
})
console.log(JSON.stringify(daten, null, 1))
await page.close(); browser.disconnect()
