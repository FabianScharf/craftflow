import puppeteer from 'puppeteer-core'
const [label, erwarteGesperrt] = [process.argv[2], process.argv[3] === 'true']
const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null, protocolTimeout: 120000 })
const sleep = ms => new Promise(r => setTimeout(r, ms))
const B = 'https://craftflow-git-dev-fabian-scharf-s-projects.vercel.app'
const page = await browser.newPage(); await page.setViewport({ width: 1280, height: 900 })
await page.goto(B + '/', { waitUntil: 'domcontentloaded', timeout: 90000 }); await sleep(5000)
const r = await page.evaluate(async (erwarteGesperrt) => {
  const t = document.body.innerText
  const paywall = /Testphase/.test(t) && /Solo[\s\S]*Starter[\s\S]*Pro/.test(t) && !document.querySelector('textarea')
  const gutschein = t.includes('Gutschein ist abgelaufen')
  const usageGet = await fetch('/api/usage'); const ug = await usageGet.json().catch(() => ({}))
  if (!erwarteGesperrt) return { paywallSichtbar: paywall, usageGet: { status: usageGet.status, plan: ug.plan, limit: ug.limit } }
  const analyze = await fetch('/api/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: 'Sperrtest — darf nie die KI erreichen' }) })
  const aj = await analyze.json().catch(() => ({}))
  const usagePost = await fetch('/api/usage', { method: 'POST' }); const up = await usagePost.json().catch(() => ({}))
  const pdf = await fetch('/api/generate-pdf', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ html: '<p>x</p>' }) })
  const optimize = await fetch('/api/optimize', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ offerData: {}, chatHistory: [], message: 'x' }) })
  return { paywallSichtbar: paywall, gutscheinText: gutschein, usageGet: { status: usageGet.status, plan: ug.plan }, analyze: { status: analyze.status, error: aj.error, minPlan: aj.minPlan }, usagePost: usagePost.status + ' ' + (up.error || ''), pdf: pdf.status, optimize: optimize.status }
}, erwarteGesperrt)
await page.screenshot({ path: `/tmp/cfshots/sperre-${label}.png` })
await page.goto(B + '/settings', { waitUntil: 'domcontentloaded', timeout: 90000 }); await sleep(5000)
const bereiche = await page.evaluate(() => [...new Set([...document.querySelectorAll('button, div, a, span')].map(e => e.innerText?.trim()).filter(t => ['Firmendaten','Kostenstellen','Mein Plan','Meine Bauweise','Auswertung'].includes(t)))].join(', '))
console.log(label + ':', JSON.stringify(r), '| /settings zeigt:', bereiche || '(nichts erkannt)')
await page.close(); browser.disconnect()
