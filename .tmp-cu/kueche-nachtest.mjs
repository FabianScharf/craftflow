// Nachtest nach den Prompt-Guards: Küchen-Referenz einmal rechnen (1 KI-Aufruf), Nullpreise + Warnungen prüfen.
import puppeteer from 'puppeteer-core'
import { writeFileSync } from 'node:fs'
import { REFERENZEN } from '../src/lib/kalibrierung.ts'
const text = 'Kunde: Familie Muster, Musterstraße 12, 63517 Rodenbach.\n\n' + REFERENZEN.kueche.text
const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null, protocolTimeout: 400000 })
const page = await browser.newPage()
await page.goto('https://craftflow-git-dev-fabian-scharf-s-projects.vercel.app/', { waitUntil: 'domcontentloaded', timeout: 90000 }); await new Promise(r => setTimeout(r, 2500))
const r = await page.evaluate(async (text) => {
  const j = async (u, o) => { const res = await fetch(u, o); return { status: res.status, body: await res.json().catch(() => ({})) } }
  const ks = (await j('/api/settings/kostenstellen', { cache: 'no-store' })).body; const ksL = Array.isArray(ks) ? ks : ks.kostenstellen || []
  const mg = (await j('/api/settings/materialgruppen', { cache: 'no-store' })).body; const mgL = Array.isArray(mg) ? mg : mg.materialgruppen || mg.gruppen || []
  const t0 = Date.now()
  const a = await j('/api/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text,
    userKostenstellen: ksL.filter(k => k.aktiv !== false).map(k => ({ code: k.code, bezeichnung: k.bezeichnung, stundensatz: k.stundensatz })),
    userMaterialgruppen: mgL.filter(m => m.aktiv !== false).map(m => ({ name: m.name, aufschlag_prozent: m.aufschlag_prozent })),
    deaktivierteKostenstellen: ksL.filter(k => k.aktiv === false).map(k => k.code) }) })
  return { status: a.status, sekunden: Math.round((Date.now() - t0) / 1000), error: a.body.error, fragen: a.body.data?.fragen, positionen: a.body.data?.positionen || [] }
}, text)
writeFileSync('/tmp/lvtest/kueche-nachtest.json', JSON.stringify(r, null, 1))
const pos = r.positionen
const nullpreise = pos.flatMap(p => (p.material || []).filter(m => !(m.ekPreis > 0)).map(m => p.titel + ' → ' + m.bezeichnung))
console.log(JSON.stringify({ status: r.status, sekunden: r.sekunden, error: r.error, fragen: r.fragen, positionen: pos.length, nullpreise, warnungen: pos.filter(p => p.warnung).map(p => p.titel + ': ' + String(p.warnung).slice(0, 120)), lackZukauf: pos.some(p => (p.material || []).some(m => /Lackierung \(Zukauf\)/.test(m.bezeichnung))) }, null, 1))
await page.close(); browser.disconnect()
