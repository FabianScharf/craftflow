import puppeteer from 'puppeteer-core'
const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null, protocolTimeout: 60000 })
const p = (await browser.pages()).find(p => p.url().includes('auth/url-configuration'))
if (p) { await p.close(); console.log('Supabase-Hilfstab geschlossen') }
browser.disconnect()
