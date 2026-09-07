import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  REFERENZ, BAENDER, referenzPreis, berechneFaktoren, deckele,
} from '../src/lib/kalibrierung.ts'

const SAETZE = {
  Besprechung: 65, Planung: 85, Konstruktion: 75, Arbeitsvorbereitung: 75,
  Produktion: 65, Warenhandling: 65, Zuschnitt: 72, Bekantung: 100, CNC: 120,
  'Oberfläche': 72, Zusammenbau: 65, Verpacken: 65, Azubi: 52, Montage: 65, Lieferung: 65,
}
const AUFSCHLAG = 0.30

test('Die Referenzkalkulation ergibt einen plausiblen Gesamtpreis', () => {
  const r = referenzPreis(SAETZE, AUFSCHLAG)
  assert.ok(r.gesamt > 1900 && r.gesamt < 2600, `Gesamt war ${r.gesamt}`)
  assert.ok(Math.abs(r.material - 409.5 * 1.3) < 1)
  assert.ok(r.werkstatt > r.montage)
})

test('Die Summe der Bloecke ist der Gesamtpreis', () => {
  const r = referenzPreis(SAETZE, AUFSCHLAG)
  assert.ok(Math.abs((r.material + r.fixsockel + r.werkstatt + r.montage) - r.gesamt) < 0.01)
})

test('Wer die Bandmitte trifft, bekommt Faktor 1,0', () => {
  const r = referenzPreis(SAETZE, AUFSCHLAG)
  const f = berechneFaktoren(
    { grund: `test:${r.gesamt}`, lack: 'unbekannt', massiv: 'unbekannt', montage: 'unbekannt' },
    SAETZE, AUFSCHLAG)
  assert.ok(Math.abs(f.werkstatt - 1.0) < 0.02, `Faktor war ${f.werkstatt}`)
})

test('Ein guenstigerer Betrieb bekommt einen Faktor unter 1', () => {
  const f = berechneFaktoren(
    { grund: '1200-1600', lack: 'unbekannt', massiv: 'unbekannt', montage: 'unbekannt' },
    SAETZE, AUFSCHLAG)
  assert.ok(f.werkstatt < 1.0, `Faktor war ${f.werkstatt}`)
})

test('"weiss ich nicht" laesst Oberflaeche und Massivholz auf genau 1,0', () => {
  const f = berechneFaktoren(
    { grund: '1600-2100', lack: 'unbekannt', massiv: 'unbekannt', montage: 'unbekannt' },
    SAETZE, AUFSCHLAG)
  assert.equal(f.oberflaeche, 1.0)
  assert.equal(f.massivholz, 1.0)
})

test('Ohne Montage-Antwort erbt die Montage die Geschwindigkeit des Betriebs', () => {
  const f = berechneFaktoren(
    { grund: '1600-2100', lack: '', massiv: '', montage: 'unbekannt' }, SAETZE, AUFSCHLAG)
  assert.equal(f.montage, f.werkstatt)
})

test('Eine eigene Montage-Antwort ueberschreibt das Erbe', () => {
  const f = berechneFaktoren(
    { grund: '1600-2100', lack: '', massiv: '', montage: 'ein-tag' }, SAETZE, AUFSCHLAG)
  assert.notEqual(f.montage, f.werkstatt)
  assert.ok(f.montage > 1)
})

test('Benachbarte Baender springen nicht mehr als 0,4', () => {
  const reihe = ['unter-1200', '1200-1600', '1600-2100', '2100-2700', 'ueber-2700']
    .map(b => berechneFaktoren({ grund: b, lack: '', massiv: '', montage: '' }, SAETZE, AUFSCHLAG).werkstatt)
  for (let i = 1; i < reihe.length; i++) {
    assert.ok(reihe[i] - reihe[i - 1] <= 0.4,
      `Sprung von ${reihe[i - 1]} auf ${reihe[i]} ist zu hart`)
  }
})

test('"mache ich nicht" laesst den Faktor ebenfalls auf 1,0', () => {
  const f = berechneFaktoren(
    { grund: '1600-2100', lack: 'nicht', massiv: 'nicht', montage: 'nicht' },
    SAETZE, AUFSCHLAG)
  assert.equal(f.oberflaeche, 1.0)
  assert.equal(f.massivholz, 1.0)
})

test('Eine unbeantwortete Frage erzeugt keinen Faktor', () => {
  const f = berechneFaktoren({ grund: '', lack: '', massiv: '', montage: '' }, SAETZE, AUFSCHLAG)
  assert.deepEqual(f, { werkstatt: 1, oberflaeche: 1, massivholz: 1, montage: 1 })
})

