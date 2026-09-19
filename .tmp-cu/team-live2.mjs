import puppeteer from 'puppeteer-core'
const sleep = ms => new Promise(r => setTimeout(r, ms))
const DEV = 'https://craftflow-git-dev-fabian-scharf-s-projects.vercel.app'
const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null })
const page = await browser.newPage(); await page.setViewport({ width: 1280, height: 1000 })
await page.goto(DEV + '/', { waitUntil: 'networkidle2', timeout: 90000 }); await sleep(3000)
const api = await page.evaluate(async () => {
  const j = async (u, o) => { const r = await fetch(u, { cache: 'no-store', ...o }); const t = await r.text(); let b; try { b = JSON.parse(t) } catch { b = t.slice(0, 80) } return { status: r.status, body: b } }
  const konto = await j('/api/konto'); const team = await j('/api/team'); const projekte = await j('/api/projects'); const profil = await j('/api/settings/betriebsprofil')
  const checkout = await j('/api/stripe/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ plan: 'pro' }) })
  const einladen = await j('/api/team/einladen', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'x@y.de' }) })
  return { konto: konto.body, team: { status: team.status, mitglieder: (team.body.mitglieder || []).map(m => m.email + ':' + m.status) }, projekte: { status: projekte.status, anzahl: Array.isArray(projekte.body) ? projekte.body.length : projekte.body, erstes: Array.isArray(projekte.body) ? projekte.body[0]?.title : null }, profilFirma: profil.body?.profil?.firma_name, checkoutAlsMitarbeiter: checkout, einladenAlsMitarbeiter: einladen }
})
console.log(JSON.stringify(api, null, 1))
const kopf = await page.evaluate(() => document.body.innerText.slice(0, 200).replace(/\s+/g, ' '))
console.log('Kopf:', kopf)
await page.screenshot({ path: '.tmp-cu/team-mitarbeiter-start.png' })
await page.goto(DEV + '/settings', { waitUntil: 'networkidle2', timeout: 90000 }); await sleep(2500)
await page.evaluate(() => { const els = [...document.querySelectorAll('*')].filter(e => e.childElementCount === 0 && e.innerText?.trim() === 'Team'); if (els.length) (els[0].closest('button, a, .nav-item') || els[0]).click() }); await sleep(3000)
await page.screenshot({ path: '.tmp-cu/team-mitarbeiter-team.png' })
await page.evaluate(() => { const els = [...document.querySelectorAll('*')].filter(e => e.childElementCount === 0 && e.innerText?.trim() === 'Mein Plan'); if (els.length) (els[0].closest('button, a, .nav-item') || els[0]).click() }); await sleep(2500)
await page.screenshot({ path: '.tmp-cu/team-mitarbeiter-plan.png' })
await page.close(); browser.disconnect()
