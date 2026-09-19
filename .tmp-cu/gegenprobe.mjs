import puppeteer from 'puppeteer-core'
const b = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null })
const t = (await b.pages()).find(p => p.url().includes('craftflow-git-dev'))
await t.bringToFront()
const leiste = () => t.evaluate(() => !![...document.querySelectorAll('div')].find(x => getComputedStyle(x).position === 'fixed' && /Nicht gespeicherte/.test(x.textContent || '')))
// Projektliste
await t.evaluate(() => { const k = [...document.querySelectorAll('button')].find(e => e.textContent.trim() === '📋'); if (k) k.click() })
await new Promise(r => setTimeout(r, 2500))
console.log('1. Projektliste offen, Leiste:', await leiste())
// erstes Projekt oeffnen (das Testprojekt)
const titel = await t.evaluate(() => {
  const k = [...document.querySelectorAll('button')].find(e => /Öffnen/.test(e.textContent))
  const zeile = k ? k.closest('div')?.parentElement?.textContent.replace(/\s+/g,' ').slice(0, 50) : '?'
  if (k) k.click()
  return zeile
})
await new Promise(r => setTimeout(r, 3500))
console.log('2. geoeffnet:', titel)
console.log('   Leiste direkt nach dem Laden (muss false sein):', await leiste())
// eine Zahl aendern -> muss anschlagen
await t.evaluate(() => { const k = [...document.querySelectorAll('button')].find(e => /Kalkulation/.test(e.textContent) && e.textContent.length < 20); if (k) k.click() })
await new Promise(r => setTimeout(r, 1500))
const g = await t.evaluate(() => {
  const f = [...document.querySelectorAll('input')].filter(e => e.type === 'number')
  if (!f.length) return 'keine Zahlenfelder'
  f[f.length - 1].focus()
  return 'Feld mit Wert ' + f[f.length - 1].value
})
console.log('3.', g)
await t.keyboard.press('ArrowUp')
await new Promise(r => setTimeout(r, 1500))
console.log('   Leiste nach der Aenderung (muss true sein):', await leiste())
await b.disconnect()
