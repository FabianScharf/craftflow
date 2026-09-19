import puppeteer from 'puppeteer-core'
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
// Eng zugeschnitten: Stripe skaliert das Logo auf eine feste Höhe — jeder Leerrand
// oben und unten macht den Schriftzug kleiner.
const html = `<html><body style="margin:0;background:#fff">
<span id="marke" style="display:inline-block;background:#0D0D0D;padding:34px 48px;border-radius:14px;
  font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:104px;font-weight:600;
  letter-spacing:-2px;line-height:1;color:#F0EDE8;white-space:nowrap;">Craft<span style="color:#C8885A;">Flow</span></span>
</body></html>`
const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] })
const p = await b.newPage()
await p.setViewport({ width: 1200, height: 400, deviceScaleFactor: 2 })
await p.setContent(html, { waitUntil: 'load' })
const el = await p.$('#marke')
await el.screenshot({ path: '.tmp-cu/craftflow-wortmarke.png' })
await b.close()
console.log('fertig')
