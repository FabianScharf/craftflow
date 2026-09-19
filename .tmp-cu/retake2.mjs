import puppeteer from 'puppeteer-core'
const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null, protocolTimeout: 240000 })
const page = (await browser.pages()).find(p => p.url().includes('craftflow-git-dev'))
await page.bringToFront()
const sleep = ms => new Promise(r => setTimeout(r, ms))
const text = () => page.evaluate(() => document.body.innerText)
let t = await text(); console.log('Stand:', t.slice(0, 260).replace(/\n/g, ' ⏎ '))
if (!t.includes('Einbaugarderobe')) {
  await page.evaluate(() => document.querySelector('[title="Meine Projekte"]')?.click()); await sleep(2500)
  await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(b => b.innerText.includes('Öffnen')); b && b.click() }); await sleep(3000)
}
await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(b => b.innerText.includes('Kalkulation')); b && b.click() }); await sleep(1500)
await page.evaluate(() => { [...document.querySelectorAll('button')].filter(b => ['×','✕'].includes(b.innerText.trim())).forEach(b => b.click()) }); await sleep(500)
// Titel-Element suchen (kann verschachtelt sein)
const info = await page.evaluate(() => {
  const els = [...document.querySelectorAll('*')].filter(e => e.innerText && e.innerText.trim().startsWith('Einbaugarderobe – Korpus') && e.innerText.length < 60)
  const el = els[els.length - 1]; if (!el) return null
  const r = el.getBoundingClientRect(); return { tag: el.tagName, y: r.y, txt: el.innerText.trim().slice(0, 40) }
})
console.log('Titel:', info)
if (info) {
  // aufklappen, falls zu (▶ vor dem Titel)
  const open = await text().then(x => x.includes('KUNDENTEXT'))
  if (!open) { await page.evaluate(() => { const els = [...document.querySelectorAll('*')].filter(e => e.innerText && e.innerText.trim().startsWith('Einbaugarderobe – Korpus') && e.innerText.length < 60); els[els.length - 1].click() }); await sleep(1200) }
  t = await text(); console.log('offen:', t.includes('KUNDENTEXT'), '| Egger-Zeile:', t.includes('Egger Dekorspanplatte 19'), '| Netto:', (t.match(/NETTO\n([^\n]+)/) || [])[1])
  await page.evaluate(() => { const els = [...document.querySelectorAll('*')].filter(e => e.innerText && e.innerText.trim().startsWith('Einbaugarderobe – Korpus') && e.innerText.length < 60); els[els.length - 1].scrollIntoView({ block: 'start' }); window.scrollBy(0, -150) }); await sleep(700)
  await page.screenshot({ path: '/tmp/cfshots/position-offen.png' })
  console.log('Screenshot ok')
}
browser.disconnect()
