import puppeteer from 'puppeteer-core'
const sleep = ms => new Promise(r => setTimeout(r, ms))
const DEV = 'https://craftflow-git-dev-fabian-scharf-s-projects.vercel.app'
const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null })
const page = await browser.newPage(); await page.setViewport({ width: 1280, height: 1000 })
await page.goto(DEV + '/settings', { waitUntil: 'networkidle2', timeout: 90000 }); await sleep(2500)
const api = await page.evaluate(async () => {
  const j = async (u, o) => { const r = await fetch(u, { cache: 'no-store', ...o }); return { status: r.status, body: await r.json().catch(() => ({})) } }
  const konto = await j('/api/konto')
  const team = await j('/api/team')
  const schon = (team.body.mitglieder || []).some(m => m.email === 'fabianscharf@icloud.com')
  const einladen = schon ? { status: 'übersprungen (schon eingeladen)' } : await j('/api/team/einladen', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'fabianscharf@icloud.com' }) })
  const danach = await j('/api/team')
  return { konto: konto.body, teamVorher: team.body, einladen, teamDanach: danach.body }
})
console.log(JSON.stringify(api, null, 1))
await page.evaluate(() => { const els = [...document.querySelectorAll('*')].filter(e => e.childElementCount === 0 && e.innerText?.trim() === 'Team'); if (els.length) (els[0].closest('button, a, .nav-item') || els[0]).click() }); await sleep(3500)
await page.screenshot({ path: '.tmp-cu/team-inhaber.png' })
await page.close(); browser.disconnect()
