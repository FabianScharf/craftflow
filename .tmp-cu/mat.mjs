import puppeteer from 'puppeteer-core'
const b = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null })
const app = (await b.pages()).find(p => p.url().includes('vercel.app'))
await app.bringToFront()
const gehe = async (n) => {
  await app.evaluate(x => { const k = [...document.querySelectorAll('button, a, div')].filter(e => e.textContent.trim().endsWith(x) && e.textContent.trim().length < 26 && e.getBoundingClientRect().x < 300); if (k.length) k[k.length-1].click() }, n)
  await new Promise(r => setTimeout(r, 2200))
  return app.evaluate(() => { const h = document.body.innerText.replace(/\s+/g,' '); const i = h.indexOf('Abmelden'); return h.slice(i+9, i+900) })
}
console.log('--- MATERIALPREISE ---\n' + await gehe('Materialpreise'))
console.log('\n--- BUCHHALTUNG ---\n' + await gehe('Buchhaltung'))
await b.disconnect()
