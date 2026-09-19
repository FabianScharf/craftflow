import puppeteer from 'puppeteer-core'
const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null })
const page = await browser.newPage()
await page.goto('https://craftflow-git-dev-fabian-scharf-s-projects.vercel.app/api/cron/tag3-mail?vorschau=1', { waitUntil: 'networkidle2', timeout: 60000 })
console.log(JSON.stringify(await page.evaluate(() => {
  const h2s = [...document.querySelectorAll('h2')].map(h => ({ t: h.innerText.slice(0, 30), inline: h.getAttribute('style'), computed: getComputedStyle(h).color }))
  const img = document.querySelector('img'); return { h2s, img: { w: img.naturalWidth, h: img.naturalHeight, src: img.src } }
}), null, 1))
await page.close(); browser.disconnect()
