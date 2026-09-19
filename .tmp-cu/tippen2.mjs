import puppeteer from 'puppeteer-core'
const b = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null })
const t = (await b.pages()).find(p => p.url().includes('craftflow-git-dev'))
await t.bringToFront()
const sicht = async () => t.evaluate(() => {
  const leiste = [...document.querySelectorAll('div')].find(x => getComputedStyle(x).position === 'fixed' && /Nicht gespeicherte/.test(x.textContent || ''))
  const w = [...document.querySelectorAll('input')].filter(e => e.type === 'text').map(e => e.value)
  return { leiste: !!leiste, felder: w.slice(0, 3) }
})
console.log('A) im Angebot, nichts geaendert:', JSON.stringify(await sicht()))
await t.evaluate(() => { const f = [...document.querySelectorAll('input')].filter(e => e.type === 'text'); f[1].focus() })
await t.keyboard.type('Probe Speicherfehler', { delay: 35 })
await new Promise(r => setTimeout(r, 1800))
console.log('B) nach dem Tippen:', JSON.stringify(await sicht()))
await t.screenshot({ path: '.tmp-cu/testfix.png', captureBeyondViewport: false })
await b.disconnect()
