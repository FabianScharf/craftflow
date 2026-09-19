import puppeteer from 'puppeteer-core'
const b = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null })
const t = (await b.pages()).find(p => p.url().includes('craftflow-git-dev'))
await t.bringToFront()
const sicht = async () => t.evaluate(() => {
  const leiste = [...document.querySelectorAll('div')].find(x => getComputedStyle(x).position === 'fixed' && /Nicht gespeicherte/.test(x.textContent || ''))
  return { leiste: !!leiste, kundenname: [...document.querySelectorAll('input[type="text"]')].map(e => e.value)[1] }
})
console.log('vor der Eingabe:', JSON.stringify(await sicht()))
await t.evaluate(() => { const f = [...document.querySelectorAll('input[type="text"]')]; f[1].focus() })
await t.keyboard.type('Probe Speicherfehler', { delay: 35 })
await new Promise(r => setTimeout(r, 1800))
console.log('nach der Eingabe:', JSON.stringify(await sicht()))
await t.screenshot({ path: '.tmp-cu/testfix.png', captureBeyondViewport: false })
await b.disconnect()
