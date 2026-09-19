// Deterministische Gegenprobe (kostenfrei): dieselben KI-Ergebnisse (gespeicherte Positionen) mit
// veränderten Einstellungen durchrechnen — Stundensätze, Zeitfaktoren, Preisfaktor —
// mit denselben reinen Funktionen, die der Server nutzt (wendeFaktorenAn, calcAngebotspos).
import { readFileSync } from 'node:fs'
import { calcAngebotspos, stundenGesamt, materialkostenGesamt } from '../src/lib/types.ts'
import { wendeFaktorenAn } from '../src/lib/zeitfaktoren.ts'
const e = JSON.parse(readFileSync('/tmp/lvtest/referenz-laeufe.json', 'utf8'))
const SAETZE = { Besprechung: 65, Planung: 85, Konstruktion: 75, Arbeitsvorbereitung: 75, Produktion: 65, Warenhandling: 65, Zuschnitt: 72, Bekantung: 100, CNC: 120, 'Oberfläche': 72, Zusammenbau: 65, Verpacken: 65, Azubi: 52, Montage: 65, Lieferung: 65, Handarbeit: 65 }
const FIX = ['Besprechung','Planung','Konstruktion','Arbeitsvorbereitung'], MONT = ['Montage','Lieferung']
const FAKTOR_TESTKONTO = { werkstatt: 1.08, oberflaeche: 1, massivholz: 1, montage: 1 } // war beim Lauf gesetzt → herausrechnen
const eins = { werkstatt: 1, oberflaeche: 1, massivholz: 1, montage: 1 }
function rechne(positionen, { satzMult = 1, faktoren = eins, preisfaktor = 1 }, massiv = false) {
  const pos = positionen.map(p => {
    // Zeiten des Testkontos auf Faktor 1 zurückführen, dann die Testfaktoren anwenden
    const roh = wendeFaktorenAn((p.arbeitszeit || []).map(a => ({ ...a })), { werkstatt: 1 / FAKTOR_TESTKONTO.werkstatt, oberflaeche: 1, massivholz: 1, montage: 1 }, false)
    const az = wendeFaktorenAn(roh, faktoren, massiv).map(a => ({ ...a, vkStunde: (SAETZE[a.kostenstelle] ?? 65) * satzMult }))
    return { ...p, arbeitszeit: az, preisfaktor }
  })
  const min = { fix: 0, werk: 0, ober: 0, mont: 0 }
  for (const p of pos) for (const a of p.arbeitszeit) { const st = p.stueckzahl ?? 1; const g = FIX.includes(a.kostenstelle) ? 'fix' : MONT.includes(a.kostenstelle) ? 'mont' : a.kostenstelle === 'Oberfläche' ? 'ober' : 'werk'; min[g] += a.minuten * st }
  return { netto: Math.round(pos.reduce((s, p) => s + calcAngebotspos(p), 0)), stunden: Math.round(stundenGesamt(pos) * 10) / 10, material: Math.round(materialkostenGesamt(pos)), min }
}
const VARIANTEN = {
  basis: {}, saetze_halb: { satzMult: 0.5 }, saetze_doppelt: { satzMult: 2 },
  preisfaktor_05: { preisfaktor: 0.5 }, preisfaktor_3: { preisfaktor: 3 },
  zeit_05: { faktoren: { werkstatt: 0.5, oberflaeche: 0.5, massivholz: 0.5, montage: 0.5 } },
  zeit_3: { faktoren: { werkstatt: 3, oberflaeche: 3, massivholz: 3, montage: 3 } },
  nur_montage_05: { faktoren: { ...eins, montage: 0.5 } }, nur_werkstatt_3: { faktoren: { ...eins, werkstatt: 3 } },
}
const zeilen = []; const pruef = []
const nah = (a, b, tol = 0.02) => Math.abs(a - b) <= Math.max(2, Math.abs(b) * tol)
for (const [id, r] of Object.entries(e)) {
  if (!r.ok || r.fragen || !r.positionen?.length) continue
  const massiv = id.endsWith(':massiv')
  const basis = rechne(r.positionen, {}, massiv)
  const arbeit = basis.netto - basis.material // Arbeitskosten (Fix + Werkstatt + Oberfläche + Montage) bei Faktor 1, Preisfaktor 1
  const z = { id }
  for (const [v, cfg] of Object.entries(VARIANTEN)) {
    const x = rechne(r.positionen, cfg, massiv); z[v] = `${x.netto} € / ${x.stunden} h`
    // Erwartungen — Stundenanteile mit DERSELBEN Funktion (stundenGesamt) gebildet, damit die
    // Stückzahl-Regel der App (Planung einmal, Werkstatt je Stück 15 % kürzer) mitgerechnet wird.
    const nurGruppe = (g) => stundenGesamt(r.positionen.map(p => ({ ...p, arbeitszeit: (p.arbeitszeit || []).map(a => { const ist = FIX.includes(a.kostenstelle) ? 'fix' : MONT.includes(a.kostenstelle) ? 'mont' : a.kostenstelle === 'Oberfläche' ? 'ober' : 'werk'; return { ...a, minuten: ist === g ? a.minuten / (ist === 'werk' ? FAKTOR_TESTKONTO.werkstatt : 1) : 0 } }) })))
    const fixH = nurGruppe('fix'), werkH = nurGruppe('werk'), oberH = nurGruppe('ober'), montH = nurGruppe('mont')
    const mm = massiv ? 1 : 1
    let erwartetStd = null, erwartetNetto = null
    if (v === 'saetze_halb') { erwartetNetto = basis.material + arbeit * 0.5; erwartetStd = basis.stunden }
    if (v === 'saetze_doppelt') { erwartetNetto = basis.material + arbeit * 2; erwartetStd = basis.stunden }
    if (v === 'preisfaktor_05') { erwartetNetto = basis.netto * 0.5; erwartetStd = basis.stunden }
    if (v === 'preisfaktor_3') { erwartetNetto = basis.netto * 3; erwartetStd = basis.stunden }
    if (v === 'zeit_05') erwartetStd = fixH + (werkH + oberH) * 0.5 * (massiv ? 0.5 : 1) + montH * 0.5
    if (v === 'zeit_3') erwartetStd = fixH + (werkH + oberH) * 3 * (massiv ? 3 : 1) + montH * 3
    if (v === 'nur_montage_05') erwartetStd = fixH + werkH + oberH + montH * 0.5
    if (v === 'nur_werkstatt_3') erwartetStd = fixH + werkH * 3 + oberH + montH
    const okStd = erwartetStd == null || nah(x.stunden, erwartetStd, 0.01)
    const okNetto = erwartetNetto == null || nah(x.netto, erwartetNetto)
    if (!(okStd && okNetto)) pruef.push(`${id} ${v}: erhalten ${x.netto} € / ${x.stunden} h, erwartet ${erwartetNetto == null ? '–' : Math.round(erwartetNetto) + ' €'} / ${erwartetStd == null ? '–' : Math.round(erwartetStd * 10) / 10 + ' h'}`)
  }
  zeilen.push(z)
}
console.log(JSON.stringify({ zeilen, abweichungen: pruef }, null, 1))
