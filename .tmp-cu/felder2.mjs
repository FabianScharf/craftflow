import puppeteer from 'puppeteer-core'
const b = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null })
const app = (await b.pages()).find(p => p.url().includes('vercel.app'))
await app.bringToFront()
const d = await app.evaluate(() => {
  const f = [...document.querySelectorAll('input, textarea, select')].map((e, i) => `${i} ${e.tagName}/${e.type} ph="${e.placeholder || ''}" wert="${(e.value || '').slice(0,25)}" @${Math.round(e.getBoundingClientRect().x)},${Math.round(e.getBoundingClientRect().y)}`)
  const knoepfe = [...document.querySelectorAll('button')].map(e => e.textContent.replace(/\s+/g,' ').trim()).filter(t => t && t.length < 40)
  return { f, knoepfe: [...new Set(knoepfe)] }
})
console.log('FELDER:\n' + d.f.join('\n'))
console.log('\nKNOEPFE:\n' + d.knoepfe.join(' | '))
await b.disconnect()
