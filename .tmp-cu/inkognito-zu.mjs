import puppeteer from 'puppeteer-core'
const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null })
for (const c of browser.browserContexts()) { if (c !== browser.defaultBrowserContext()) { for (const p of await c.pages()) await p.close(); await c.close().catch(() => {}) } }
console.log('Inkognito geschlossen'); browser.disconnect()
