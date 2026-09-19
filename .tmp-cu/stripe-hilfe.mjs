// Verbindet sich mit Fabians laufendem Chrome (Debug-Port 9222) und liefert die
// Seite, deren URL das Muster enthält. Kein eigenes Fenster, keine neue Anmeldung.
import puppeteer from 'puppeteer-core'

export async function hole(muster) {
  const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null })
  const seiten = await browser.pages()
  const seite = seiten.find(p => p.url().includes(muster))
  if (!seite) {
    const offen = seiten.map(p => p.url()).join('\n  ')
    await browser.disconnect()
    throw new Error(`Kein Tab mit "${muster}". Offen:\n  ${offen}`)
  }
  return { browser, seite }
}

export async function schuss(seite, datei) {
  await seite.screenshot({ path: datei })
  console.log('Bild:', datei)
}
