import puppeteer from 'puppeteer-core'
import fs from 'fs'
const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null })
const page = await browser.newPage()
await page.goto('https://doc.clickup.com/90121879009/d/h/2kxuxff1-512/3f58edc9b0e72b7', { waitUntil: 'networkidle2', timeout: 60000 })
await new Promise(r => setTimeout(r, 6000))
const mainText = await page.evaluate(() => document.body.innerText)
fs.writeFileSync('/tmp/cu_main.txt', mainText)
const items = await page.evaluate(() => {
  const res = []
  for (const e of document.querySelectorAll('*')) {
    if (e.children.length > 0) continue
    const t = (e.innerText || '').trim()
    const r = e.getBoundingClientRect()
    if (t && t.length < 50 && r.width > 0 && r.height > 0) res.push({ t, x: Math.round(r.x), y: Math.round(r.y), tag: e.tagName, cls: (e.className||'').toString().slice(0,60) })
  }
  return res
})
fs.writeFileSync('/tmp/cu_items.json', JSON.stringify(items, null, 1))
console.log(items.map(i => `${i.tag}@${i.x},${i.y} [${i.cls}] ${i.t}`).join('\n'))
await page.screenshot({ path: '/tmp/cu_main.png' })
browser.disconnect()
