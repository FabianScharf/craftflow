import puppeteer from 'puppeteer-core'
const b = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null })
const app = (await b.pages()).find(p => p.url().startsWith('https://app.getcraftflow.de'))
await app.bringToFront()
await app.setViewport({ width: 1400, height: 1000, deviceScaleFactor: 2 })
const warte = ms => new Promise(r => setTimeout(r, ms))

async function klick(text, versuche = 8) {
  for (let i = 0; i < versuche; i++) {
    const ok = await app.evaluate(t => {
      const el = [...document.querySelectorAll('button, a')].find(x => x.textContent?.includes(t))
      if (el) { el.click(); return true }
      return false
    }, text)
    if (ok) return true
    await warte(700)
  }
  return false
}

async function schuss(text, datei, luft = 14, maxHoehe = 700) {
  const k = await app.evaluate((t, mh) => {
    const el = [...document.querySelectorAll('div, section, form')].reverse()
      .find(x => x.textContent?.includes(t) && x.getBoundingClientRect().height < mh && x.getBoundingClientRect().height > 40)
    if (!el) return null
    const r = el.getBoundingClientRect()
    return { x: r.x, y: r.y, width: r.width, height: r.height }
  }, text, maxHoehe)
  if (!k) { console.log('  ✗', text); return false }
  await app.screenshot({ path: datei, clip: {
    x: Math.max(0, k.x - luft), y: Math.max(0, k.y - luft),
    width: Math.min(1400 - Math.max(0, k.x - luft), k.width + luft * 2),
    height: k.height + luft * 2,
  }})
  console.log('  ✓', datei.split('/').pop()); return true
}

// Das Export-Menü öffnen (wir sind noch im Projekt).
console.log('Export-Menü:')
await klick('Export')
await warte(1200)
await schuss('Kopieren', '.tmp-cu/b-export.png', 16)

// Einstellungsbereiche
const bereiche = [
  ['Meine Bauweise', 'b-bauweise.png', 'Bauweise'],
  ['Buchhaltung', 'b-buchhaltung.png', 'Kleinunternehmer'],
  ['Textbausteine', 'b-textbausteine.png', 'Textbaustein'],
  ['Lieferanten', 'b-lieferanten.png', 'Lieferant'],
  ['Warenaufschläge', 'b-warenaufschlaege.png', 'Aufschlag'],
]
await app.goto('https://app.getcraftflow.de/settings', { waitUntil: 'networkidle0' })
await warte(3000)
for (const [nav, datei, suchtext] of bereiche) {
  console.log(nav + ':')
  await klick(nav)
  await warte(2500)
  await app.mouse.move(1350, 950)
  await warte(400)
  if (!await schuss(suchtext, '.tmp-cu/' + datei, 16, 760)) {
    // Rückfall: den Inhaltsbereich als Ganzes
    await app.screenshot({ path: '.tmp-cu/' + datei, clip: { x: 340, y: 60, width: 1000, height: 560 } })
    console.log('  ✓ (Rückfall)', datei)
  }
}
await b.disconnect()
