import puppeteer from 'puppeteer-core'
const b = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null })
const tabs = (await b.pages()).filter(p => p.url().includes('localhost:4322/werkstatt'))
console.log('Werkstatt-Tabs:', tabs.length)
for (const t of tabs) {
  try { await t.reload({ waitUntil: 'networkidle2', timeout: 45000 }) } catch (e) { console.log('langsam:', t.url().slice(-30)) }
}
const eine = tabs.find(t => t.url().includes('kalkulation-optimieren')) || tabs[0]
await eine.bringToFront()
await new Promise(r => setTimeout(r, 1500))
const pruef = await eine.evaluate(() => {
  const bilder = [...document.images].map(i => ({ src: i.currentSrc.split('/').pop(), ok: i.naturalWidth > 0 }))
  const body = getComputedStyle(document.body)
  return { url: location.pathname, hintergrund: body.backgroundColor, schrift: body.fontFamily.slice(0, 30), bilder }
})
console.log(JSON.stringify(pruef, null, 1))
await eine.screenshot({ path: '.tmp-cu/kontrolle.png', captureBeyondViewport: false })
await b.disconnect()