test('Die Deckelung haelt in beide Richtungen', () => {
  assert.equal(deckele(0.1), 0.6)
  assert.equal(deckele(9), 1.4)
  assert.equal(deckele(0.83), 0.83)
})

test('Auch ein extremes Band sprengt die Deckelung nicht', () => {
  const f = berechneFaktoren(
    { grund: 'unter-1200', lack: 'mehr', massiv: 'ueber-6000', montage: 'laenger' },
    SAETZE, AUFSCHLAG)
  for (const [name, wert] of Object.entries(f)) {
    assert.ok(wert >= 0.6 && wert <= 1.4, `${name} ausserhalb der Deckelung: ${wert}`)
  }
})

test('Die Lackfrage wirkt nur auf die Oberflaeche', () => {
  const a = berechneFaktoren({ grund: '1600-2100', lack: '700-1100', massiv: 'unbekannt', montage: 'unbekannt' }, SAETZE, AUFSCHLAG)
  const b = berechneFaktoren({ grund: '1600-2100', lack: 'unbekannt', massiv: 'unbekannt', montage: 'unbekannt' }, SAETZE, AUFSCHLAG)
  assert.notEqual(a.oberflaeche, b.oberflaeche)
  assert.equal(a.werkstatt, b.werkstatt)
  assert.equal(a.montage, b.montage)
})

test('Die Baender sind aufsteigend', () => {
  for (const frage of ['grund', 'massiv', 'lack', 'montage']) {
    const werte = BAENDER[frage].filter(b => typeof b.mitte === 'number').map(b => b.mitte)
    for (let i = 1; i < werte.length; i++) {
      assert.ok(werte[i] > werte[i - 1], `${frage} nicht aufsteigend bei ${werte[i]}`)
    }
  }
})

test('Die Referenz nennt alle vier Bloecke', () => {
  assert.ok(REFERENZ.materialEk > 0)
  assert.ok(REFERENZ.fixsockel.length > 0)
  assert.ok(REFERENZ.werkstatt.length > 0)
  assert.ok(REFERENZ.montage.length > 0)
})

test('Hoehere Stundensaetze machen den Referenzpreis teurer', () => {
  const teuer = Object.fromEntries(Object.entries(SAETZE).map(([k, v]) => [k, v * 1.5]))
  assert.ok(referenzPreis(teuer, AUFSCHLAG).gesamt > referenzPreis(SAETZE, AUFSCHLAG).gesamt)
})

import { abzuschaltendeKostenstellen } from '../src/lib/kalibrierung.ts'

test('Ohne CNC wird die CNC-Kostenstelle abgeschaltet', () => {
  const aus = abzuschaltendeKostenstellen({ maschinen: ['formatsaege'], montage_selbst: 'immer' })
  assert.ok(aus.includes('CNC'))
})

test('Mit CNC bleibt sie an', () => {
  const aus = abzuschaltendeKostenstellen({ maschinen: ['cnc', 'kantenanleim'], montage_selbst: 'immer' })
  assert.equal(aus.includes('CNC'), false)
  assert.equal(aus.includes('Bekantung'), false)
})

test('Ohne Kantenanleimmaschine wandert die Bekantung zur Handarbeit', () => {
  assert.ok(abzuschaltendeKostenstellen({ maschinen: ['cnc'] }).includes('Bekantung'))
})

test('Wer nicht montiert, bekommt keine Montagezeile — Lieferung bleibt', () => {
  const aus = abzuschaltendeKostenstellen({ maschinen: ['cnc','kantenanleim'], montage_selbst: 'nie' })
  assert.ok(aus.includes('Montage'))
  assert.equal(aus.includes('Lieferung'), false)
})

test('Wer manchmal montiert, behaelt die Montage', () => {
  const aus = abzuschaltendeKostenstellen({ maschinen: ['cnc','kantenanleim'], montage_selbst: 'manchmal' })
  assert.equal(aus.includes('Montage'), false)
})

test('Die Formatkreissaege schaltet nichts ab — Zuschnitt faellt immer an', () => {
  const aus = abzuschaltendeKostenstellen({ maschinen: [], montage_selbst: 'immer' })
  assert.equal(aus.includes('Zuschnitt'), false)
})

test('Die Lackierkabine schaltet die Oberflaeche NICHT ab — Oelen braucht keine', () => {
  const aus = abzuschaltendeKostenstellen({ maschinen: [], montage_selbst: 'immer' })
  assert.equal(aus.includes('Oberfläche'), false)
})

test('Ohne Kalibrierung wird nichts abgeschaltet', () => {
  assert.deepEqual(abzuschaltendeKostenstellen(null), [])
  assert.deepEqual(abzuschaltendeKostenstellen(undefined), [])
})
