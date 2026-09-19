import puppeteer from 'puppeteer-core'
const b = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null })
const t = (await b.pages()).find(p => p.url().includes('craftflow-git-dev'))
await t.bringToFront()
const rahmen = async (suche) => {
  const r = await t.evaluate(s => {
    const e = [...document.querySelectorAll('input')].find(x => x.type === 'text' && new RegExp(s).test(x.value))
    let p = e
    while (p && p.getBoundingClientRect().height < 40) p = p.parentElement
    const a = p.getBoundingClientRect()
    return { x: Math.round(a.x) - 10, y: Math.round(a.y) - 10, width: Math.round(a.width) + 20, height: Math.round(a.height) + 20 }
  }, suche)
  return r
}
const haken = async () => t.evaluate(() => [...document.querySelectorAll('input')].filter(e => e.type === 'checkbox').map(e => e.checked))
console.log('Häkchen jetzt:', JSON.stringify(await haken()))
// sicherstellen: zweites Häkchen AN
const st = await haken()
if (!st[1]) { await t.evaluate(() => { const k = [...document.querySelectorAll('input')].filter(e => e.type === 'checkbox'); k[1].click() }); await new Promise(r => setTimeout(r, 1200)) }
console.log('Häkchen vor der Aufnahme:', JSON.stringify(await haken()))
await t.screenshot({ path: '.tmp-cu/p-alternativ.png', clip: await rahmen('Fensterbank'), captureBeyondViewport: false })
const txt = await t.evaluate(() => { const e = [...document.querySelectorAll('input')].find(x => x.type === 'text' && /Fensterbank/.test(x.value)); let p = e; while (p && p.getBoundingClientRect().height < 40) p = p.parentElement; return p.textContent.replace(/\s+/g,' ').slice(0, 120) })
console.log('Text:', txt)
await b.disconnect()
