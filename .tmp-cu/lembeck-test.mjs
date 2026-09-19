import puppeteer from 'puppeteer-core'
const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null })
const sleep = ms => new Promise(r => setTimeout(r, ms))
const page = await browser.newPage()
await page.setViewport({ width: 1280, height: 900 })
await page.goto('https://craftflow-git-dev-fabian-scharf-s-projects.vercel.app/settings', { waitUntil: 'networkidle2', timeout: 90000 }); await sleep(2500)
await page.evaluate(() => { const el = [...document.querySelectorAll('button, div, span, a')].find(e => e.children.length <= 2 && e.innerText && e.innerText.trim() === 'Marketing & CI'); el && el.click() }); await sleep(1000)
const tippe = async (idx, text) => { const f = (await page.$$('input[maxlength="7"]'))[idx]; await f.focus(); await page.evaluate(el => el.select(), f); await page.keyboard.type(text, { delay: 20 }); await page.keyboard.press('Tab'); await sleep(300) }
for (const rot of ['#813732', '#911517']) {
  await tippe(1, rot)
  const mess = await page.evaluate(() => {
    const name = [...document.querySelectorAll('span')].find(s => s.innerText === 'FIRMENNAME')
    const btn = [...document.querySelectorAll('div')].find(d => d.innerText === 'Speichern' && d.children.length === 0)
    const speichern = [...document.querySelectorAll('button')].find(b => b.innerText.trim() === 'Speichern')
    return { feld: document.querySelectorAll('input[maxlength="7"]')[1].value, picker: document.querySelectorAll('input[type="color"]')[1].value,
      vorschauText: name && getComputedStyle(name).color, vorschauButton: btn && getComputedStyle(btn).backgroundColor, echterButton: speichern && getComputedStyle(speichern).backgroundColor }
  })
  console.log(rot, '→', JSON.stringify(mess))
  await page.screenshot({ path: `/tmp/cfshots/lembeck-${rot.slice(1)}-dunkel.png`, clip: { x: 380, y: 160, width: 700, height: 400 } })
}
// Helle Palette wie Lembeck (weiss + #813732), nur im Browser
await tippe(1, '#813732')
await page.evaluate((p) => { const r = document.documentElement; const V = { primary: '--c-primary', accent: '--c-accent', text: '--c-text', textMid: '--c-text-mid', surface1: '--c-surface1', surface2: '--c-surface2', border: '--c-border', darkbg: '--c-darkbg' }; for (const k in V) r.style.setProperty(V[k], p[k]) }, JSON.parse(process.argv[2]))
await sleep(400)
await page.screenshot({ path: '/tmp/cfshots/lembeck-hell.png' })
// Zuruecksetzen des Formulars auf den echten Wert, nichts speichern
await tippe(1, '#C8885A')
await page.close(); browser.disconnect()
