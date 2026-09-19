import puppeteer from 'puppeteer-core'
const b = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null })
const t = await b.newPage()
await t.setViewport({ width: 1400, height: 1000, deviceScaleFactor: 2 })
await t.goto('https://craftflow-git-dev-fabian-scharf-s-projects.vercel.app/', { waitUntil: 'networkidle2', timeout: 90000 })
await new Promise(r => setTimeout(r, 2500))

const sicht = async () => t.evaluate(() => {
  const leiste = [...document.querySelectorAll('div')].find(x => getComputedStyle(x).position === 'fixed' && /Nicht gespeicherte/.test(x.textContent || ''))
  return { leiste: !!leiste, text: document.body.innerText.replace(/\s+/g, ' ').slice(0, 90) }
})
console.log('1. Startbildschirm:', JSON.stringify(await sicht()))

// „Manuell eingeben"
await t.evaluate(() => { const k = [...document.querySelectorAll('button')].find(e => /Manuell eingeben/.test(e.textContent)); if (k) k.click() })
await new Promise(r => setTimeout(r, 1800))
console.log('2. Gleich nach „Manuell eingeben" (Leiste soll NICHT da sein):', JSON.stringify(await sicht()))

// Etwas eintragen
await t.evaluate(() => {
  const setze = (el, w) => {
    const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, w)
    el.dispatchEvent(new Event('input', { bubbles: true }))
  }
  const f = [...document.querySelectorAll('input[type="text"]')]
  if (f[0]) setze(f[0], 'Probe Speicherfehler')
})
await new Promise(r => setTimeout(r, 1500))
console.log('3. Nach der ersten Eingabe (Leiste soll DA sein):', JSON.stringify(await sicht()))

await t.screenshot({ path: '.tmp-cu/testfix.png', captureBeyondViewport: false })
await b.disconnect()
