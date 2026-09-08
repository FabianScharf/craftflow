import { test } from 'node:test'
import assert from 'node:assert/strict'
import { kappeZeiten, werkstattDeckel, montageDeckel, ALTBAU_RE } from '../src/lib/zeitpruefung.ts'

// Die echten Zahlen aus dem gemessenen Referenzschrank (2,00 m breit, Dekor).
const REFERENZ = [
  { kostenstelle: 'Zuschnitt', minuten: 420 },
  { kostenstelle: 'Bekantung', minuten: 120 },
  { kostenstelle: 'Zusammenbau', minuten: 930 },
  { kostenstelle: 'Montage', minuten: 450 },
  { kostenstelle: 'Lieferung', minuten: 60 },
]
const summe = (z, ks) => z.filter(x => ks.includes(x.kostenstelle)).reduce((s, x) => s + x.minuten, 0)

test('Der gemessene Referenzschrank wird gekappt', () => {
  const { zeilen, hinweise } = kappeZeiten(REFERENZ, 2.0, false, false)
  assert.equal(summe(zeilen, ['Zuschnitt', 'Zusammenbau']), 810)   // 2 x 4,5 h x 1,5
  assert.equal(summe(zeilen, ['Montage']), 300)                    // 2 x 2,5 h
  assert.equal(hinweise.length, 2)
})

test('Die Aufteilung der KI bleibt anteilig erhalten', () => {
  const { zeilen } = kappeZeiten(REFERENZ, 2.0, false, false)
  const zu = zeilen.find(z => z.kostenstelle === 'Zuschnitt').minuten
  const za = zeilen.find(z => z.kostenstelle === 'Zusammenbau').minuten
  assert.ok(Math.abs(zu / za - 420 / 930) < 0.01)
})

test('Bekantung und Lieferung bleiben unangetastet', () => {
  const { zeilen } = kappeZeiten(REFERENZ, 2.0, false, false)
  assert.equal(zeilen.find(z => z.kostenstelle === 'Bekantung').minuten, 120)
  assert.equal(zeilen.find(z => z.kostenstelle === 'Lieferung').minuten, 60)
})

test('Wer im Richtwert liegt, wird nicht angefasst', () => {
  const brav = [
    { kostenstelle: 'Zuschnitt', minuten: 280 },
    { kostenstelle: 'Zusammenbau', minuten: 410 },
    { kostenstelle: 'Montage', minuten: 240 },
  ]
  const { zeilen, hinweise } = kappeZeiten(brav, 2.0, false, false)
  assert.deepEqual(zeilen, brav)
  assert.equal(hinweise.length, 0)
})

test('Massivholz bekommt mehr Luft als Dekor', () => {
  assert.ok(werkstattDeckel(2, true) > werkstattDeckel(2, false))
  assert.equal(werkstattDeckel(2, false), 810)
  assert.equal(werkstattDeckel(2, true), 1200)
})

test('Altbau darf laenger montieren', () => {
  assert.equal(montageDeckel(2, false), 300)
  assert.equal(montageDeckel(2, true), 480)
})

test('Ohne Laufmeter wird nichts gekappt — keine Pruefgrundlage', () => {
  const { zeilen, hinweise } = kappeZeiten(REFERENZ, 0, false, false)
  assert.deepEqual(zeilen, REFERENZ)
  assert.equal(hinweise.length, 0)
})

test('Altbau wird im Text erkannt', () => {
  assert.ok(ALTBAU_RE.test('Altbau, Wände nicht im Lot'))
  assert.ok(ALTBAU_RE.test('zweiter Stock ohne Aufzug'))
  assert.ok(ALTBAU_RE.test('schiefe Wände'))
  assert.equal(ALTBAU_RE.test('Neubau, gerade Wände'), false)
})
