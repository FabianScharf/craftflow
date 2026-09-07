import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  lerneFaktoren, median, bereichFuer, MIN_BEOBACHTUNGEN, DAEMPFUNG,
} from '../src/lib/lernschleife.ts'

const EINS = { werkstatt: 1, oberflaeche: 1, massivholz: 1, montage: 1 }
const beob = (bereich, vorher, nachher) => ({ bereich, vorher, nachher })

test('Ohne Beobachtungen aendert sich nichts', () => {
  const r = lerneFaktoren(EINS, [])
  assert.deepEqual(r.faktoren, EINS)
  assert.equal(r.begruendung.length, 0)
})

test('Unter der Mindestmenge wird nichts veraendert', () => {
  const zu_wenig = Array.from({ length: MIN_BEOBACHTUNGEN - 1 }, () => beob('werkstatt', 100, 50))
  assert.deepEqual(lerneFaktoren(EINS, zu_wenig).faktoren, EINS)
})

test('Ab der Mindestmenge wird nachgezogen — aber nur die halbe Strecke', () => {
  const b = Array.from({ length: MIN_BEOBACHTUNGEN }, () => beob('werkstatt', 100, 80))
  const r = lerneFaktoren(EINS, b)
  // Median 0,8 -> Ziel 0,8, halbe Strecke von 1,0 aus = 0,9
  assert.equal(r.faktoren.werkstatt, 1 * (1 + (0.8 - 1) * DAEMPFUNG))
  assert.equal(r.faktoren.werkstatt, 0.9)
})

test('Ein Ausreisser kippt das Ergebnis nicht — Median statt Mittelwert', () => {
  const b = [
    beob('werkstatt', 100, 90), beob('werkstatt', 100, 90),
    beob('werkstatt', 100, 90), beob('werkstatt', 100, 35),
  ]
  const r = lerneFaktoren(EINS, b)
  assert.equal(r.faktoren.werkstatt, 0.95)
})

test('Unsinnige Verhaeltnisse werden verworfen', () => {
  // 100 -> 5 ist keine Kalibrierung, sondern eine geloeschte Position.
  const b = Array.from({ length: MIN_BEOBACHTUNGEN }, () => beob('werkstatt', 100, 5))
  assert.deepEqual(lerneFaktoren(EINS, b).faktoren, EINS)
})

test('Jeder Bereich lernt fuer sich', () => {
  const b = [
    ...Array.from({ length: 3 }, () => beob('werkstatt', 100, 80)),
    ...Array.from({ length: 3 }, () => beob('montage', 100, 120)),
  ]
  const r = lerneFaktoren(EINS, b)
  assert.equal(r.faktoren.werkstatt, 0.9)
  assert.equal(r.faktoren.montage, 1.1)
  assert.equal(r.faktoren.oberflaeche, 1)
})

test('Die Deckelung haelt auch beim Lernen', () => {
  let f = { ...EINS }
  // Zwanzig Runden mit derselben starken Korrektur
  for (let i = 0; i < 20; i++) {
    f = lerneFaktoren(f, Array.from({ length: 5 }, () => beob('werkstatt', 100, 40))).faktoren
  }
  assert.ok(f.werkstatt >= 0.6, `Deckelung durchbrochen: ${f.werkstatt}`)
})

test('Ein bereits kalibrierter Faktor wird weiter nachgezogen, nicht ersetzt', () => {
  const alt = { ...EINS, werkstatt: 0.8 }
  const b = Array.from({ length: 3 }, () => beob('werkstatt', 100, 90))
  const r = lerneFaktoren(alt, b)
  // 0,8 * (1 + (0,9-1)*0,5) = 0,76
  assert.equal(r.faktoren.werkstatt, 0.76)
})

test('Die Begruendung nennt Bereich, Werte und Anzahl', () => {
  const b = Array.from({ length: 4 }, () => beob('oberflaeche', 100, 70))
  const r = lerneFaktoren(EINS, b)
  assert.equal(r.begruendung.length, 1)
  assert.match(r.begruendung[0], /Oberfläche/)
  assert.match(r.begruendung[0], /4 gewonnenen Angeboten/)
  assert.match(r.begruendung[0], /knapper/)
})

test('Ohne Veraenderung gibt es keine Begruendung', () => {
  const b = Array.from({ length: 3 }, () => beob('werkstatt', 100, 100))
  assert.equal(lerneFaktoren(EINS, b).begruendung.length, 0)
})

test('Der Median rechnet richtig', () => {
  assert.equal(median([]), 1)
  assert.equal(median([2]), 2)
  assert.equal(median([1, 2, 3]), 2)
  assert.equal(median([1, 2, 3, 4]), 2.5)
  assert.equal(median([3, 1, 2]), 2)
})

test('Kostenstellen werden dem richtigen Bereich zugeordnet', () => {
  assert.equal(bereichFuer('Zuschnitt'), 'werkstatt')
  assert.equal(bereichFuer('Oberfläche'), 'oberflaeche')
  assert.equal(bereichFuer('Montage'), 'montage')
  assert.equal(bereichFuer('Lieferung'), 'montage')
  // Der Fixsockel lernt NICHT mit — er skaliert nicht mit der Betriebsgroesse.
  assert.equal(bereichFuer('Besprechung'), null)
  assert.equal(bereichFuer('Planung'), null)
  assert.equal(bereichFuer('Konstruktion'), null)
  assert.equal(bereichFuer('Arbeitsvorbereitung'), null)
})

test('Nullwerte und Unsinn stuerzen nicht ab', () => {
  const b = [beob('werkstatt', 0, 50), beob('werkstatt', NaN, 10), beob('werkstatt', 100, -5)]
  assert.deepEqual(lerneFaktoren(EINS, b).faktoren, EINS)
})
