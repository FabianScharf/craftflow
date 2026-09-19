import puppeteer from 'puppeteer-core'
const b = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null })
const t = (await b.pages()).find(p => p.url().includes('craftflow-git-dev'))
await t.bringToFront()
const ok = await t.evaluate(() => {
  const ta = [...document.querySelectorAll('textarea')].find(e => /Geht dir das auch so/.test(e.placeholder || ''))
  if (!ta) return false
  // von der Schreibfläche aufwärts bis zur Wunschkarte
  let p = ta
  for (let i = 0; i < 8; i++) { p = p.parentElement; if (p && /Fehler beheben/.test(p.textContent || '')) break }
  p.id = 'probe-karte'
  p.scrollIntoView({ block: 'center' })
  return true
})
console.log('Karte gefunden:', ok)
await new Promise(r => setTimeout(r, 900))
const el = await t.$('#probe-karte')
if (el) await el.screenshot({ path: '.tmp-cu/komm-offen.png' })
await b.disconnect()
