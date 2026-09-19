import puppeteer from 'puppeteer-core'
const b = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null })
const app = (await b.pages()).find(p => p.url().startsWith('https://app.getcraftflow.de'))
await app.bringToFront()
await app.setViewport({ width: 1400, height: 1000, deviceScaleFactor: 2 })
const warte = ms => new Promise(r => setTimeout(r, ms))

await app.goto('https://app.getcraftflow.de/settings', { waitUntil: 'networkidle0' })
await warte(3000)
await app.evaluate(() => [...document.querySelectorAll('button')].find(b => b.textContent?.includes('Warenaufschläge'))?.click())
await warte(3500)

/* NUR DIE ANZEIGE ändern, nichts speichern: Der Wert wird direkt ins Feld
 * geschrieben, OHNE ein Eingabe-Ereignis auszulösen. React bekommt davon nichts
 * mit, es wird nichts an den Server geschickt — und beim nächsten Laden steht
 * wieder da, was Fabian eingestellt hat. */
const geaendert = await app.evaluate(() => {
  const felder = [...document.querySelectorAll('input')].filter(i => /^\d+$/.test(i.value))
  felder.forEach(i => { i.value = '30' })
  return felder.length
})
console.log('Angezeigte Werte auf den Standard gesetzt:', geaendert)
await warte(400)
await app.mouse.move(1380, 970)
await app.screenshot({ path: '.tmp-cu/b-warenaufschlaege.png', clip: { x: 348, y: 58, width: 992, height: 560 } })
console.log('✓ Bild gemacht')

// Sicherheitshalber neu laden, damit garantiert nichts hängen bleibt.
await app.reload({ waitUntil: 'networkidle0' })
await warte(2000)
console.log('Seite neu geladen — nichts verändert')
await b.disconnect()
