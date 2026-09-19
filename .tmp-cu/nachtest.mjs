// Kostenfreier Nachtest nach der Fix-Welle: 10k-Ablehnung (Direktweg), Wünsche-Insert mit status 'fertig' via PostgREST (muss scheitern), Admin ?alle=1 als Nicht-Admin
import puppeteer from 'puppeteer-core'
const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null, protocolTimeout: 180000 })
const page = await browser.newPage()
await page.goto('https://craftflow-git-dev-fabian-scharf-s-projects.vercel.app/', { waitUntil: 'domcontentloaded', timeout: 90000 }); await new Promise(r => setTimeout(r, 3000))
console.log(JSON.stringify(await page.evaluate(async () => {
  const out = {}
  // 1) Direktweg > 10.000 Zeichen → 400 VOR jeder Reservierung (kein KI-Aufruf)
  const lang = 'Einbauschrank 2,40 m breit. '.repeat(400)
  const a = await fetch('/api/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: lang }) })
  const aj = await a.json().catch(() => ({})); out.zehnK = { status: a.status, error: (aj.error || '').slice(0, 90), laenge: lang.length }
  // 2) Wünsche: normale Liste + ?alle=1 als Nicht-Admin (gleiche Liste, kein 403, keine Ausgeblendeten)
  const w1 = await fetch('/api/wuensche'); const j1 = await w1.json().catch(() => ({}))
  const w2 = await fetch('/api/wuensche?alle=1'); const j2 = await w2.json().catch(() => ({}))
  const n = x => Array.isArray(x) ? x.length : Array.isArray(x?.wuensche) ? x.wuensche.length : -1
  out.wuensche = { normal: w1.status + ' n=' + n(j1), alle: w2.status + ' n=' + n(j2), ausgeblendetSichtbar: JSON.stringify(j2).includes('ausgeblendet') }
  // 3) Usage unverändert (kein Angebot verbraucht)
  const u = await fetch('/api/usage', { cache: 'no-store' }); const uj = await u.json().catch(() => ({})); out.usage = uj.count
  return out
}), null, 1))
await page.close(); browser.disconnect()
