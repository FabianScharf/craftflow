import puppeteer from 'puppeteer-core'
const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null, protocolTimeout: 120000 })
const sleep = ms => new Promise(r => setTimeout(r, ms))
const page = await browser.newPage()
await page.setViewport({ width: 1400, height: 1000 })
await page.goto('https://supabase.com/dashboard/project/fepfjvixfxksvduzwsgq/sql/new', { waitUntil: 'networkidle2', timeout: 90000 })
await sleep(6000)
const sql = `select firma_name, website, farbe_primaer, farbe_akzent, updated_at::date as geaendert from betriebsprofil where farbe_akzent is not null or farbe_primaer is not null order by updated_at desc limit 40;`
// Editor leeren und Inhalt setzen (Monaco-API, keine Tastatur)
const gesetzt = await page.evaluate((sql) => {
  const m = window.monaco
  if (!m) return 'kein monaco'
  const models = m.editor.getModels()
  if (!models.length) return 'kein model'
  models[0].setValue('')
  models[0].setValue(sql)
  return models[0].getValue()
}, sql)
console.log('Editorinhalt:', gesetzt)
if (gesetzt !== sql) { console.log('ABBRUCH: Editorinhalt stimmt nicht'); await page.screenshot({ path: '/tmp/cfshots/farben-db-fehler.png' }); await page.close(); browser.disconnect(); process.exit(1) }
const geklickt = await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(b => /^Run/i.test(b.innerText.trim())); if (!b) return false; b.click(); return true })
console.log('Run geklickt:', geklickt)
await sleep(6000)
const text = await page.evaluate(() => document.body.innerText)
const i = text.indexOf('firma_name')
console.log(i >= 0 ? text.slice(i, i + 3000) : 'Keine Ergebnistabelle gefunden. Ausschnitt:\n' + text.slice(0, 1500))
await page.screenshot({ path: '/tmp/cfshots/farben-db.png', fullPage: false })
await page.close(); browser.disconnect()
