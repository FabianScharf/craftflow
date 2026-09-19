import puppeteer from 'puppeteer-core'
const b = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null })
const app = (await b.pages()).find(p => p.url().includes('vercel.app'))
await app.bringToFront()
const box = await app.evaluate(() => {
  const worte = ['CSV – Vollexport', 'SQL (.sql)', 'Excel (.xlsx)', 'CSV – Übersicht', 'JSON', 'GAEB DA84', 'Export']
  const alle = [...document.querySelectorAll('button, a, div, span')]
  const rects = []
  for (const w of worte) {
    const e = alle.filter(x => x.children.length <= 1 && (x.textContent || '').trim().includes(w))
    if (e.length) { const r = e[e.length - 1].getBoundingClientRect(); if (r.width && r.height) rects.push({ w, ...r.toJSON() }) }
  }
  if (!rects.length) return null
  const x1 = Math.min(...rects.map(r => r.x)), y1 = Math.min(...rects.map(r => r.y))
  const x2 = Math.max(...rects.map(r => r.x + r.width)), y2 = Math.max(...rects.map(r => r.y + r.height))
  return { x1, y1, x2, y2, teile: rects.map(r => `${r.w}@${Math.round(r.x)},${Math.round(r.y)}`) }
})
console.log(JSON.stringify(box?.teile))
if (box) {
  const pad = 14
  const x = Math.max(0, box.x1 - pad), y = Math.max(0, box.y1 - pad)
  await app.screenshot({ path: '.tmp-cu/w-export-menue.png', clip: {
    x, y, width: Math.min(1400 - x, box.x2 - box.x1 + pad * 2), height: Math.min(1000 - y, box.y2 - box.y1 + pad * 2) } })
  console.log('Bereich:', Math.round(x), Math.round(y), Math.round(box.x2 - box.x1), Math.round(box.y2 - box.y1))
}
await b.disconnect()
