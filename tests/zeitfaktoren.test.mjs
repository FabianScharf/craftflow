import { test } from 'node:test'
import assert from 'node:assert/strict'
import { wendeFaktorenAn, KEINE_FAKTOREN } from '../src/lib/zeitfaktoren.ts'

const ZEILEN = [
  { kostenstelle: 'Besprechung', minuten: 20 },
  { kostenstelle: 'Zuschnitt', minuten: 200 },
  { kostenstelle: 'Zusammenbau', minuten: 400 },
  { kostenstelle: 'Oberfläche', minuten: 300 },
  { kostenstelle: 'Montage', minuten: 240 },
]

test('Faktor 1 aendert nichts', () => {
  assert.deepEqual(wendeFaktorenAn(ZEILEN, KEINE_FAKTOREN, false), ZEILEN)
})

test('Der Werkstattfaktor wirkt nur auf Werkstatt-Kostenstellen', () => {
  const r = wendeFaktorenAn(ZEILEN, { ...KEINE_FAKTOREN, werkstatt: 0.8 }, false)
  assert.equal(r.find(z => z.kostenstelle === 'Zuschnitt').minuten, 160)
  assert.equal(r.find(z => z.kostenstelle === 'Zusammenbau').minuten, 320)
  assert.equal(r.find(z => z.kostenstelle === 'Montage').minuten, 240)
  assert.equal(r.find(z => z.kostenstelle === 'Besprechung').minuten, 20)
})

test('Der Fixsockel bleibt immer unberuehrt', () => {
  const r = wendeFaktorenAn(ZEILEN, { werkstatt: 0.6, oberflaeche: 0.6, massivholz: 0.6, montage: 0.6 }, false)
  assert.equal(r.find(z => z.kostenstelle === 'Besprechung').minuten, 20)
})

test('Der Montagefaktor wirkt nur auf Montage und Lieferung', () => {
  const r = wendeFaktorenAn(ZEILEN, { ...KEINE_FAKTOREN, montage: 1.25 }, false)
  assert.equal(r.find(z => z.kostenstelle === 'Montage').minuten, 300)
  assert.equal(r.find(z => z.kostenstelle === 'Zuschnitt').minuten, 200)
})

test('Bei Massivholz kommt der Massivholzfaktor obendrauf', () => {
  const ohne = wendeFaktorenAn(ZEILEN, { ...KEINE_FAKTOREN, werkstatt: 0.9 }, false)
  const mit  = wendeFaktorenAn(ZEILEN, { ...KEINE_FAKTOREN, werkstatt: 0.9, massivholz: 1.2 }, true)
  assert.ok(mit.find(z => z.kostenstelle === 'Zuschnitt').minuten
          > ohne.find(z => z.kostenstelle === 'Zuschnitt').minuten)
})

test('Ohne Massivholz bleibt der Massivholzfaktor wirkungslos', () => {
  assert.deepEqual(wendeFaktorenAn(ZEILEN, { ...KEINE_FAKTOREN, massivholz: 1.4 }, false), ZEILEN)
})

test('Minuten bleiben ganze Zahlen und nie negativ', () => {
  const r = wendeFaktorenAn([{ kostenstelle: 'Zuschnitt', minuten: 7 }], { ...KEINE_FAKTOREN, werkstatt: 0.6 }, false)
  assert.equal(Number.isInteger(r[0].minuten), true)
  assert.ok(r[0].minuten >= 0)
})

test('Zusatzfelder wie vkStunde bleiben erhalten', () => {
  const r = wendeFaktorenAn([{ kostenstelle: 'Zuschnitt', minuten: 200, vkStunde: 72 }],
    { ...KEINE_FAKTOREN, werkstatt: 0.5 }, false)
  assert.equal(r[0].vkStunde, 72)
})

test('Leere Liste bleibt leer', () => {
  assert.deepEqual(wendeFaktorenAn([], KEINE_FAKTOREN, false), [])
})
