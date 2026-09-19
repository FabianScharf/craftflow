// Live-Test R5: Mein Betrieb mit Referenzprojekt, Kalkulation aufklappen, Als Projekt öffnen, aufräumen. Kein KI-Aufruf.
import puppeteer from 'puppeteer-core'
const B = 'https://craftflow-git-dev-fabian-scharf-s-projects.vercel.app'
const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null, protocolTimeout: 180000 })
const sleep = ms => new Promise(r => setTimeout(r, ms))
const page = await browser.newPage(); await page.setViewport({ width: 1280, height: 1000 })
const fehler = []; page.on('console', m => { if (m.type() === 'error') fehler.push(m.text().slice(0, 160)) }); page.on('pageerror', e => fehler.push('pageerror ' + String(e).slice(0, 160)))
await page.goto(B + '/settings?nc=' + Date.now(), { waitUntil: 'domcontentloaded', timeout: 90000 }); await sleep(5000)
const out = {}
out.api = await page.evaluate(async () => { const j = await (await fetch('/api/settings/kalibrierung', { cache: 'no-store' })).json(); const r = j.referenzprojekt; return r ? { schluessel: r.schluessel, name: r.name, positionen: r.positionen.length, alternativen: r.positionen.filter(p => p.alternativ).length, summen: r.summen, faustregel: r.faustregel, baender: Object.keys(r.baender || {}) } : { fehlt: true, keys: Object.keys(j) } })
await page.evaluate(() => { const el = [...document.querySelectorAll('button.nav-item')].find(e => e.innerText.trim().endsWith('Mein Betrieb')); el && el.click() }); await sleep(3500)
let t = await page.evaluate(() => document.body.innerText)
out.kasten = { referenzTitel: (t.match(/Das Referenzprojekt: [^\n]+/) || [null])[0], aufklappbar: /So rechnet CraftFlow dieses Projekt/.test(t), grundfrage: (t.match(/CraftFlow rechnet [^\n]{0,80}/) || [null])[0], faustregel: (t.match(/Faustregel[^\n]{0,120}/) || [null])[0], lackierkabine: /Lackierkabine/.test(t) }
await page.screenshot({ path: '/tmp/cfshots/referenz-1.png', fullPage: false })
await page.evaluate(() => { const b = [...document.querySelectorAll('button, div')].find(e => e.children.length <= 2 && /So rechnet CraftFlow dieses Projekt/.test(e.innerText || '')); b && b.click() }); await sleep(1500)
t = await page.evaluate(() => document.body.innerText)
out.aufgeklappt = { alternativeChips: (t.match(/Alternative/g) || []).length, netto: (t.match(/Netto[^\n]{0,40}/) || [null])[0], material: (t.match(/Material[^\n]{0,40}€/) || [null])[0] }
// erste Position aufklappen
await page.evaluate(() => { const rows = [...document.querySelectorAll('button, div')].filter(e => e.children.length <= 3 && /Pos\.|Stk/.test(e.innerText || '') && (e.innerText || '').length < 120); rows[0] && rows[0].click() }); await sleep(1200)
await page.screenshot({ path: '/tmp/cfshots/referenz-2.png', fullPage: false })
t = await page.evaluate(() => document.body.innerText)
out.detail = { kostenstellenSichtbar: /Zusammenbau|Zuschnitt/.test(t), materialSichtbar: /Spanplatte|Eiche|Türblatt|Rohtreppe/.test(t) }
// Als Projekt öffnen
const geklickt = await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(b => b.innerText.trim() === 'Als Projekt öffnen'); if (!b) return false; b.click(); return true }); await sleep(3500)
t = await page.evaluate(() => document.body.innerText)
out.projektOeffnen = { geklickt, meldung: (t.match(/Projekt [„‚"'][^\n]{0,80}/) || [null])[0] }
out.projekte = await page.evaluate(async () => { const l = await (await fetch('/api/projects', { cache: 'no-store' })).json(); const ref = (Array.isArray(l) ? l : []).filter(p => /^Referenz: /.test(p.title)); const out = { gefunden: ref.map(p => p.title) }; for (const p of ref) { const d = await fetch('/api/projects/' + p.id, { method: 'DELETE' }); out['geloescht_' + p.id.slice(0, 8)] = d.status } return out })
out.fehler = fehler
console.log(JSON.stringify(out, null, 1))
await page.close(); browser.disconnect()
