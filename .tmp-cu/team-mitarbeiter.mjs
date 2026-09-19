import puppeteer from 'puppeteer-core'
const sleep = ms => new Promise(r => setTimeout(r, ms))
const DEV = 'https://craftflow-git-dev-fabian-scharf-s-projects.vercel.app'
const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null })
const page = await browser.newPage(); await page.setViewport({ width: 1280, height: 1000 })
await page.goto(DEV + '/', { waitUntil: 'networkidle2', timeout: 90000 }); await sleep(3500)
const api = await page.evaluate(async () => {
  const j = async (u, o) => { const r = await fetch(u, { cache: 'no-store', ...o }); const t = await r.text(); let b; try { b = JSON.parse(t) } catch { b = t.slice(0, 60) } return { status: r.status, body: b } }
  const konto = await j('/api/konto'); const team = await j('/api/team'); const projekte = await j('/api/projects'); const profil = await j('/api/settings/betriebsprofil'); const usage = await j('/api/usage'); const kalib = await j('/api/settings/kalibrierung'); const ks = await j('/api/settings/kostenstellen')
  const checkout = await j('/api/stripe/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ priceId: 'price_1Tn1xzRvozvhvO9JJ3og0R3w' }) })
  const portal = await j('/api/stripe/portal', { method: 'POST' })
  const gutschein = await j('/api/gutschein', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: 'TEST' }) })
  const einladen = await j('/api/team/einladen', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'x@y.de' }) })
  const planPatch = await j('/api/settings/betriebsprofil', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ plan: 'solo' }) })
  return {
    konto: konto.body,
    team: { status: team.status, mitglieder: (team.body.mitglieder || []).map(m => m.email + ':' + m.status), plaetze: team.body.plaetze },
    projekte: { status: projekte.status, anzahl: Array.isArray(projekte.body) ? projekte.body.length : projekte.body },
    profilFirma: profil.body?.profil?.firma_name, usage: usage.body, kalibSchwerpunkt: kalib.body?.kalibrierung?.schwerpunkt, kostenstellen: Array.isArray(ks.body?.kostenstellen) ? ks.body.kostenstellen.length : ks.status,
    verboten: { checkout: checkout.status + ' ' + (checkout.body.error || ''), portal: portal.status + ' ' + (portal.body.error || ''), gutschein: gutschein.status + ' ' + (gutschein.body.error || ''), einladen: einladen.status + ' ' + (einladen.body.error || ''), planPatch: planPatch.status + ' ' + JSON.stringify(planPatch.body).slice(0, 80) },
  }
})
console.log(JSON.stringify(api, null, 1))
console.log('Kopf:', await page.evaluate(() => (document.querySelector('header') || document.body).innerText.slice(0, 160).replace(/\s+/g, ' ')))
await page.screenshot({ path: '.tmp-cu/ma-start.png' })
await page.goto(DEV + '/settings', { waitUntil: 'networkidle2', timeout: 90000 }); await sleep(3000)
const nav = await page.evaluate(() => [...document.querySelectorAll('button')].map(b => b.innerText.replace(/\s+/g, ' ').trim()).filter(t => /^(🏢|🧾|📝|🧩|📊|🎨|📄|🏗|⏱|📦|🧠|🏷|🏭|✉️|💬|👥|💳|💡|🛠)/.test(t)))
console.log('Nav:', JSON.stringify(nav))
for (const [name, datei] of [['Team', 'ma-team.png'], ['Mein Plan', 'ma-plan.png']]) {
  await page.evaluate(n => { const els = [...document.querySelectorAll('*')].filter(e => e.childElementCount === 0 && e.innerText?.trim() === n); if (els.length) (els[0].closest('button, a, .nav-item') || els[0]).click() }, name); await sleep(3000)
  const text = await page.evaluate(() => (document.querySelector('main') || document.body).innerText.slice(0, 700).replace(/\s+/g, ' '))
  console.log(name + ':', text)
  await page.screenshot({ path: '.tmp-cu/' + datei })
}
await page.close(); browser.disconnect()
