// Prüft: Kasten wechselt beim Abwählen von "Küchen" ohne Speichern; Schwerpunkt wird NICHT gespeichert.
import puppeteer from 'puppeteer-core'
const sleep = ms => new Promise(r => setTimeout(r, ms))
const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null })
const page = await browser.newPage(); await page.setViewport({ width: 1280, height: 1000 })
await page.goto('https://craftflow-git-dev-fabian-scharf-s-projects.vercel.app/settings', { waitUntil: 'networkidle2', timeout: 90000 }); await sleep(3000)
await page.evaluate(() => { const els = [...document.querySelectorAll('*')].filter(e => e.childElementCount === 0 && e.innerText?.trim() === 'Mein Betrieb'); if (els.length) (els[0].closest('button, a, .nav-item') || els[0]).click() }); await sleep(4000)
const kopf = () => page.evaluate(() => (document.body.innerText.match(/Das Referenzprojekt: [^\n]+/) || [''])[0])
console.log('vorher:', await kopf())
const klick = txt => page.evaluate(t => { const b = [...document.querySelectorAll('button')].find(b => b.innerText.trim().startsWith(t)); if (b) b.click(); return !!b }, txt)
console.log('Küchen abgewählt:', await klick('Küchen')); await sleep(3500); console.log('nach Abwahl:', await kopf())
// Anker gegen Spannen: gehoeren beide zum selben Moebel, liegt der Anker im mittleren Band
await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(b => /So rechnet CraftFlow/.test(b.innerText)); b && b.click() }); await sleep(1500)
const t = await page.evaluate(() => document.body.innerText)
const z = t.split('\n'); const out = []
z.forEach((l, i) => { if (/CraftFlow rechnet/.test(l)) out.push({ anker: l, frage: z[i + 1], baender: z.slice(i + 2, i + 8).filter(x => /€|Stunden|Tage/.test(x)).slice(0, 5) }) })
console.log(JSON.stringify(out, null, 1))
console.log('Treppen gewählt:', await klick('Treppen')); await sleep(3500); console.log('nach Treppen:', await kopf())
await klick('Treppen'); await klick('Küchen'); await sleep(3500); console.log('zurück:', await kopf())
const gespeichert = await page.evaluate(async () => (await (await fetch('/api/settings/kalibrierung', { cache: 'no-store' })).json()).kalibrierung?.schwerpunkt)
console.log('gespeichert:', JSON.stringify(gespeichert))
await page.close(); browser.disconnect()
