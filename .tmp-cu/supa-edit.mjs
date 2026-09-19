import puppeteer from 'puppeteer-core'
const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null, protocolTimeout: 120000 })
const sleep = ms => new Promise(r => setTimeout(r, ms))
const page = await browser.newPage()
await page.setViewport({ width: 1366, height: 1100 })
const setInput = (sel, v) => page.evaluate((sel, v) => { const inp = document.querySelector(sel); if (!inp) return false; const d = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value'); d.set.call(inp, v); inp.dispatchEvent(new Event('input', { bubbles: true })); inp.dispatchEvent(new Event('change', { bubbles: true })); return inp.value }, sel, v)
const clickText = (t) => page.evaluate((t) => { const el = [...document.querySelectorAll('button, a, [role=tab], div, span, h3')].find(e => e.children.length <= 2 && e.innerText && e.innerText.trim() === t); if (!el) return false; el.click(); return true }, t)

// 1) Betreff der Bestätigungsmail
await page.goto('https://supabase.com/dashboard/project/fepfjvixfxksvduzwsgq/auth/templates', { waitUntil: 'networkidle2', timeout: 90000 }); await sleep(5000)
console.log('Confirm sign up geöffnet:', await clickText('Confirm sign up')); await sleep(3000)
console.log('Betreff gesetzt:', await setInput('input[name="MAILER_SUBJECTS_CONFIRMATION"]', 'Bitte bestätige deine E-Mail-Adresse für CraftFlow')); await sleep(800)
console.log('Preview-Reiter:', await clickText('Preview')); await sleep(3000)
await page.screenshot({ path: '/tmp/cfshots/supa-confirm-preview.png', fullPage: true })
const iframeHtml = await page.evaluate(() => { const f = document.querySelector('iframe'); return f ? (f.srcdoc || f.src || '').slice(0, 200) : 'kein iframe' })
console.log('Preview-Frame:', iframeHtml.slice(0, 120))
const saveBtn = await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(b => b.innerText.trim() === 'Save changes'); return b ? { disabled: b.disabled } : null })
console.log('Save-Knopf:', JSON.stringify(saveBtn))
await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(b => b.innerText.trim() === 'Save changes' && !b.disabled); b && b.click() }); await sleep(4000)
let t = await page.evaluate(() => document.body.innerText); console.log('Hinweis nach Save:', (t.match(/(saved|updated|success|error|failed)[^\n]*/i) || ['-'])[0])
await page.reload({ waitUntil: 'networkidle2' }); await sleep(5000); await clickText('Confirm sign up'); await sleep(2500)
console.log('Betreff nach Reload:', await page.evaluate(() => document.querySelector('input[name="MAILER_SUBJECTS_CONFIRMATION"]')?.value))

// 2) Absendername in SMTP-Einstellungen
await page.goto('https://supabase.com/dashboard/project/fepfjvixfxksvduzwsgq/auth/smtp', { waitUntil: 'networkidle2', timeout: 90000 }); await sleep(5000)
const nameSel = await page.evaluate(() => { const inp = [...document.querySelectorAll('input')].find(i => i.value === 'Craftflow'); return inp ? '#' + CSS.escape(inp.id) : null })
console.log('Namensfeld:', nameSel)
if (nameSel) {
  console.log('Name gesetzt:', await setInput(nameSel, 'CraftFlow')); await sleep(800)
  await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(b => b.innerText.trim() === 'Save changes' && !b.disabled); b && b.click() }); await sleep(4000)
  t = await page.evaluate(() => document.body.innerText); console.log('Hinweis nach Save:', (t.match(/(saved|updated|success|error|failed)[^\n]*/i) || ['-'])[0])
  await page.reload({ waitUntil: 'networkidle2' }); await sleep(5000)
  console.log('Name nach Reload:', await page.evaluate(() => [...document.querySelectorAll('input')].map(i => i.value).filter(v => /craftflow/i.test(v))))
}
await page.close(); browser.disconnect()
