import puppeteer from 'puppeteer-core'
const b = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null })
const seiten = await b.pages()
for (const p of seiten) { const u = p.url(); if (/blob:|\.pdf|pdf/i.test(u)) console.log('PDF-TAB:', u.slice(0, 120)) }
const app = seiten.find(p => p.url().includes('vercel.app'))
await app.bringToFront()
const knopf = await app.evaluate(() => { const k = [...document.querySelectorAll('button')].find(e => /PDF/i.test(e.textContent)); return k ? k.textContent.trim() : 'kein Knopf' })
console.log('Knopf:', knopf)
await app.screenshot({ path: '.tmp-cu/pdf-ansicht.png' })
await b.disconnect()
