import puppeteer from 'puppeteer-core'
const B = 'https://craftflow-git-dev-fabian-scharf-s-projects.vercel.app'
const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null, protocolTimeout: 180000 })
const sleep = ms => new Promise(r => setTimeout(r, ms))
const page = await browser.newPage(); await page.setViewport({ width: 1280, height: 1100 })
await page.goto(B + '/settings?nc=' + Date.now(), { waitUntil: 'domcontentloaded', timeout: 90000 }); await sleep(5000)
await page.evaluate(() => { const el = [...document.querySelectorAll('button.nav-item')].find(e => e.innerText.trim().endsWith('Mein Betrieb')); el && el.click() }); await sleep(4000)
const out = {}
// Kasten finden und in den Blick holen
const kasten = await page.evaluateHandle(() => { const t = [...document.querySelectorAll('div')].find(d => d.children.length > 0 && /^Das Referenzprojekt:/.test((d.innerText || '').trim().split('\n')[0])); return t })
const box = kasten.asElement()
if (!box) { console.log('KASTEN NICHT GEFUNDEN'); process.exit(1) }
await box.evaluate(e => e.scrollIntoView({ block: 'start' })); await sleep(800)
out.textZu = (await box.evaluate(e => e.innerText)).slice(0, 700)
await box.screenshot({ path: '/tmp/cfshots/referenz-kasten-zu.png' })
// Aufklappen: Knopf mit dem Text
const toggle = await page.evaluateHandle(() => [...document.querySelectorAll('button')].find(b => /So rechnet CraftFlow dieses Projekt/.test(b.innerText)))
const tb = toggle.asElement(); out.toggleGefunden = !!tb
if (tb) { await tb.click(); await sleep(1500) }
out.textAuf = (await box.evaluate(e => e.innerText)).slice(0, 2500)
await box.screenshot({ path: '/tmp/cfshots/referenz-kasten-auf.png' })
// erste Position aufklappen (Knopf, der „Stk" enthält)
const pos = await page.evaluateHandle(() => [...document.querySelectorAll('button')].find(b => /Stk/.test(b.innerText) && /€/.test(b.innerText)))
const pb = pos.asElement(); out.positionKnopf = !!pb
if (pb) { await pb.click(); await sleep(1200); await box.screenshot({ path: '/tmp/cfshots/referenz-kasten-position.png' }) }
out.textPosition = (await box.evaluate(e => e.innerText)).slice(0, 3000)
// Als Projekt öffnen
const oeff = await page.evaluateHandle(() => [...document.querySelectorAll('button')].find(b => /Als Projekt öffnen/.test(b.innerText)))
const ob = oeff.asElement(); out.oeffnenKnopf = !!ob
if (ob) { await ob.click(); await sleep(4000); out.meldung = (await box.evaluate(e => e.innerText)).match(/Projekt[^\n]{0,120}angelegt[^\n]{0,80}/)?.[0] ?? null }
out.projekte = await page.evaluate(async () => { const l = await (await fetch('/api/projects', { cache: 'no-store' })).json(); const ref = (Array.isArray(l) ? l : []).filter(p => /^Referenz: /.test(p.title)); const o = { gefunden: ref.map(p => p.title) }; for (const p of ref) o['geloescht'] = (await fetch('/api/projects/' + p.id, { method: 'DELETE' })).status; return o })
console.log(JSON.stringify(out, null, 1))
await page.close(); browser.disconnect()
