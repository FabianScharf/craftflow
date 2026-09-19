import puppeteer from 'puppeteer-core'
const b = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null })
const app = (await b.pages()).find(p => p.url().includes('vercel.app'))
await app.bringToFront()
const box = await app.evaluate(() => {
  const ta = document.querySelector('textarea')
  if (!ta) return { fehler: 'kein Eingabefeld' }
  // aufwaerts bis zum Panel (breiter als 300px)
  let e = ta
  while (e.parentElement && e.getBoundingClientRect().width < 320) e = e.parentElement
  const r = e.getBoundingClientRect()
  return { x: r.x, y: r.y, w: r.width, h: r.height, text: (e.textContent || '').replace(/\s+/g, ' ').slice(0, 200) }
})
console.log(JSON.stringify(box))
if (box && !box.fehler) {
  const x = Math.max(0, box.x - 8), y = Math.max(0, box.y - 8)
  await app.screenshot({ path: '.tmp-cu/w-chat.png', clip: { x, y, width: Math.min(1400 - x, box.w + 16), height: Math.min(1000 - y, box.h + 16) } })
  console.log('gespeichert')
}
await b.disconnect()
