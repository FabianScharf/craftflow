import puppeteer from 'puppeteer-core'
const b = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null })
const app = (await b.pages()).find(p => p.url().includes('vercel.app'))
await app.bringToFront()
const m = await app.evaluate(() => {
  const finde = (re) => { const e = [...document.querySelectorAll('*')].find(x => x.children.length === 0 && re.test(x.textContent || '')); const r = e?.getBoundingClientRect(); return r ? Math.round(r.y) : null }
  return { kopf: finde(/^Buchhaltung$/), steuer: finde(/STEUERDATEN/), gueltig: finde(/GÜLTIG FÜR/), ustid: finde(/UST-IDNR/) }
})
console.log(JSON.stringify(m))
await b.disconnect()
