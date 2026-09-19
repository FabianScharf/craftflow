// Vollständiger Rundgang über alle Einstellungsbereiche und App-Bildschirme, in zwei Farbwelten.
// Sammelt Konsolenfehler, Seitenfehler und fehlgeschlagene Anfragen je Bereich; Screenshots nach /tmp/cfshots/check-*.png. Kein KI-Aufruf.
import puppeteer from 'puppeteer-core'
import { writeFileSync } from 'node:fs'
const B = 'https://craftflow-git-dev-fabian-scharf-s-projects.vercel.app'
const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null, protocolTimeout: 300000 })
const sleep = ms => new Promise(r => setTimeout(r, ms))
const page = await browser.newPage(); await page.setViewport({ width: 1280, height: 1000 })
let konsole = [], anfragen = []
page.on('console', m => { if (['error', 'warning'].includes(m.type())) konsole.push(m.type() + ': ' + m.text().slice(0, 200)) })
page.on('pageerror', e => konsole.push('pageerror: ' + String(e).slice(0, 200)))
page.on('response', r => { const s = r.status(); if (s >= 400 && !r.url().includes('_vercel') ) anfragen.push(s + ' ' + r.request().method() + ' ' + r.url().replace(B, '')) })
const ergebnis = {}
const merke = (name) => { ergebnis[name] = { konsole: [...konsole], anfragen: [...anfragen] }; konsole = []; anfragen = [] }
const geh = async (t) => {
  const ok = await page.evaluate((t) => { const el = [...document.querySelectorAll('button.nav-item')].find(e => e.innerText.trim().endsWith(t)); if (!el) return false; el.click(); return true }, t)
  if (!ok) console.log('Menüpunkt nicht gefunden:', t)
  // warten, bis nichts mehr „Lädt" und die Überschrift des Bereichs steht (bis 12 s)
  for (let i = 0; i < 24; i++) { await sleep(500); const txt = await page.evaluate(() => document.body.innerText); if (!/Lädt\s*…|Lade |Wird geladen/.test(txt) && txt.length > 600) break }
  await sleep(1500)
}
// Farben sichern
const farben = await page.goto(B + '/', { waitUntil: 'domcontentloaded', timeout: 90000 }).then(() => sleep(2500)).then(() => page.evaluate(async () => { const j = await (await fetch('/api/settings/betriebsprofil', { cache: 'no-store' })).json(); const p = j.profil || j; return { farbe_primaer: p.farbe_primaer, farbe_akzent: p.farbe_akzent } }))
ergebnis._farbenVorher = farben
const setzeFarben = (f) => process.env.NO_FARBEN ? Promise.resolve('übersprungen') : page.evaluate(async (f) => (await fetch('/api/settings/betriebsprofil', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(f) })).status, f)
const BEREICHE = ['Firmendaten', 'Buchhaltung', 'Dokumente', 'Textbausteine', 'Auswertung', 'Marketing & CI', 'Briefpapier', 'Mein Betrieb', 'Kostenstellen', 'Warenaufschläge', 'Meine Bauweise', 'Materialpreise', 'Lieferanten', 'E-Mail & Versand', 'Wünsche', 'Mein Plan', 'Hilfe']
for (const [welt, f] of [['dunkel', { farbe_primaer: '#0D0D0D', farbe_akzent: '#C8885A' }], ['hell', { farbe_primaer: '#FFFFFF', farbe_akzent: '#813732' }]]) {
  await setzeFarben(f)
  await page.goto(B + '/settings?nc=' + Date.now(), { waitUntil: 'domcontentloaded', timeout: 90000 }); await sleep(5000); konsole = []; anfragen = []
  for (const b of BEREICHE) {
    await geh(b); await page.screenshot({ path: `/tmp/cfshots/check-${welt}-${b.replace(/[^a-zA-Z]/g, '')}.png`, fullPage: !process.env.NO_FULLPAGE })
    const t = await page.evaluate(() => document.body.innerText)
    const h2 = await page.evaluate(() => (document.querySelector('h2')?.innerText || '').trim())
    ergebnis[`${welt}/${b}`] = { konsole: [...konsole], anfragen: [...anfragen], leer: t.length < 400, ueberschrift: h2, laedtNoch: /Lädt\s*…/.test(t), undefinedImText: /undefined|NaN|\[object Object\]|null €/.test(t) }
    konsole = []; anfragen = []
  }
  // App-Bildschirme
  await page.goto(B + '/?nc=' + Date.now(), { waitUntil: 'domcontentloaded', timeout: 90000 }); await sleep(5000)
  await page.screenshot({ path: `/tmp/cfshots/check-${welt}-start.png`, fullPage: !process.env.NO_FULLPAGE }); merke(`${welt}/start`)
  await page.click('button[title="Meine Projekte"]').catch(() => {}); await sleep(2500)
  await page.screenshot({ path: `/tmp/cfshots/check-${welt}-projekte.png`, fullPage: !process.env.NO_FULLPAGE }); merke(`${welt}/projekte`)
  const geoeffnet = await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(b => /^Öffnen/.test(b.innerText.trim())); if (!b) return false; b.click(); return true }); await sleep(4000)
  ergebnis[`${welt}/projektGeoeffnet`] = geoeffnet
  for (const tab of ['Kunde', 'Kalkulation', 'Angebot']) {
    await page.evaluate((tab) => { const el = [...document.querySelectorAll('button, div')].find(e => e.children.length <= 2 && (e.innerText || '').trim().replace(/^[^\wÄÖÜäöü]+/, '') === tab); el && el.click() }, tab); await sleep(3500)
    await page.screenshot({ path: `/tmp/cfshots/check-${welt}-tab-${tab}.png`, fullPage: !process.env.NO_FULLPAGE })
    const t = await page.evaluate(() => document.body.innerText)
    ergebnis[`${welt}/tab-${tab}`] = { konsole: [...konsole], anfragen: [...anfragen], undefinedImText: /undefined|NaN|\[object Object\]/.test(t) }; konsole = []; anfragen = []
  }
  await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(b => b.innerText.trim() === '?'); b && b.click() }); await sleep(2000)
  await page.screenshot({ path: `/tmp/cfshots/check-${welt}-hilfe.png` }); merke(`${welt}/hilfe-overlay`)
}
ergebnis._farbenWiederhergestellt = await setzeFarben(farben)
writeFileSync('/tmp/lvtest/checkup-rundgang.json', JSON.stringify(ergebnis, null, 1))
const auffaellig = Object.entries(ergebnis).filter(([k, v]) => v && typeof v === 'object' && ((v.konsole && v.konsole.length) || (v.anfragen && v.anfragen.length) || v.leer || v.undefinedImText))
console.log(JSON.stringify({ bereiche: Object.keys(ergebnis).length, auffaellig: auffaellig.map(([k, v]) => ({ k, konsole: v.konsole, anfragen: v.anfragen, leer: v.leer, undefinedImText: v.undefinedImText })) }, null, 1))
await page.close(); browser.disconnect()
