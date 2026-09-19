import puppeteer from 'puppeteer-core'
const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null })
const sleep = ms => new Promise(r => setTimeout(r, ms))
const page = await browser.newPage()
await page.setViewport({ width: 1280, height: 1000 })
const B = 'https://craftflow-git-dev-fabian-scharf-s-projects.vercel.app'
await page.goto(B + '/settings', { waitUntil: 'networkidle2', timeout: 90000 }); await sleep(2500)
console.log('Palette:', await page.evaluate(() => { const cs = getComputedStyle(document.documentElement); return ['--c-primary','--c-text','--c-surface1','--c-ok','--c-err'].map(v => v + '=' + cs.getPropertyValue(v).trim()).join(' ') }))
for (const abschnitt of ['Mein Betrieb', 'Meine Bauweise', 'Materialpreise', 'Textbausteine', 'Lieferanten', 'E-Mail & Versand', 'Mein Plan', 'Briefpapier', 'Auswertung']) {
  await page.evaluate((t) => { const el = [...document.querySelectorAll('button, div, span, a')].find(e => e.children.length <= 2 && e.innerText && e.innerText.trim() === t); el && el.click() }, abschnitt); await sleep(2500)
  const datei = '/tmp/cfshots/hell-' + abschnitt.replace(/[^a-zA-Z]/g, '') + '.png'
  await page.screenshot({ path: datei }); console.log('✓', abschnitt)
}
await page.goto(B + '/', { waitUntil: 'networkidle2', timeout: 90000 }); await sleep(3000)
await page.screenshot({ path: '/tmp/cfshots/hell-start.png' })
await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(b => b.title && /projekt|liste|ordner/i.test(b.title)); b && b.click() }); await sleep(2000)
await page.screenshot({ path: '/tmp/cfshots/hell-projekte.png' })
// Ein Projekt oeffnen → Kalkulationsansicht
await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(b => b.innerText.trim().startsWith('Öffnen')); b && b.click() }); await sleep(3500)
await page.screenshot({ path: '/tmp/cfshots/hell-kalkulation.png' })
await page.evaluate(() => window.scrollBy(0, 900)); await sleep(500)
await page.screenshot({ path: '/tmp/cfshots/hell-kalkulation2.png' })
console.log('fertig')
await page.close(); browser.disconnect()
