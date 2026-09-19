import puppeteer from 'puppeteer-core'
const b = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null })
const app = (await b.pages()).find(p => p.url().includes('vercel.app'))
await app.bringToFront()
const box = await app.evaluate(() => {
  const alle = [...document.querySelectorAll('*')]
  const treffer = alle.filter(e => e.children.length === 0 && /CSV – Vollexport/.test(e.textContent || ''))
  if (!treffer.length) return null
  // vom Textknoten nach oben, bis alle sechs Formate drin sind
  let e = treffer[0]
  for (let i = 0; i < 8; i++) {
    const t = e.textContent || ''
    if (/GAEB DA84/.test(t) && /Vollexport/.test(t)) break
    e = e.parentElement
    if (!e) return null
  }
  // eine Ebene höher, damit der Export-Knopf mit im Bild ist
  const ziel = e.parentElement || e
  const r = ziel.getBoundingClientRect()
  return { x: r.x, y: r.y, w: r.width, h: r.height, text: (ziel.textContent || '').replace(/\s+/g, ' ').slice(0, 140) }
})
console.log(JSON.stringify(box))
if (box) {
  const pad = 12
  await app.screenshot({ path: '.tmp-cu/w-export-menue.png', clip: {
    x: Math.max(0, box.x - pad), y: Math.max(0, box.y - pad),
    width: Math.min(1400 - Math.max(0, box.x - pad), box.w + pad * 2),
    height: Math.min(1000 - Math.max(0, box.y - pad), box.h + pad * 2) } })
  console.log('gespeichert')
}
await b.disconnect()
