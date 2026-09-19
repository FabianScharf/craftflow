import puppeteer from 'puppeteer-core'
const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null, protocolTimeout: 60000 })
const page = (await browser.pages()).find(p => p.url().includes('resend.com'))
const sleep = ms => new Promise(r => setTimeout(r, ms))
const text = () => page.evaluate(() => document.body.innerText)
for (const id of ['81a6ebbc-720c-48d8-97ab-2725c51bb765', '8a69b644-c5e6-4cef-ba11-5c18674fa6a9']) {
  await page.goto(`https://resend.com/domains/${id}`, { waitUntil: 'networkidle2' }); await sleep(3500)
  // Menü/Einstellungen suchen
  const cand = await page.evaluate(() => [...document.querySelectorAll('button, a')].map(b => (b.innerText || b.getAttribute('aria-label') || '').trim()).filter(x => /delete|remove|settings|more|options|⋯|…|menu/i.test(x)))
  console.log(id.slice(0, 8), 'Kandidaten:', JSON.stringify(cand))
  // Versuch: Button mit aria-label "More"/"Options" oder Text "Settings"
  const opened = await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(b => /more|options|actions/i.test(b.getAttribute('aria-label') || '') || /^Settings$/.test(b.innerText.trim())); if (!b) return false; b.click(); return true })
  await sleep(1200)
  const items = await page.evaluate(() => [...document.querySelectorAll('[role="menuitem"], [role="dialog"] button, button')].map(e => e.innerText.trim()).filter(x => /delete|remove|löschen/i.test(x)))
  console.log('  geöffnet:', opened, '| Lösch-Elemente:', JSON.stringify(items))
  if (items.length) {
    await page.evaluate(() => { const e = [...document.querySelectorAll('[role="menuitem"], button')].find(e => /^(Delete|Remove)( domain)?$/i.test(e.innerText.trim())); e && e.click() }); await sleep(1500)
    const dlg = await text(); const j = dlg.indexOf('Delete'); console.log('  Dialog:', dlg.slice(j, j + 300).replace(/\n/g, ' | '))
    // Bestätigungsfeld?
    const confirmed = await page.evaluate((dom) => { const inp = document.querySelector('[role="dialog"] input'); if (inp) { const d = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value'); d.set.call(inp, dom); inp.dispatchEvent(new Event('input', { bubbles: true })) } const b = [...document.querySelectorAll('[role="dialog"] button')].find(b => /^Delete/i.test(b.innerText.trim())); if (!b) return 'kein Bestätigen-Knopf'; b.click(); return 'bestätigt' + (inp ? ' (mit Domainname)' : '') }, id === '81a6ebbc-720c-48d8-97ab-2725c51bb765' ? 'fscrafted.de' : 'getcraftflow.de')
    console.log('  ', confirmed); await sleep(3000)
  }
}
await page.goto('https://resend.com/domains', { waitUntil: 'networkidle2' }); await sleep(3500)
const t = await text(); const i = t.indexOf('All statuses'); console.log('--- LISTE DANACH ---\n' + t.slice(i, i + 400))
browser.disconnect()
