import puppeteer from 'puppeteer-core'
const DEV = 'https://craftflow-git-dev-fabian-scharf-s-projects.vercel.app'
const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null })
const page = await browser.newPage()
await page.goto(DEV + '/settings', { waitUntil: 'networkidle2', timeout: 90000 })
console.log(JSON.stringify(await page.evaluate(async () => {
  const del = await fetch('/api/team/12f8cdab-8a5a-4e80-9906-890e7d61c2e4', { method: 'DELETE' })
  const team = await (await fetch('/api/team', { cache: 'no-store' })).json()
  return { loeschen: del.status, mitglieder: team.mitglieder.map(m => m.email + ':' + m.status) }
})))
await page.close(); browser.disconnect()
