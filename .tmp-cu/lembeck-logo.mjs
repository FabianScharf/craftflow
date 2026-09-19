// Holt das Logo der Lembeck-Website und misst die dominanten Farben der Bildpunkte (nicht CSS).
import puppeteer from 'puppeteer-core'
const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null })
const sleep = ms => new Promise(r => setTimeout(r, ms))
const page = await browser.newPage(); await page.setViewport({ width: 1280, height: 900 })
await page.goto('https://tischlerei-lembeck.de/', { waitUntil: 'networkidle2', timeout: 90000 }); await sleep(2000)
const r = await page.evaluate(async () => {
  const imgs = [...document.querySelectorAll('img')].filter(i => /logo/i.test(i.src + ' ' + i.alt + ' ' + i.className)).map(i => i.currentSrc || i.src)
  const out = []
  for (const src of [...new Set(imgs)].slice(0, 4)) {
    const img = new Image(); img.crossOrigin = 'anonymous'; img.src = src + (src.includes('?') ? '&' : '?') + 'cb=' + Date.now()
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej }).catch(() => null)
    if (!img.naturalWidth) { out.push({ src, fehler: 'nicht ladbar' }); continue }
    const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight
    const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0)
    let d; try { d = ctx.getImageData(0, 0, c.width, c.height).data } catch (e) { out.push({ src, fehler: 'canvas tainted' }); continue }
    const z = {}
    for (let i = 0; i < d.length; i += 4) { if (d[i + 3] < 200) continue; const k = [d[i], d[i + 1], d[i + 2]].map(v => Math.round(v / 8) * 8).join(','); z[k] = (z[k] || 0) + 1 }
    const top = Object.entries(z).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, n]) => { const [r, g, b] = k.split(',').map(Number); return { rgb: k, hex: '#' + [r, g, b].map(v => Math.min(255, v).toString(16).padStart(2, '0')).join(''), anteil: Math.round(n / (d.length / 4) * 1000) / 10 } })
    out.push({ src, breite: img.naturalWidth, hoehe: img.naturalHeight, top })
  }
  return out
})
console.log(JSON.stringify(r, null, 1))
await page.close(); browser.disconnect()
