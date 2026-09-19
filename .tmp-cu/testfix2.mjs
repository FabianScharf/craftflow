import puppeteer from 'puppeteer-core'
const b = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null })
const t = (await b.pages()).find(p => p.url().includes('craftflow-git-dev'))
await t.bringToFront()
const sicht = async () => t.evaluate(() => {
  const leiste = [...document.querySelectorAll('div')].find(x => getComputedStyle(x).position === 'fixed' && /Nicht gespeicherte/.test(x.textContent || ''))
  const feld = document.querySelectorAll('input[type="text"]')[1]
  return { leiste: !!leiste, kundenname: feld ? feld.value : '?' }
})
console.log('vorher:', JSON.stringify(await sicht()))
const felder = await t.$$('input[type="text"]')
await felder[1].click()
await t.keyboard.type('Probe Speicherfehler', { delay: 40 })
await new Promise(r => setTimeout(r, 1500))
console.log('nach dem Tippen:', JSON.stringify(await sicht()))
await t.screenshot({ path: '.tmp-cu/testfix.png', captureBeyondViewport: false })
await b.disconnect()
