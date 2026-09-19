import puppeteer from 'puppeteer-core'
const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null, protocolTimeout: 240000 })
const page = (await browser.pages()).find(p => p.url().includes('craftflow-git-dev'))
await page.bringToFront()
const sleep = ms => new Promise(r => setTimeout(r, ms))
const text = () => page.evaluate(() => document.body.innerText)
await page.setViewport({ width: 1280, height: 860, deviceScaleFactor: 2 })
// Demo-Karte gezielt oeffnen: Button "Öffnen →" innerhalb des Containers, der "Demo-Mustermann" enthaelt
const opened = await page.evaluate(() => {
  const btns = [...document.querySelectorAll('button')].filter(b => b.innerText.includes('Öffnen'))
  for (const b of btns) { let c = b; for (let k = 0; k < 6 && c; k++) { c = c.parentElement; if (c && c.innerText.includes('Demo-Mustermann') && !c.innerText.includes('Testmüll')) { b.click(); return true } } }
  return false
})
console.log('Demo geöffnet:', opened); await sleep(3000)
await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(b => b.innerText.includes('🔢 Kalkulation')); b && b.click() }); await sleep(1500)
let t = await text(); console.log('Kalkulation sichtbar:', t.includes('KI-Optimierung'), '| KUNDENTEXT offen:', t.includes('KUNDENTEXT'))
if (!t.includes('KUNDENTEXT')) {
  const ok = await page.evaluate(() => { const els = [...document.querySelectorAll('*')].filter(e => e.innerText && e.innerText.trim().startsWith('Einbaugarderobe – Korpus') && e.innerText.trim().length < 60); const el = els[els.length - 1]; if (!el) return false; el.click(); return true })
  console.log('Position geklickt:', ok); await sleep(1200)
}
t = await text(); console.log('offen:', t.includes('KUNDENTEXT'), '| Egger-Zeile:', t.includes('Egger Dekorspanplatte 19'), '| Netto:', (t.match(/NETTO\n([^\n]+)/) || [])[1])
await page.evaluate(() => { const els = [...document.querySelectorAll('*')].filter(e => e.innerText && e.innerText.trim().startsWith('Einbaugarderobe – Korpus') && e.innerText.trim().length < 60); const el = els[els.length - 1]; el && el.scrollIntoView({ block: 'start' }); window.scrollBy(0, -150) }); await sleep(700)
await page.screenshot({ path: '/tmp/cfshots/position-offen.png' }); console.log('Screenshot ok')
browser.disconnect()
