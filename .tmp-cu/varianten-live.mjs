// Live-Varianten am Einbauschrank: Einstellungen extrem verändern, Referenz rechnen, wiederherstellen.
// Aufruf: node .tmp-cu/varianten-live.mjs <variante>  — Varianten: saetze_halb | saetze_doppelt | preisfaktor_05 | preisfaktor_3 | zeit_05 | zeit_3 | basis
// KI-KOSTEN ~0,15 $ je Lauf. Ergebnis wird an /tmp/lvtest/varianten-live.json angehängt.
import puppeteer from 'puppeteer-core'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { REFERENZEN } from '../src/lib/kalibrierung.ts'
const variante = process.argv[2]
const AUS = '/tmp/lvtest/varianten-live.json'
const alle = existsSync(AUS) ? JSON.parse(readFileSync(AUS, 'utf8')) : {}
const KUNDE = 'Kunde: Familie Muster, Musterstraße 12, 63517 Rodenbach.\n\n'
const text = KUNDE + REFERENZEN.einbauschrank.text
const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null, protocolTimeout: 400000 })
const page = await browser.newPage()
await page.goto('https://craftflow-git-dev-fabian-scharf-s-projects.vercel.app/', { waitUntil: 'domcontentloaded', timeout: 90000 }); await new Promise(r => setTimeout(r, 2500))
const r = await page.evaluate(async ({ variante, text }) => {
  const j = async (u, o) => { const res = await fetch(u, o); return { status: res.status, body: await res.json().catch(() => ({})) } }
  const json = (b) => ({ method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) })
  const patch = (b) => ({ method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) })
  // 1) Ist-Zustand sichern
  const ks = (await j('/api/settings/kostenstellen', { cache: 'no-store' })).body
  const ksListe = Array.isArray(ks) ? ks : ks.kostenstellen || []
  const kal = (await j('/api/settings/kalibrierung', { cache: 'no-store' })).body.kalibrierung
  const bp = (await j('/api/settings/betriebsprofil', { cache: 'no-store' })).body
  const preisfaktorAlt = (bp.profil || bp).preisfaktor
  const out = { variante, vorher: { saetze: ksListe.map(k => k.code + ':' + k.stundensatz), faktoren: [kal.faktor_werkstatt, kal.faktor_oberflaeche, kal.faktor_massivholz, kal.faktor_montage], preisfaktor: preisfaktorAlt } }
  const kalBody = (f) => ({ maschinen: kal.maschinen, schwerpunkt: kal.schwerpunkt, montage_selbst: kal.montage_selbst, stueckzahlen: kal.stueckzahlen, antwort_grund: kal.antwort_grund, antwort_lack: kal.antwort_lack, antwort_massiv: kal.antwort_massiv, antwort_montage: kal.antwort_montage, ...f })
  // 2) Variante setzen
  const setzeSaetze = async (mult) => { for (const k of ksListe) await j('/api/settings/kostenstellen', json({ id: k.id, stundensatz: Math.round(k.stundensatz * mult * 100) / 100 })) }
  const setzeFaktoren = async (v) => (await j('/api/settings/kalibrierung', json(kalBody({ faktor_werkstatt: v, faktor_oberflaeche: v, faktor_massivholz: v, faktor_montage: v })))).status
  const setzePreisfaktor = async (v) => (await j('/api/settings/betriebsprofil', patch({ preisfaktor: v }))).status
  if (variante === 'saetze_halb') await setzeSaetze(0.5)
  if (variante === 'saetze_doppelt') await setzeSaetze(2)
  if (variante === 'preisfaktor_05') out.set = await setzePreisfaktor(0.5)
  if (variante === 'preisfaktor_3') out.set = await setzePreisfaktor(3)
  if (variante === 'zeit_05') out.set = await setzeFaktoren(0.5)
  if (variante === 'zeit_3') out.set = await setzeFaktoren(3)
  // Kontrolle, was jetzt gilt
  const ks2 = (await j('/api/settings/kostenstellen', { cache: 'no-store' })).body; const l2 = Array.isArray(ks2) ? ks2 : ks2.kostenstellen || []
  const kal2 = (await j('/api/settings/kalibrierung', { cache: 'no-store' })).body.kalibrierung
  const bp2 = (await j('/api/settings/betriebsprofil', { cache: 'no-store' })).body
  out.gesetzt = { saetze: l2.map(k => k.code + ':' + k.stundensatz), faktoren: [kal2.faktor_werkstatt, kal2.faktor_oberflaeche, kal2.faktor_massivholz, kal2.faktor_montage], preisfaktor: (bp2.profil || bp2).preisfaktor }
  // 3) Rechnen
  const t0 = Date.now()
  // Wie die App: Kostenstellen (mit Stundensätzen) und Materialgruppen aus den Einstellungen mitschicken
  const ksJetzt = (await j('/api/settings/kostenstellen', { cache: 'no-store' })).body; const ksL = Array.isArray(ksJetzt) ? ksJetzt : ksJetzt.kostenstellen || []
  const mg = (await j('/api/settings/materialgruppen', { cache: 'no-store' })).body; const mgL = Array.isArray(mg) ? mg : mg.materialgruppen || mg.gruppen || []
  const a = await j('/api/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text,
    userKostenstellen: ksL.filter(k => k.aktiv !== false).map(k => ({ code: k.code, bezeichnung: k.bezeichnung, stundensatz: k.stundensatz })),
    userMaterialgruppen: mgL.filter(m => m.aktiv !== false).map(m => ({ name: m.name, aufschlag_prozent: m.aufschlag_prozent })),
    deaktivierteKostenstellen: ksL.filter(k => k.aktiv === false).map(k => k.code) }) })
  out.sekunden = Math.round((Date.now() - t0) / 1000); out.status = a.status; out.error = a.body.error; out.fragen = a.body.data?.fragen; out.positionen = a.body.data?.positionen || []
  // 4) Wiederherstellen
  for (const k of ksListe) await j('/api/settings/kostenstellen', json({ id: k.id, stundensatz: k.stundensatz }))
  await j('/api/settings/kalibrierung', json(kalBody({ faktor_werkstatt: kal.faktor_werkstatt, faktor_oberflaeche: kal.faktor_oberflaeche, faktor_massivholz: kal.faktor_massivholz, faktor_montage: kal.faktor_montage })))
  await j('/api/settings/betriebsprofil', patch({ preisfaktor: preisfaktorAlt }))
  const ks3 = (await j('/api/settings/kostenstellen', { cache: 'no-store' })).body; const l3 = Array.isArray(ks3) ? ks3 : ks3.kostenstellen || []
  const kal3 = (await j('/api/settings/kalibrierung', { cache: 'no-store' })).body.kalibrierung
  const bp3 = (await j('/api/settings/betriebsprofil', { cache: 'no-store' })).body
  out.wiederhergestellt = { saetze: l3.map(k => k.code + ':' + k.stundensatz), faktoren: [kal3.faktor_werkstatt, kal3.faktor_oberflaeche, kal3.faktor_massivholz, kal3.faktor_montage], preisfaktor: (bp3.profil || bp3).preisfaktor }
  return out
}, { variante, text })
alle[variante] = r; writeFileSync(AUS, JSON.stringify(alle, null, 1))
console.log(JSON.stringify({ variante, set: r.set, status: r.status, sekunden: r.sekunden, error: r.error, fragen: r.fragen, positionen: r.positionen.length, gesetzt: r.gesetzt, gleichWieVorher: JSON.stringify(r.vorher) === JSON.stringify(r.wiederhergestellt) }))
await page.close(); browser.disconnect()
