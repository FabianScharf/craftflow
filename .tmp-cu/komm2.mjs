import puppeteer from 'puppeteer-core'
const b = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null })
const t = (await b.pages()).find(p => p.url().includes('craftflow-git-dev'))
await t.bringToFront()
// ersten "Etwas dazu sagen"-Knopf klicken
await t.evaluate(() => { const k = [...document.querySelectorAll('button')].find(e => /Etwas dazu sagen/.test(e.textContent)); if (k) k.click() })
await new Promise(r => setTimeout(r, 1000))
// Text tippen
await t.evaluate(() => { const ta = [...document.querySelectorAll('textarea')].find(e => /Geht dir das auch so/.test(e.placeholder || '')); if (ta) ta.focus() })
await t.keyboard.type('Probe: So sieht ein Kommentar aus. Wird gleich wieder geloescht.', { delay: 12 })
await new Promise(r => setTimeout(r, 600))
// Haken "als Antwort von CraftFlow" abwaehlen, damit es ein normaler Kommentar ist
await t.evaluate(() => {
  const l = [...document.querySelectorAll('label')].find(e => /als Antwort von CraftFlow/.test(e.textContent))
  const cb = l?.querySelector('input')
  if (cb && cb.checked) cb.click()
})
await new Promise(r => setTimeout(r, 500))
await t.evaluate(() => { const k = [...document.querySelectorAll('button')].find(e => e.textContent.trim() === 'Senden'); if (k) k.click() })
await new Promise(r => setTimeout(r, 3000))
const d = await t.evaluate(() => { const h = document.body.innerText.replace(/\s+/g,' '); const i = h.indexOf('Fehler beheben'); return h.slice(i, i + 400) })
console.log(d)
await b.disconnect()
