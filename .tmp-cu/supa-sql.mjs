import puppeteer from 'puppeteer-core'
import { readFileSync } from 'node:fs'
// --file <pfad>: SQL aus Datei lesen (keine Shell-Expansion von $function$ o. ä.)
const sql = process.argv[2] === '--file' ? readFileSync(process.argv[3], 'utf8') : process.argv[2]
const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null, protocolTimeout: 120000 })
const sleep = ms => new Promise(r => setTimeout(r, ms))
const page = await browser.newPage()
await page.setViewport({ width: 1400, height: 1000 })
await page.goto('https://supabase.com/dashboard/project/fepfjvixfxksvduzwsgq/sql/new', { waitUntil: 'domcontentloaded', timeout: 90000 })
for (let i = 0; i < 40; i++) { await sleep(1000); if (await page.evaluate(() => !!(window.monaco && window.monaco.editor.getModels().length))) break }
await sleep(1500)
if (page.url().includes('sign-in')) { console.log('NICHT EINGELOGGT'); await page.close(); browser.disconnect(); process.exit(2) }
// Editor leeren und Inhalt setzen; danach gegenlesen (Vault: „Zwei Sitzungen, ein Browser“)
const gesetzt = await page.evaluate((sql) => {
  const m = window.monaco; if (!m) return 'kein monaco'
  const models = m.editor.getModels(); if (!models.length) return 'kein model'
  models[0].setValue(''); models[0].setValue(sql); return models[0].getValue()
}, sql)
if (gesetzt !== sql) { console.log('ABBRUCH — Editorinhalt weicht ab:', String(gesetzt).slice(0, 200)); await page.screenshot({ path: '/tmp/cfshots/supa-sql-fehler.png' }); await page.close(); browser.disconnect(); process.exit(1) }
// Ausführen: Editor fokussieren + Cmd+Enter; zusätzlich den Run-Knopf klicken (einer von beiden greift)
await page.click('.monaco-editor').catch(() => {})
await page.keyboard.down('Meta'); await page.keyboard.press('Enter'); await page.keyboard.up('Meta')
await sleep(800)
await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(b => /^Run\b/.test(b.innerText.trim())); b && !b.disabled && b.click() })
// Warnhinweis „destructive operation" (DROP/DELETE/ALTER): den Bestätigungsknopf drücken.
// Nur mit --confirm, damit ein Tippfehler nicht versehentlich bestätigt wird.
if (process.argv.includes('--confirm')) {
  for (let i = 0; i < 12; i++) {
    await sleep(700)
    const geklickt = await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(b => /^Run query$|Run this query|Confirm|Yes, run/i.test(b.innerText.trim())); if (b && !b.disabled) { b.click(); return b.innerText.trim() } return null })
    if (geklickt) { console.log('Bestätigt:', geklickt); break }
  }
}
let text = ''
for (let i = 0; i < 40; i++) { await sleep(1000); text = await page.evaluate(() => document.body.innerText); if (/Results|Success\. No rows|rows\(Limited|ERROR|error/i.test(text.slice(text.indexOf('Run')))) { await sleep(800); text = await page.evaluate(() => document.body.innerText); break } }
const i = text.indexOf('Results'); const j = text.indexOf('Rows')
console.log(text.slice(Math.max(0, Math.min(i >= 0 ? i : 1e9, j >= 0 ? j : 1e9) - 50), (i >= 0 ? i : j) + 2500).trim() || text.slice(0, 1500))
await page.screenshot({ path: '/tmp/cfshots/supa-sql.png' })
await page.close(); browser.disconnect()
