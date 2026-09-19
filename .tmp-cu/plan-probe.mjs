import puppeteer from 'puppeteer-core'
const [label, modus] = [process.argv[2], process.argv[3]] // modus: enterprise | starter | solo
const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null, protocolTimeout: 120000 })
const sleep = ms => new Promise(r => setTimeout(r, ms))
const B = 'https://craftflow-git-dev-fabian-scharf-s-projects.vercel.app'
const page = await browser.newPage(); await page.setViewport({ width: 1280, height: 1000 })
const geh = async (abschnitt) => { await page.evaluate((t) => { const el = [...document.querySelectorAll('button, div, span, a')].find(e => e.children.length <= 2 && e.innerText && e.innerText.trim() === t); el && el.click() }, abschnitt); await sleep(3500) }
const text = () => page.evaluate(() => document.body.innerText)
await page.goto(B + '/settings', { waitUntil: 'domcontentloaded', timeout: 90000 }); await sleep(5000)
const out = {}
await geh('Mein Plan'); const t1 = await text(); out.planKacheln = { fairUse: t1.includes('Fair Use'), beliebt: t1.includes('Beliebt'), netto: /zzgl\. gesetzl/.test(t1), grosseProjekte: t1.includes('Große Projekte in Blöcken') }
await page.screenshot({ path: `/tmp/cfshots/plan-${label}-meinplan.png` })
await geh('Auswertung'); const t2 = await text(); out.auswertung = t2.includes('ist ab dem Pro-Plan verfügbar') ? 'GESPERRT (Kasten)' : t2.includes('Gesamtvolumen') || t2.includes('ANGEBOTE') ? 'offen' : 'unklar'
await geh('Meine Bauweise'); const t3 = await text(); out.bauweise = t3.includes('ist ab dem Starter-Plan verfügbar') ? 'GESPERRT (Kasten)' : (t3.match(/\d+ (von \d+ )?Regeln? aktiv/) || ['kein Zähler'])[0]
await page.screenshot({ path: `/tmp/cfshots/plan-${label}-bauweise.png` })
await geh('Briefpapier'); const t4 = await text(); out.briefpapierGestaltung = t4.includes('Die Gestaltung des Angebots ist ab dem Starter-Plan') ? 'GESPERRT (Kasten)' : 'offen'
await geh('Mein Betrieb'); const t5 = await text(); out.betrieb = t5.includes('Betriebskalibrierung ist ab dem Starter-Plan') ? 'GESPERRT' : t5.includes('Die Lernschleife ist ab dem Pro-Plan') ? 'offen, Lernschleife GESPERRT' : 'offen'
// API-Sperren (keine KI-Kosten: 402/403 kommen vor dem KI-Aufruf; im Enterprise-Modus wird analyze NICHT aufgerufen)
out.api = await page.evaluate(async (modus) => {
  const r = {}
  const ls = await fetch('/api/lernschleife', { method: 'POST' }); r.lernschleife = ls.status + ' ' + ((await ls.json().catch(() => ({}))).minPlan || '')
  const an = await fetch('/api/analytics'); r.auswertung = an.status
  if (modus !== 'enterprise') { const a = await fetch('/api/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: 'Deckeltest', imageBase64: ['/9j/4AAQSkZJRg=='] }) }); const j = await a.json().catch(() => ({})); r.analyzeMitBild = a.status + ' ' + (j.error || '').slice(0, 70) }
  const bw = await fetch('/api/settings/bauweise'); const bj = await bw.json().catch(() => ({})); r.bauweiseGet = { deckel: bj.deckel, plan: bj.plan, aktivDurchPlan: (bj.regeln || []).map(x => x.aktivDurchPlan).join(',') }
  return r
}, modus)
await page.goto(B + '/', { waitUntil: 'domcontentloaded', timeout: 90000 }); await sleep(4000)
out.uploadKacheln = await page.evaluate(() => { const t = document.body.innerText; return { abStarter: t.includes('AB STARTER'), abEnterprise: t.includes('AB ENTERPRISE') } })
await page.screenshot({ path: `/tmp/cfshots/plan-${label}-start.png` })
console.log(label + ':', JSON.stringify(out))
await page.close(); browser.disconnect()
