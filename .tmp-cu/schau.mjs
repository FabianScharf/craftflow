import puppeteer from 'puppeteer-core'
const b = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null })
const app = (await b.pages()).filter(p => p.url().includes('vercel.app'))
for (const [i, p] of app.entries()) {
  const t = await p.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').slice(0, 400))
  console.log(`--- Tab ${i} ---\n${t}\n`)
}
await b.disconnect()
