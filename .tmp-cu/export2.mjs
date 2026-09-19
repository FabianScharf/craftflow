import puppeteer from 'puppeteer-core'
const b = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null })
const seiten = await b.pages()
const app = seiten.filter(p => p.url().includes('vercel.app'))
for (const p of app) console.log('URL:', p.url())
// Projektliste holen, um die Wegwerf-Projekt-Adresse zu finden
const p0 = app[0]
await p0.bringToFront()
const treffer = await p0.evaluate(() => {
  const a = [...document.querySelectorAll('a[href*="/project"], a[href*="/projekt"]')]
  return a.slice(0, 12).map(x => x.getAttribute('href') + ' :: ' + x.innerText.replace(/\s+/g, ' ').slice(0, 60))
})
console.log(treffer.join('\n'))
await b.disconnect()
