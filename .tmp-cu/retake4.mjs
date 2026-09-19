import puppeteer from 'puppeteer-core'
const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null, protocolTimeout: 240000 })
const page = (await browser.pages()).find(p => p.url().includes('craftflow-git-dev'))
const sleep = ms => new Promise(r => setTimeout(r, ms))
const text = () => page.evaluate(() => document.body.innerText)
const info = await page.evaluate(() => {
  const inputs = [...document.querySelectorAll('input')].filter(i => i.value.includes('Einbaugarderobe')).map(i => ({ v: i.value.slice(0, 40), y: Math.round(i.getBoundingClientRect().y) }))
  const tri = [...document.querySelectorAll('*')].filter(e => e.children.length === 0 && /^[▶▼]$/.test((e.textContent || '').trim())).map(e => ({ tag: e.tagName, t: e.textContent.trim(), y: Math.round(e.getBoundingClientRect().y), x: Math.round(e.getBoundingClientRect().x) }))
  return { inputs, tri }
})
console.log(JSON.stringify(info))
// ersten ▶ klicken
const ok = await page.evaluate(() => { const e = [...document.querySelectorAll('*')].find(e => e.children.length === 0 && (e.textContent || '').trim() === '▶'); if (!e) return false; e.click(); return true })
console.log('▶ geklickt:', ok); await sleep(1200)
let t = await text(); console.log('offen:', t.includes('KUNDENTEXT'), '| Egger-Zeile:', t.includes('Egger Dekorspanplatte 19'))
await page.evaluate(() => { const e = [...document.querySelectorAll('*')].find(e => e.children.length === 0 && /^[▼]$/.test((e.textContent || '').trim())); e && e.scrollIntoView({ block: 'start' }); window.scrollBy(0, -150) }); await sleep(700)
await page.screenshot({ path: '/tmp/cfshots/position-offen.png' }); console.log('Screenshot ok')
browser.disconnect()
