import puppeteer from 'puppeteer-core'
const b = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null })
const app = (await b.pages()).find(p => p.url().includes('vercel.app'))
await app.bringToFront()
const m = await app.evaluate(() => {
  const treffer = []
  const lauf = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  let n
  while ((n = lauf.nextNode())) {
    const t = (n.textContent || '').trim()
    if (/UST-IDNR|G.LTIG F.R|STEUERDATEN|UMSATZSTEUERSATZ|Kleinunternehmer/i.test(t)) {
      const r = n.parentElement.getBoundingClientRect()
      treffer.push(`"${t.slice(0,28)}" y=${Math.round(r.y)}`)
    }
  }
  return treffer
})
console.log(m.join('\n'))
await b.disconnect()
