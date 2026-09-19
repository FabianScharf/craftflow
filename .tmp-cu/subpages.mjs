import puppeteer from 'puppeteer-core'
import fs from 'fs'
const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null })
const pages = await browser.pages()
let page = pages.find(p => p.url().includes('doc.clickup.com'))
if (!page) { page = await browser.newPage(); await page.goto('https://doc.clickup.com/90121879009/d/h/2kxuxff1-512/3f58edc9b0e72b7', { waitUntil: 'networkidle2', timeout: 60000 }); await new Promise(r => setTimeout(r, 5000)) }
const titles = ['Willkommen bei getCraftflow','Login & Zugang','Einstellungen einrichten','Deine erste Kalkulation','Was gute Eingaben ausmacht','Ergebnisse verstehen & prüfen','KI Optimierung','KI Kalkulationscheck','Angebot exportieren als PDF','Kontakt & Support']
const out = []
for (const t of titles) {
  // Unterseiten-Zeile in der Tabelle anklicken
  const ok = await page.evaluate((t) => {
    const el = [...document.querySelectorAll('div.title')].find(e => e.innerText.trim() === t)
    if (!el) return false
    el.click(); return true
  }, t)
  if (!ok) { out.push(`##### ${t} ##### (nicht gefunden)`); continue }
  await new Promise(r => setTimeout(r, 4500))
  const txt = await page.evaluate(() => {
    const main = document.querySelector('.cu-dashboard-doc-main, [class*="doc-main"], main') || document.body
    return main.innerText
  })
  out.push(`\n\n##### ${t} #####\nURL: ${page.url()}\n${txt}`)
  // zurueck zur Hauptseite
  await page.goBack({ waitUntil: 'networkidle2' }).catch(() => {})
  await new Promise(r => setTimeout(r, 3500))
}
fs.writeFileSync('/tmp/cu_subpages.txt', out.join('\n'))
console.log('geschrieben:', out.join('\n').length, 'Zeichen')
browser.disconnect()
