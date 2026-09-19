// Live-Check nach 19ee32f: Referenz-Kasten in Mein Betrieb — je Stück, CNC, Summen, Bänder.
import puppeteer from 'puppeteer-core'
const sleep = ms => new Promise(r => setTimeout(r, ms))
const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null })
const page = await browser.newPage()
await page.setViewport({ width: 1280, height: 1000 })
await page.goto('https://craftflow-git-dev-fabian-scharf-s-projects.vercel.app/settings', { waitUntil: 'networkidle2', timeout: 90000 }); await sleep(2500)
const api = await page.evaluate(async () => {
  const r = await fetch('/api/settings/kalibrierung', { cache: 'no-store' }); const j = await r.json()
  const rp = j.referenzprojekt || {}
  const grund = (rp.positionen || []).filter(p => !p.alternativ)
  return {
    status: r.status, maschinen: j.kalibrierung?.maschinen, schwerpunkt: j.kalibrierung?.schwerpunkt,
    saetzeCNC: j.saetze?.CNC, aufschlag: j.aufschlag,
    schluessel: rp.schluessel, summen: rp.summen, faustregel: rp.faustregel?.text,
    ersteZeiten: grund[0] ? { titel: grund[0].titel, stk: grund[0].stueckzahl, zeiten: grund[0].arbeitszeit.map(a => a.kostenstelle + ' ' + a.minuten + ' à ' + a.vkStunde) } : null,
    cncZeilen: grund.flatMap(p => p.arbeitszeit.filter(a => a.kostenstelle === 'CNC').map(a => p.titel + ': ' + a.minuten)),
    baenderGrund: (rp.baender?.grund || []).map(b => b.text), anker: Object.fromEntries(Object.entries(rp.anker || {}).map(([k, v]) => [k, v.text])),
  }
})
console.log('API', JSON.stringify(api, null, 1))
await page.evaluate(() => { const els = [...document.querySelectorAll('*')].filter(e => e.childElementCount === 0 && e.innerText?.trim() === 'Mein Betrieb'); if (els.length) (els[0].closest('button, a, .nav-item') || els[0]).click() }); await sleep(4000)
const knopf = await page.evaluateHandle(() => [...document.querySelectorAll('button')].find(b => /So rechnet CraftFlow/.test(b.innerText)))
if (!knopf.asElement()) { console.log('KEIN KNOPF'); await page.close(); browser.disconnect(); process.exit(1) }
await knopf.asElement().click(); await sleep(1500)
// erste Position aufklappen
await page.evaluate(() => { const el = [...document.querySelectorAll('div')].find(d => d.style.cursor === 'pointer' && /Stk/.test(d.innerText) && d.children.length >= 3); el && el.click() }); await sleep(1200)
const ui = await page.evaluate(() => {
  const k = [...document.querySelectorAll('div')].find(d => /Das Referenzprojekt:/.test(d.innerText) && d.style.borderRadius === '8px')
  const t = k ? k.innerText : ''
  return { jeStueck: (t.match(/je Stück/g) || []).length, hatCNC: /\bCNC\b/.test(t), serien: /Werkstattzeit je Stück/.test(t), bandZeilen: t.split('\n').filter(l => /€ –|unter .* €|über .* €/.test(l)).slice(0, 6), kopf: t.split('\n').slice(0, 3) }
})
console.log('UI', JSON.stringify(ui, null, 1))
const kasten = await page.evaluateHandle(() => [...document.querySelectorAll('div')].find(d => /Das Referenzprojekt:/.test(d.innerText) && d.style.borderRadius === '8px'))
if (kasten.asElement()) { await kasten.asElement().scrollIntoView(); await sleep(500); await kasten.asElement().screenshot({ path: '.tmp-cu/referenz-kasten.png' }) }
await page.close(); browser.disconnect()
