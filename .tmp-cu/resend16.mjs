import puppeteer from 'puppeteer-core'
const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null, protocolTimeout: 60000 })
const page = (await browser.pages()).find(p => p.url().includes('resend.com'))
const sleep = ms => new Promise(r => setTimeout(r, ms))
const text = () => page.evaluate(() => document.body.innerText)
for (const [id, dom] of [['8a69b644-c5e6-4cef-ba11-5c18674fa6a9', 'getcraftflow.de'], ['81a6ebbc-720c-48d8-97ab-2725c51bb765', 'fscrafted.de']]) {
  await page.goto(`https://resend.com/domains/${id}`, { waitUntil: 'networkidle2' }); await sleep(3500)
  if (!(await text()).includes(dom)) { console.log(dom, 'nicht mehr vorhanden'); continue }
  await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(b => /more actions|more options/i.test(b.getAttribute('aria-label') || b.innerText)); b && b.click() }); await sleep(1000)
  const del = await page.evaluate(() => { const e = [...document.querySelectorAll('[role="menuitem"], button, div')].find(e => e.children.length <= 2 && /^Delete domain$/.test(e.innerText.trim())); if (!e) return false; e.click(); return true })
  console.log(dom, 'Delete-Menü:', del); await sleep(1200)
  const hasDialog = await page.evaluate(() => !!document.querySelector('[role="dialog"], [role="alertdialog"]'))
  if (!hasDialog) { console.log('  kein Dialog'); continue }
  await page.evaluate(() => { const inp = document.querySelector('[role="dialog"] input, [role="alertdialog"] input'); inp && inp.focus() })
  await page.keyboard.type(dom, { delay: 30 }); await sleep(500)
  const st = await page.evaluate(() => { const b = [...document.querySelectorAll('[role="dialog"] button, [role="alertdialog"] button')].find(b => /^Delete domain/i.test(b.innerText.trim())); return b ? { disabled: b.disabled } : null })
  console.log('  Bestätigen-Knopf:', JSON.stringify(st))
  await page.keyboard.press('Enter'); await sleep(3000)
  console.log('  URL danach:', page.url())
}
await page.goto('https://resend.com/domains', { waitUntil: 'networkidle2' }); await sleep(3500)
const t = await text(); const i = t.indexOf('All statuses'); console.log('--- LISTE DANACH ---\n' + t.slice(i, i + 300).replace(/\n+/g, ' | '))
browser.disconnect()
