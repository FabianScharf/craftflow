import puppeteer from 'puppeteer-core'
const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null, protocolTimeout: 120000 })
const sleep = ms => new Promise(r => setTimeout(r, ms))
const B = 'https://craftflow-git-dev-fabian-scharf-s-projects.vercel.app'
const page = await browser.newPage(); await page.setViewport({ width: 1280, height: 1000 })
await page.goto(B + '/settings', { waitUntil: 'domcontentloaded', timeout: 90000 }); await sleep(4000)
// API: klemmen + 400 bei Unsinn
const api = await page.evaluate(async () => {
  const patch = async (v) => { const r = await fetch('/api/settings/betriebsprofil', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ preisfaktor: v }) }); return r.status + ' ' + ((await r.json().catch(() => ({}))).error || '').slice(0, 60) }
  const lese = async () => (await (await fetch('/api/settings/betriebsprofil')).json()).profil?.preisfaktor
  const out = {}
  out.unsinn = await patch('abc')
  out.zuHoch = await patch(9); out.nachZuHoch = await lese()
  out.gueltig = await patch(1.25); out.nachGueltig = await lese()
  return out
})
console.log('API:', JSON.stringify(api))
// UI: Mein Betrieb → Abschnitt Preisfaktor
await page.evaluate(() => { const el = [...document.querySelectorAll('button, div, span, a')].find(e => e.children.length <= 2 && e.innerText && e.innerText.trim() === 'Mein Betrieb'); el && el.click() }); await sleep(4000)
const ui = await page.evaluate(() => { const t = document.body.innerText; const inp = [...document.querySelectorAll('input[type="number"]')].map(i => i.min + '–' + i.max); return { abschnitt: t.includes('Preisfaktor'), erklaerung: t.includes('1,20 = 20 % teurer'), zeitfaktorGrenzen: [...new Set(inp)].join(' | ') } })
console.log('UI Mein Betrieb:', JSON.stringify(ui))
await page.evaluate(() => { const h = [...document.querySelectorAll('div')].find(d => d.innerText?.trim() === 'Preisfaktor'); h && h.scrollIntoView() }); await sleep(500)
await page.screenshot({ path: '/tmp/cfshots/preisfaktor-betrieb.png' })
// Kalkulation: Projekt öffnen, Position hinzufügen → Übersicht zeigt PREISFAKTOR 1,25
await page.goto(B + '/', { waitUntil: 'domcontentloaded', timeout: 90000 }); await sleep(3500)
await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(b => b.title && /projekt|liste|ordner/i.test(b.title)); b && b.click() }); await sleep(2500)
await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(b => b.innerText.trim().startsWith('Öffnen')); b && b.click() }); await sleep(4000)
const vorher = await page.evaluate(() => document.body.innerText.includes('PREISFAKTOR'))
await page.evaluate(() => { const b = [...document.querySelectorAll('button, div')].find(e => e.innerText?.trim() === '+ Position hinzufügen'); b && b.click() }); await sleep(1500)
const nachher = await page.evaluate(() => { const t = document.body.innerText; const m = t.match(/PREISFAKTOR\s*\n?\s*([0-9,]+|gemischt)/); return m ? m[1] : null })
console.log('Übersicht: vorher PREISFAKTOR sichtbar =', vorher, '| nach + Position:', nachher)
await page.screenshot({ path: '/tmp/cfshots/preisfaktor-uebersicht.png' })
// Preisfaktor wieder auf 1.00 (Projekt NICHT speichern)
await page.evaluate(async () => fetch('/api/settings/betriebsprofil', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ preisfaktor: 1 }) }))
await page.close(); browser.disconnect()
