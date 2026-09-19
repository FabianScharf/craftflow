import puppeteer from 'puppeteer-core'
import fs from 'fs'
const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null, protocolTimeout: 120000 })
const sleep = ms => new Promise(r => setTimeout(r, ms))
const page = await browser.newPage()
await page.setViewport({ width: 1000, height: 1100 })
await page.goto('https://supabase.com/dashboard/project/fepfjvixfxksvduzwsgq/auth/templates', { waitUntil: 'networkidle2', timeout: 90000 }); await sleep(5000)
await page.evaluate(() => { const el = [...document.querySelectorAll('button, a, div, h3, span')].find(e => e.children.length <= 2 && e.innerText && e.innerText.trim() === 'Confirm sign up'); el && el.click() }); await sleep(3000)
await page.evaluate(() => { const el = [...document.querySelectorAll('button, [role=tab]')].find(e => e.innerText && e.innerText.trim() === 'Preview'); el && el.click() }); await sleep(3000)
const srcdoc = await page.evaluate(() => document.querySelector('iframe')?.srcdoc || '')
console.log('Vorschau-HTML Länge:', srcdoc.length)
fs.writeFileSync(process.env.HOME + '/Desktop/CraftFlow-Bestaetigungsmail-Vorschau.html', srcdoc)
// Nur den Mail-Rahmen rendern und screenshotten
const p2 = await browser.newPage(); await p2.setViewport({ width: 720, height: 900, deviceScaleFactor: 2 })
await p2.setContent(srcdoc, { waitUntil: 'load' }); await sleep(800)
await p2.screenshot({ path: process.env.HOME + '/Desktop/CraftFlow-Bestaetigungsmail-Vorschau.png', fullPage: true })
await p2.screenshot({ path: '/tmp/cfshots/supa-confirm-preview.png', fullPage: true })
const txt = await p2.evaluate(() => document.body.innerText); console.log('--- INHALT ---\n' + txt.slice(0, 900))
await p2.close(); await page.close(); browser.disconnect()
