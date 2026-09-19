import puppeteer from 'puppeteer-core'
const b = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null })
const t = (await b.pages()).find(p => p.url().includes('craftflow-git-dev'))
await t.bringToFront()
await t.goto('https://craftflow-git-dev-fabian-scharf-s-projects.vercel.app/', { waitUntil: 'networkidle2', timeout: 90000 })
await new Promise(r => setTimeout(r, 3000))

const sicht = async () => t.evaluate(() => {
  const leiste = [...document.querySelectorAll('div')].find(x => getComputedStyle(x).position === 'fixed' && /Nicht gespeicherte/.test(x.textContent || ''))
  const felder = [...document.querySelectorAll('input[type="text"]')].map(e => e.value)
  return { leiste: !!leiste, felder: felder.slice(0, 3) }
})

await t.evaluate(() => { const k = [...document.querySelectorAll('button')].find(e => /Manuell eingeben/.test(e.textContent)); if (k) k.click() })
await new Promise(r => setTimeout(r, 2500))
console.log('A) im Angebot, nichts geaendert:', JSON.stringify(await sicht()))

const felder = await t.$$('input[type="text"]')
console.log('   Textfelder gefunden:', felder.length)
if (felder[1]) {
  await felder[1].click()
  await t.keyboard.type('Probe Speicherfehler', { delay: 35 })
}
await new Promise(r => setTimeout(r, 1800))
console.log('B) nach dem Tippen:', JSON.stringify(await sicht()))
await t.screenshot({ path: '.tmp-cu/testfix.png', captureBeyondViewport: false })
await b.disconnect()
