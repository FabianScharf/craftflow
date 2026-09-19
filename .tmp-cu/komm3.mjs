import puppeteer from 'puppeteer-core'
const b = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null })
const t = (await b.pages()).find(p => p.url().includes('craftflow-git-dev'))
await t.bringToFront()
const m = await t.evaluate(() => {
  const e = [...document.querySelectorAll('*')].find(x => x.children.length === 0 && /^Fehler beheben$/.test((x.textContent||'').trim()))
  let p = e
  while (p && p.getBoundingClientRect().height < 150) p = p.parentElement
  p.scrollIntoView({ block: 'center' })
  return true
})
await new Promise(r => setTimeout(r, 800))
const k = await t.evaluate(() => {
  const e = [...document.querySelectorAll('*')].find(x => x.children.length === 0 && /^Fehler beheben$/.test((x.textContent||'').trim()))
  let p = e
  while (p && p.getBoundingClientRect().height < 150) p = p.parentElement
  const r = p.getBoundingClientRect()
  return { x: Math.round(r.x) - 10, y: Math.round(r.y) - 10, width: Math.round(r.width) + 20, height: Math.round(r.height) + 20 }
})
await t.screenshot({ path: '.tmp-cu/komm-offen.png', clip: k, captureBeyondViewport: false })
console.log('ok')
await b.disconnect()
