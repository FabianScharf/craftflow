import puppeteer from 'puppeteer-core'
const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null, protocolTimeout: 120000 })
const sleep = ms => new Promise(r => setTimeout(r, ms))
const page = await browser.newPage()
await page.setViewport({ width: 1280, height: 900 })
await page.goto('https://app.getcraftflow.de/settings', { waitUntil: 'networkidle2', timeout: 90000 })
await sleep(3000)
// Bereich Marketing & CI oeffnen
await page.evaluate(() => { const el = [...document.querySelectorAll('button, div, span, a')].find(e => e.children.length <= 2 && e.innerText && e.innerText.trim() === 'Marketing & CI'); el && el.click() })
await sleep(1200)
await page.screenshot({ path: '/tmp/cfshots/ci-vorher.png' })
// Nur im Browser umfaerben, NICHT speichern
await page.evaluate(() => { document.documentElement.style.setProperty('--c-primary', '#FFFFFF'); document.documentElement.style.setProperty('--c-accent', '#C8102E') })
await sleep(500)
await page.screenshot({ path: '/tmp/cfshots/ci-weiss-settings.png' })
// Textfeld-Pfad pruefen: was kommt beim Farbwaehler an?
const probe = await page.evaluate(() => {
  const txt = [...document.querySelectorAll('input[maxlength="7"]')]
  const col = [...document.querySelectorAll('input[type="color"]')]
  if (!txt.length || !col.length) return 'Felder nicht gefunden'
  const d = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')
  d.set.call(txt[1], '#C8102E'); txt[1].dispatchEvent(new Event('input', { bubbles: true }))
  return new Promise(r => setTimeout(() => {
    const sw = [...document.querySelectorAll('span')].find(s => s.innerText === 'Abbrechen')
    r({ textfeld: txt[1].value, farbwaehler: col[1].value, vorschauFarbe: sw ? getComputedStyle(sw).color : 'n/a' })
  }, 300))
})
console.log('Probe Textfeld -> Farbwaehler:', JSON.stringify(probe))
await page.screenshot({ path: '/tmp/cfshots/ci-weiss-vorschau.png' })
// Hauptseite ebenfalls ansehen
await page.goto('https://app.getcraftflow.de/', { waitUntil: 'networkidle2', timeout: 90000 })
await sleep(3000)
await page.evaluate(() => { document.documentElement.style.setProperty('--c-primary', '#FFFFFF'); document.documentElement.style.setProperty('--c-accent', '#C8102E') })
await sleep(500)
await page.screenshot({ path: '/tmp/cfshots/ci-weiss-app.png' })
await page.close(); browser.disconnect()
