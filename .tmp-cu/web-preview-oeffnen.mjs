import puppeteer from 'puppeteer-core'
const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null })
const sleep = ms => new Promise(r => setTimeout(r, ms))
const B = 'https://craftflow-web-git-dev-fabian-scharf-s-projects.vercel.app'
const out = {}
for (const pfad of ['/#preise', '/roadmap']) {
  const page = await browser.newPage()
  await page.goto(B + pfad, { waitUntil: 'domcontentloaded', timeout: 90000 }); await sleep(4000)
  const t = await page.evaluate(() => document.body.innerText)
  out[pfad] = { url: page.url(), titel: await page.title(), sso: page.url().includes('vercel.com/sso') || /Log in to Vercel/i.test(t), preise: /Solo[\s\S]*Starter[\s\S]*Pro[\s\S]*Enterprise/.test(t) && /zzgl\. MwSt/.test(t), roadmap: /Roadmap|Geplant|In Arbeit|Fertig/.test(t) }
  await page.screenshot({ path: `/tmp/cfshots/web-${pfad.replace(/[^a-z]/gi, '') || 'start'}.png` })
  await page.bringToFront()
}
console.log(JSON.stringify(out, null, 1))
browser.disconnect()
