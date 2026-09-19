import puppeteer from 'puppeteer-core'
const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null })
const page = (await browser.pages()).find(p => p.url().includes('craftflow-git-dev'))
if (!page) { console.log('KEIN APP-TAB'); process.exit(1) }
const base = 'https://craftflow-git-dev-fabian-scharf-s-projects.vercel.app'
await page.setViewport({ width: 1280, height: 860, deviceScaleFactor: 2 })
const shots = [
  ['start', '/'],
  ['settings-firma', '/settings'],
]
for (const [name, path] of shots) {
  await page.goto(base + path, { waitUntil: 'networkidle2', timeout: 60000 })
  await new Promise(r => setTimeout(r, 2500))
  console.log(name, '→', page.url(), '|', (await page.evaluate(() => document.body.innerText.slice(0, 200))).replace(/\n/g, ' ⏎ '))
  await page.screenshot({ path: `/tmp/cfshots/${name}.png` })
}
// Settings-Sektionen anklicken
for (const label of ['Kostenstellen', 'Warenaufschläge', 'Mein Betrieb', 'Meine Bauweise', 'Textbausteine', 'Briefpapier', 'Hilfe']) {
  const ok = await page.evaluate((label) => {
    const el = [...document.querySelectorAll('button, a, div')].find(e => e.children.length <= 2 && e.innerText && e.innerText.trim().endsWith(label))
    if (!el) return false; el.click(); return true
  }, label)
  await new Promise(r => setTimeout(r, 2000))
  console.log('settings:', label, ok ? 'ok' : 'NICHT GEFUNDEN', '|', (await page.evaluate(() => document.body.innerText.slice(0, 160))).replace(/\n/g, ' ⏎ '))
  await page.screenshot({ path: `/tmp/cfshots/settings-${label.replace(/[^a-z]/gi, '').toLowerCase()}.png` })
}
browser.disconnect()
