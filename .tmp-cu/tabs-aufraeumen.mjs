import puppeteer from 'puppeteer-core'
const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null })
const pages = await browser.pages()
let zu = 0
for (const p of pages) { const u = p.url(); if (u === 'about:blank' || (u.includes('supabase.com') && !u.includes('method=')) || u.includes('craftflow-git-dev')) { await p.close().catch(() => {}); zu++ } }
console.log('geschlossen:', zu, '| übrig:', (await browser.pages()).map(p => p.url().slice(0, 70)))
browser.disconnect()
