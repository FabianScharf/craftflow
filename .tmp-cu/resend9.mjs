import puppeteer from 'puppeteer-core'
const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null, protocolTimeout: 60000 })
const page = (await browser.pages()).find(p => p.url().includes('resend.com'))
const vals = await page.evaluate(() => {
  const out = new Set()
  for (const e of document.querySelectorAll('*')) {
    for (const a of ['title', 'data-value', 'value', 'aria-label', 'data-clipboard-text']) {
      const v = e.getAttribute && e.getAttribute(a); if (v && /MIGf|amazonses|amazonaws|spf1/.test(v)) out.add(a + ': ' + v)
    }
    if (e.children.length === 0 && e.textContent && /MIGf|amazonses|amazonaws|spf1/.test(e.textContent) && !e.textContent.includes('[…]')) out.add('text: ' + e.textContent.trim())
  }
  return [...out]
})
console.log(vals.join('\n'))
console.log('--- HTML-Ausschnitt ---')
const html = await page.evaluate(() => { const td = [...document.querySelectorAll('td')].find(td => td.innerText.includes('MIGf')); return td ? td.innerHTML.slice(0, 1500) : 'kein td' })
console.log(html)
browser.disconnect()
