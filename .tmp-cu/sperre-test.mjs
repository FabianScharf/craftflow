// Live-Test der Sperre am Testkonto (kein KI-Aufruf: alle Aufrufe werden VOR der KI abgelehnt oder sind reine Lesezugriffe)
import puppeteer from 'puppeteer-core'
const SQL = (q) => import('node:child_process').then(({ execFileSync }) => execFileSync('node', ['.tmp-cu/supa-sql.mjs', q], { encoding: 'utf8' }))
const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null, protocolTimeout: 120000 })
const sleep = ms => new Promise(r => setTimeout(r, ms))
const B = 'https://craftflow-git-dev-fabian-scharf-s-projects.vercel.app'
const page = await browser.newPage(); await page.setViewport({ width: 1280, height: 900 })
const probe = async (label, erwarteGesperrt) => {
  await page.goto(B + '/', { waitUntil: 'networkidle2', timeout: 90000 }); await sleep(2500)
  const r = await page.evaluate(async (erwarteGesperrt) => {
    const paywall = document.body.innerText.includes('Testphase') && !!document.body.innerText.match(/Solo[\s\S]*Starter[\s\S]*Pro/)
    const gutschein = document.body.innerText.includes('Gutschein ist abgelaufen')
    const usageGet = await fetch('/api/usage'); const ug = await usageGet.json().catch(() => ({}))
    // Nur im erwartet-gesperrten Zustand die teuren Routen anstoßen — sonst würde die KI wirklich laufen.
    if (!erwarteGesperrt) return { paywallSichtbar: paywall, gutscheinText: gutschein, usageGet: { status: usageGet.status, plan: ug.plan, limit: ug.limit } }
    const analyze = await fetch('/api/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: 'Sperrtest — darf nie die KI erreichen' }) })
    const aj = await analyze.json().catch(() => ({}))
    const usagePost = await fetch('/api/usage', { method: 'POST' }); const up = await usagePost.json().catch(() => ({}))
    const pdf = await fetch('/api/generate-pdf', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ html: '<p>x</p>' }) })
    return { paywallSichtbar: paywall, gutscheinText: gutschein, usageGet: { status: usageGet.status, plan: ug.plan, limit: ug.limit }, analyze: { status: analyze.status, error: aj.error, minPlan: aj.minPlan }, usagePost: { status: usagePost.status, error: up.error }, pdf: pdf.status }
  }, erwarteGesperrt)
  await page.screenshot({ path: `/tmp/cfshots/sperre-${label}.png` })
  console.log(label + ':', JSON.stringify(r))
  await page.goto(B + '/settings', { waitUntil: 'networkidle2', timeout: 90000 }); await sleep(4000)
  console.log(label + ' /settings Bereiche:', await page.evaluate(() => [...document.querySelectorAll('button, div, a')].map(e => e.innerText?.trim()).filter(t => ['Firmendaten','Kostenstellen','Mein Plan','Meine Bauweise'].includes(t)).filter((v, i, a) => a.indexOf(v) === i).join(', ')))
}
const konto = "user_id = (select id from auth.users where email = 'test@fscrafted.de')"
console.log('--- 2) Testphase abgelaufen, kein Abo, plan solo → muss gesperrt sein'); await SQL(`update betriebsprofil set trial_starts_at = now() - interval '30 days', abo_status = null, plan = 'solo', plan_gueltig_bis = null where ${konto};`); await sleep(1500); await probe('gesperrt', true)
console.log('--- 3) Gutschein-Plan abgelaufen (plan enterprise, gültig bis gestern) → gesperrt mit Gutschein-Text'); await SQL(`update betriebsprofil set plan = 'enterprise', plan_gueltig_bis = now() - interval '1 day' where ${konto};`); await sleep(1500); await probe('gutschein-abgelaufen', true)
console.log('--- 4) Abo aktiv, plan pro (trotz altem Gutscheindatum) → offen, Limit 50'); await SQL(`update betriebsprofil set plan = 'pro', abo_status = 'aktiv' where ${konto};`); await sleep(1500); await probe('abo-pro', false)
console.log('--- 5) Abo beendet → wieder gesperrt'); await SQL(`update betriebsprofil set abo_status = 'beendet' where ${konto};`); await sleep(1500); await probe('abo-beendet', true)
console.log('--- 6) Zurücksetzen auf den echten Stand'); await SQL(`update betriebsprofil set trial_starts_at = '2026-09-05', abo_status = null, plan = 'solo', plan_gueltig_bis = null where ${konto};`); await sleep(1500)
console.log('Ende:', await SQL(`select plan, trial_starts_at::date, abo_status, plan_gueltig_bis from betriebsprofil where ${konto};`).then(t => t.split('Export')[1]?.replace(/\s+/g, ' ').slice(0, 120)))
await page.close(); browser.disconnect()
