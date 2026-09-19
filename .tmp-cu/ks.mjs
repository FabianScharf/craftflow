import puppeteer from 'puppeteer-core'
const b = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null })
const app = (await b.pages()).find(p => p.url().includes('vercel.app'))
await app.bringToFront()
const d = await app.evaluate(() => {
  const el = [...document.querySelectorAll('*')].filter(e => e.children.length <= 2 && /Produktion/.test(e.textContent || '') && e.getBoundingClientRect().width < 400)
  return el.slice(0, 6).map(e => `${e.tagName}.${e.className?.toString().slice(0,20)} "${e.textContent.replace(/\s+/g,' ').trim().slice(0,40)}" @${Math.round(e.getBoundingClientRect().x)},${Math.round(e.getBoundingClientRect().y)} klickbar=${getComputedStyle(e).cursor}`)
})
console.log(d.join('\n'))
await b.disconnect()
