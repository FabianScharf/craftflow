import puppeteer from 'puppeteer-core'
const b = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null })
const app = (await b.pages()).find(p => p.url().includes('vercel.app'))
await app.bringToFront()
const info = await app.evaluate(() => {
  const ta = document.querySelector('textarea')
  let e = ta, panel = null
  while (e.parentElement) {
    e = e.parentElement
    const r = e.getBoundingClientRect()
    if (r.width >= 320 && r.height > 400) { panel = e; break }
  }
  if (!panel) return null
  const r = panel.getBoundingClientRect()
  return { x: r.x, y: r.y, w: r.width, h: r.height, text: (panel.textContent || '').replace(/\s+/g, ' ').slice(0, 300) }
})
console.log(JSON.stringify(info))
if (info) {
  const x = Math.max(0, info.x - 8), y = Math.max(0, info.y - 8)
  await app.screenshot({ path: '.tmp-cu/w-chat.png', clip: { x, y, width: Math.min(1400 - x, info.w + 16), height: Math.min(1000 - y, info.h + 16) } })
  console.log('gespeichert')
}
await b.disconnect()
