import { test } from 'node:test'
import assert from 'node:assert/strict'
import { bucheUm, HANDARBEIT_ZIEL, HANDARBEIT_ZUSCHLAG } from '../src/lib/handarbeit.ts'

const neu = () => ([
  { kostenstelle: 'Zuschnitt', minuten: 200, vkStunde: 72 },
  { kostenstelle: 'CNC', minuten: 60, vkStunde: 120 },
  { kostenstelle: 'Bekantung', minuten: 120, vkStunde: 100 },
])
const SAETZE = { Zuschnitt: 72, Zusammenbau: 65, CNC: 120, Bekantung: 100 }
const summe = (z) => z.reduce((s, x) => s + x.minuten, 0)

test('Ohne Abschaltung bleibt alles', () => {
  const z = neu()
  assert.deepEqual(bucheUm(z, new Set(), SAETZE), z)
})

test('Abgeschaltete Arbeit verschwindet NICHT, sie wandert', () => {
  const r = bucheUm(neu(), new Set(['CNC']), SAETZE)
  assert.equal(r.find(z => z.kostenstelle === 'CNC'), undefined)
  assert.ok(summe(r) > 380, `Minuten sind verschwunden: ${summe(r)}`)
})

test('Handarbeit dauert laenger als Maschinenarbeit', () => {
  const r = bucheUm(neu(), new Set(['CNC']), SAETZE)
  const ziel = r.find(z => z.kostenstelle === HANDARBEIT_ZIEL['CNC'])
  assert.equal(ziel.minuten, Math.round(60 * HANDARBEIT_ZUSCHLAG))
})

test('Das Ziel bekommt den Satz des Ziels, nicht den der Maschine', () => {
  const r = bucheUm(neu(), new Set(['CNC']), SAETZE)
  const ziel = r.find(z => z.kostenstelle === HANDARBEIT_ZIEL['CNC'])
  assert.equal(ziel.vkStunde, SAETZE[HANDARBEIT_ZIEL['CNC']])
})

test('Mehrere abgeschaltete Kostenstellen summieren sich im Ziel', () => {
  const r = bucheUm(neu(), new Set(['CNC', 'Bekantung']), SAETZE)
  assert.equal(r.find(z => z.kostenstelle === 'CNC'), undefined)
  assert.equal(r.find(z => z.kostenstelle === 'Bekantung'), undefined)
  const ziel = r.find(z => z.kostenstelle === 'Zusammenbau')
  assert.equal(ziel.minuten, Math.round(60 * 1.6) + Math.round(120 * 1.6))
})

test('Ist auch das Ziel abgeschaltet, geht die Handarbeit nicht verloren', () => {
  const r = bucheUm(neu(), new Set(['CNC', 'Zusammenbau']), SAETZE)
  assert.ok(summe(r) > 380, `Minuten verloren: ${summe(r)}`)
})

// GEFUNDEN IM CHECK-UP 2026-09-07: Vorher wurde JEDE abgeschaltete Kostenstelle
// umgebucht, auch die Montage. "Ich montiere nie" machte aus 90 min Montage
// 144 min Werkstattzeit — der Kunde holt ab, und der Betrieb baut laenger. Unsinn.
test('Abgeschaltete Montage ENTFAELLT, sie wird nicht zu Werkstattzeit', () => {
  const zeilen = [
    { kostenstelle: 'Zusammenbau', minuten: 200, vkStunde: 65 },
    { kostenstelle: 'Montage', minuten: 90, vkStunde: 65 },
    { kostenstelle: 'Lieferung', minuten: 30, vkStunde: 65 },
  ]
  const r = bucheUm(zeilen, new Set(['Montage']), SAETZE)
  assert.equal(r.find(z => z.kostenstelle === 'Montage'), undefined, 'Montage ist raus')
  assert.equal(r.find(z => z.kostenstelle === 'Zusammenbau').minuten, 200, 'Zusammenbau unveraendert')
  assert.equal(r.find(z => z.kostenstelle === 'Lieferung').minuten, 30, 'Lieferung bleibt')
})

test('Der gemessene Fall aus dem Check-Up ergibt jetzt 488 statt 632', () => {
  const zeilen = [
    { kostenstelle: 'Zuschnitt', minuten: 100, vkStunde: 72 },
    { kostenstelle: 'Bekantung', minuten: 120, vkStunde: 100 },
    { kostenstelle: 'CNC', minuten: 60, vkStunde: 120 },
    { kostenstelle: 'Zusammenbau', minuten: 200, vkStunde: 65 },
    { kostenstelle: 'Montage', minuten: 90, vkStunde: 65 },
    { kostenstelle: 'Lieferung', minuten: 30, vkStunde: 65 },
  ]
  const r = bucheUm(zeilen, new Set(['Bekantung', 'CNC', 'Montage']), SAETZE)
  // 120 + 60 = 180 Maschinenminuten x 1,6 = 288, dazu die 200 im Zusammenbau
  assert.equal(r.find(z => z.kostenstelle === 'Zusammenbau').minuten, 488)
  assert.equal(r.find(z => z.kostenstelle === 'Montage'), undefined)
  assert.equal(r.find(z => z.kostenstelle === 'Lieferung').minuten, 30)
})

test('Abgeschalteter Zuschnitt entfaellt — Zuschnitt wird dann zugekauft', () => {
  const r = bucheUm([
    { kostenstelle: 'Zuschnitt', minuten: 100, vkStunde: 72 },
    { kostenstelle: 'Zusammenbau', minuten: 200, vkStunde: 65 },
  ], new Set(['Zuschnitt']), SAETZE)
  assert.equal(r.length, 1)
  assert.equal(r[0].minuten, 200)
})

test('Die Normalisierung wird beachtet — Legacy-Codes greifen weiter', () => {
  const zeilen = [{ kostenstelle: '03_04_CNC', minuten: 60, vkStunde: 120 },
                  { kostenstelle: 'Zusammenbau', minuten: 100, vkStunde: 65 }]
  const norm = (s) => s.replace(/^\d\d_\d\d_/, '')
  const r = bucheUm(zeilen, new Set(['CNC']), SAETZE, norm)
  assert.equal(r.find(z => z.kostenstelle === '03_04_CNC'), undefined)
  assert.equal(r.find(z => z.kostenstelle === 'Zusammenbau').minuten, 100 + 96)
})

test('Leere Liste bleibt leer', () => {
  assert.deepEqual(bucheUm([], new Set(['CNC']), SAETZE), [])
})
