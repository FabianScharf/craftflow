import puppeteer from 'puppeteer-core'
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] })
const p = await b.newPage()
await p.setViewport({ width: 1100, height: 900, deviceScaleFactor: 2 })
await p.goto('file://' + process.cwd() + '/.tmp-cu/fenster-entwurf.html', { waitUntil: 'load' })
await p.screenshot({ path: '.tmp-cu/fenster.png', fullPage: true })
await b.close()
console.log('fertig')
