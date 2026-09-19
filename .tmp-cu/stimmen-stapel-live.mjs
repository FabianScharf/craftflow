// Live-Test Stimmenkonto: zweimal auf denselben Wunsch stimmen, einmal zurück; Budgetzeile; UI-Screenshot; Löschen-Dialog-Screenshot.
import puppeteer from 'puppeteer-core'
const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null, protocolTimeout: 180000 })
const sleep = ms => new Promise(r => setTimeout(r, ms))
const B = 'https://craftflow-git-dev-fabian-scharf-s-projects.vercel.app'
const page = await browser.newPage(); await page.setViewport({ width: 1280, height: 1000 })
await page.goto(B + '/', { waitUntil: 'domcontentloaded', timeout: 90000 }); await sleep(3000)
const api = await page.evaluate(async () => {
  const lade = async () => { const r = await fetch('/api/wuensche', { cache: 'no-store' }); return r.json() }
  const out = {}
  let j = await lade(); const w = (j.wuensche || []).find(x => /Online Shops/.test(x.titel)); if (!w) return { fehler: 'Wunsch nicht gefunden', j }
  out.vorher = { stimmen: w.stimmen, eigene: w.eigeneStimmen, budget: j.budget }
  const p1 = await fetch(`/api/wuensche/${w.id}/stimme`, { method: 'POST' }); out.post1 = { status: p1.status, ...(await p1.json().catch(() => ({}))) }
  const p2 = await fetch(`/api/wuensche/${w.id}/stimme`, { method: 'POST' }); out.post2 = { status: p2.status, ...(await p2.json().catch(() => ({}))) }
  j = await lade(); out.nachPost = { budget: j.budget, eigene: (j.wuensche.find(x => x.id === w.id) || {}).eigeneStimmen }
  const d = await fetch(`/api/wuensche/${w.id}/stimme`, { method: 'DELETE' }); out.delete1 = { status: d.status, ...(await d.json().catch(() => ({}))) }
  const d2 = await fetch(`/api/wuensche/${w.id}/stimme`, { method: 'DELETE' }); out.delete2 = { status: d2.status, ...(await d2.json().catch(() => ({}))) }
  j = await lade(); out.nachDelete = { budget: j.budget, eigene: (j.wuensche.find(x => x.id === w.id) || {}).eigeneStimmen, stimmen: (j.wuensche.find(x => x.id === w.id) || {}).stimmen }
  return out
})
// UI-Screenshot Wünsche
await page.goto(B + '/settings', { waitUntil: 'domcontentloaded', timeout: 90000 }); await sleep(4000)
await page.evaluate(() => { const el = [...document.querySelectorAll('button, div, span, a')].find(e => e.children.length <= 2 && e.innerText && e.innerText.trim() === 'Wünsche'); el && el.click() }); await sleep(3000)
const ui = await page.evaluate(() => { const t = document.body.innerText; return { budgetzeile: (t.match(/Du hast \d+ von \d+ Stimmen[^\n]*/) || [null])[0], erklaerung: t.includes('alle Stimmen auf ein Thema'), deine: (t.match(/deine \d+/) || [null])[0], pfeile: [...document.querySelectorAll('button')].filter(b => /▲|▼/.test(b.innerText)).length } })
await page.screenshot({ path: '/tmp/cfshots/stimmen-ui.png' })
// Löschen-Dialog
await page.goto(B + '/', { waitUntil: 'domcontentloaded', timeout: 90000 }); await sleep(4000)
await page.evaluate(() => { const el = [...document.querySelectorAll('button, div, a')].find(e => e.children.length <= 2 && /^Projekte$|MEINE PROJEKTE|📋/.test((e.innerText || '').trim())); el && el.click() }); await sleep(2500)
const dialog = await page.evaluate(() => { const x = [...document.querySelectorAll('button')].find(b => b.innerText.trim() === '×' || b.innerText.trim() === '✕'); if (!x) return 'kein ×-Knopf'; x.click(); return 'geklickt' }); await sleep(1500)
const btn = await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(b => /löschen/i.test(b.innerText) && getComputedStyle(b).backgroundColor !== 'rgba(0, 0, 0, 0)'); if (!b) return null; const cs = getComputedStyle(b); return { text: b.innerText.trim(), bg: cs.backgroundColor, fg: cs.color } })
await page.screenshot({ path: '/tmp/cfshots/loeschen-dialog.png' })
await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(b => b.innerText.trim() === 'Abbrechen'); b && b.click() })
console.log(JSON.stringify({ api, ui, dialog, btn }, null, 1))
await page.close(); browser.disconnect()
