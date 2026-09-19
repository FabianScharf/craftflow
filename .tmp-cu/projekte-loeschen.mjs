import puppeteer from 'puppeteer-core'
const ids = process.argv.slice(2)
const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null })
const page = await browser.newPage()
await page.goto('https://craftflow-git-dev-fabian-scharf-s-projects.vercel.app/', { waitUntil: 'domcontentloaded', timeout: 90000 }); await new Promise(r => setTimeout(r, 3000))
console.log('Projekte gelöscht:', JSON.stringify(await page.evaluate(async (ids) => { const out = []; for (const id of ids) out.push((await fetch('/api/projects/' + id, { method: 'DELETE' })).status); return out }, ids)))
await page.close(); browser.disconnect()
