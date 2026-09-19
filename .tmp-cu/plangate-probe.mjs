import puppeteer from 'puppeteer-core'
const B = 'https://craftflow-git-dev-fabian-scharf-s-projects.vercel.app'
const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null })
const sleep = ms => new Promise(r => setTimeout(r, ms))
async function probe(name, vorher) {
  const page = await browser.newPage(); await page.setViewport({ width: 1280, height: 1000 })
  const auth = []; page.on('response', r => { if (/supabase\.co\/auth|\/api\/usage|betriebsprofil/.test(r.url())) auth.push(r.status() + ' ' + r.url().replace(/https:\/\/[^/]+/, '').slice(0, 50)) })
  if (vorher) { await page.goto(B + '/', { waitUntil: 'domcontentloaded', timeout: 90000 }); await sleep(4000) }
  await page.goto(B + '/settings?nc=' + Date.now(), { waitUntil: 'domcontentloaded', timeout: 90000 }); await sleep(5000)
  const t0 = Date.now()
  await page.evaluate(() => { const el = [...document.querySelectorAll('button.nav-item')].find(e => e.innerText.trim().endsWith('Textbausteine')); el && el.click() })
  let ms = null, txt = ''
  for (let i = 0; i < 60; i++) { await sleep(500); txt = await page.evaluate(() => document.body.innerText); if (!/Lädt\s*…/.test(txt) && /Textbaustein/.test(txt) && txt.length > 800) { ms = Date.now() - t0; break } }
  const laedtWo = (txt.match(/[^\n]{0,60}Lädt\s*…[^\n]{0,40}/g) || []).slice(0, 3)
  console.log(name, '=> geladen nach', ms ?? 'NICHT in 30 s', 'ms | Laedt steht bei:', JSON.stringify(laedtWo), '| Antworten:', auth.slice(0, 8).join(' ; '))
  await page.screenshot({ path: `/tmp/cfshots/plangate-${vorher ? 'B' : 'A'}.png` })
  await page.close()
}
await probe('A: direkt /settings', false)
await probe('B: erst /, dann /settings', true)
browser.disconnect()
