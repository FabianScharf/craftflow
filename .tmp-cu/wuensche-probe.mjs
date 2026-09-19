import puppeteer from 'puppeteer-core'
const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null, protocolTimeout: 120000 })
const sleep = ms => new Promise(r => setTimeout(r, ms))
const B = 'https://craftflow-git-dev-fabian-scharf-s-projects.vercel.app'
const page = await browser.newPage(); await page.setViewport({ width: 1280, height: 1000 })
await page.goto(B + '/settings', { waitUntil: 'domcontentloaded', timeout: 90000 }); await sleep(4000)
const api = await page.evaluate(async () => {
  const j = async (r) => ({ status: r.status, ...(await r.json().catch(() => ({}))) })
  const out = {}
  const g0 = await j(await fetch('/api/wuensche')); out.budgetVorher = g0.budget; out.anzahlVorher = (g0.wuensche || []).length
  const p1 = await j(await fetch('/api/wuensche', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ titel: 'Testwunsch A (kann weg)', beschreibung: 'Automatischer Test 16.09.' }) }))
  const p2 = await j(await fetch('/api/wuensche', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ titel: 'Testwunsch B (kann weg)', beschreibung: '' }) }))
  out.anlegen = [p1.status, p2.status]; const idA = p1.wunsch?.id || p1.id; const idB = p2.wunsch?.id || p2.id; out.ids = [!!idA, !!idB]
  const v1 = await j(await fetch(`/api/wuensche/${idA}/stimme`, { method: 'POST' })); out.stimmeA = v1.status
  const g1 = await j(await fetch('/api/wuensche')); out.budgetNachStimme = g1.budget; out.wunschA = (g1.wuensche || []).find(w => w.id === idA)
  const bad = await j(await fetch('/api/wuensche', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ titel: '', beschreibung: 'x' }) })); out.leererTitel = bad.status + ' ' + (bad.error || '').slice(0, 50)
  out.oeffentlich = await j(await fetch('/api/wuensche/oeffentlich'))
  return { ...out, idA, idB }
})
console.log('API:', JSON.stringify(api))
await page.evaluate(() => { const el = [...document.querySelectorAll('button, div, span, a')].find(e => e.children.length <= 2 && e.innerText && e.innerText.trim() === 'Wünsche'); el && el.click() }); await sleep(3500)
const ui = await page.evaluate(() => { const t = document.body.innerText; return { budgetZeile: (t.match(/Du hast \d+ von \d+ Stimmen vergeben/) || [''])[0], testwunsch: t.includes('Testwunsch A'), vonDir: t.includes('von dir'), status: t.includes('Offen') || t.includes('offen') } })
console.log('UI:', JSON.stringify(ui))
await page.screenshot({ path: '/tmp/cfshots/wuensche.png' })
await page.close(); browser.disconnect()
console.log('IDS ' + api.idA + ' ' + api.idB)
