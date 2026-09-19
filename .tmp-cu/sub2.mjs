import puppeteer from 'puppeteer-core'
import fs from 'fs'
const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null })
const page = (await browser.pages()).find(p => p.url().includes('doc.clickup.com'))
const titles = ['Willkommen bei getCraftflow','Login & Zugang','Einstellungen einrichten','Deine erste Kalkulation','Was gute Eingaben ausmacht','Ergebnisse verstehen & prüfen','KI Optimierung','KI Kalkulationscheck','Angebot exportieren als PDF','Kontakt & Support']
const out = []
for (const t of titles) {
  const ok = await page.evaluate((t) => {
    const el = [...document.querySelectorAll('.sidebar-name-text')].find(e => e.innerText.trim() === t)
    if (!el) return false
    el.click(); return true
  }, t)
  if (!ok) { out.push(`\n\n##### ${t} ##### (nicht gefunden)`); continue }
  await new Promise(r => setTimeout(r, 5000))
  const txt = await page.evaluate(() => {
    const main = document.querySelector('.cu-dashboard-doc-main, [class*="doc-main"], main') || document.body
    return main.innerText.replace(/\n{3,}/g, '\n\n')
  })
  const imgs = await page.evaluate(() => [...document.querySelectorAll('img')].map(i => i.src).filter(s => s.includes('attachments') || s.includes('githubusercontent')))
  out.push(`\n\n##### ${t} #####\nURL: ${page.url()}\nBILDER: ${imgs.length}\n${txt}`)
}
fs.writeFileSync('/tmp/cu_subpages.txt', out.join('\n'))
console.log('geschrieben:', out.join('\n').length, 'Zeichen')
browser.disconnect()
