import puppeteer from 'puppeteer-core'

const b = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null })
const app = (await b.pages()).find(p => p.url().startsWith('https://app.getcraftflow.de'))
await app.bringToFront()
await app.setViewport({ width: 1400, height: 1000, deviceScaleFactor: 2 })

const warte = ms => new Promise(r => setTimeout(r, ms))

/** Klickt den ersten Knopf, dessen Beschriftung `text` enthält. */
async function klick(text, versuche = 10) {
  for (let i = 0; i < versuche; i++) {
    const ok = await app.evaluate(t => {
      const el = [...document.querySelectorAll('button, a')].find(x => x.textContent?.includes(t))
      if (el) { el.click(); return true }
      return false
    }, text)
    if (ok) return true
    await warte(800)
  }
  return false
}

/** Fotografiert den Kasten, der `text` enthält — mit etwas Luft drumherum. */
async function schuss(text, datei, luft = 14) {
  const kasten = await app.evaluate(t => {
    const el = [...document.querySelectorAll('div, section, tr')].reverse()
      .find(x => x.textContent?.includes(t) && x.getBoundingClientRect().height < 600 && x.getBoundingClientRect().height > 40)
    if (!el) return null
    const r = el.getBoundingClientRect()
    return { x: r.x, y: r.y, width: r.width, height: r.height }
  }, text)
  if (!kasten) { console.log('  ✗ nicht gefunden:', text); return false }
  await app.screenshot({
    path: datei,
    clip: {
      x: Math.max(0, kasten.x - luft), y: Math.max(0, kasten.y - luft),
      width: Math.min(1400 - kasten.x + luft, kasten.width + luft * 2),
      height: kasten.height + luft * 2,
    },
  })
  console.log('  ✓', datei.split('/').pop())
  return true
}

await app.goto('https://app.getcraftflow.de/', { waitUntil: 'networkidle0' })
await warte(2500)
await app.evaluate(() => [...document.querySelectorAll('button')].find(b => b.textContent?.trim() === 'Schließen')?.click())
await warte(600)

console.log('Startseite:')
await schuss('Dateien hochladen', '.tmp-cu/b-startseite.png', 20)

console.log('Projekt öffnen:')
await klick('📋')
await warte(2500)
await klick('Öffnen')
await warte(4500)

const inProjekt = await app.evaluate(() => document.body.textContent?.includes('KI-Optimierung'))
console.log('  Kalkulation offen:', inProjekt)
if (inProjekt) {
  await schuss('KI-Optimierung', '.tmp-cu/b-ki-kaesten.png', 16)
  // Positionszeile: enthält „Alternativposition"
  await schuss('Alternativposition', '.tmp-cu/b-positionszeile.png', 16)
  await app.screenshot({ path: '.tmp-cu/b-kalkulation-ganz.png' })
  console.log('  ✓ b-kalkulation-ganz.png')
}
await b.disconnect()
