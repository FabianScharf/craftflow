import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseLaufmeter } from '../src/lib/laufmeter.ts'

// Der gemessene Fall: die alte Regex addierte Breite + Hoehe + Tiefe zu 5,00 lfm
// und blies darueber die Mindest-Werkstattzeit auf 1.350 min auf.
test('Breite, Hoehe und Tiefe werden NICHT addiert', () => {
  assert.equal(parseLaufmeter('Einbauschrank Flur, 2,00 m breit x 2,40 m hoch x 0,60 m tief.'), 2)
})

test('Auch ohne das Wort "breit" zaehlen Hoehe und Tiefe nicht mit', () => {
  assert.equal(parseLaufmeter('Schrank 2,00 m, 2,40 m hoch, 0,60 m tief'), 2)
})

test('Masskette in Millimetern ergibt die Breite', () => {
  assert.equal(parseLaufmeter('Korpus 2000 × 2400 × 600 mm'), 2)
})

test('Masskette in Metern ergibt die Breite', () => {
  assert.equal(parseLaufmeter('Schrank 2,00 x 2,40 x 0,60 m'), 2)
})

test('Zentimeterangabe mit "breit"', () => {
  assert.equal(parseLaufmeter('240 cm breit, raumhoch'), 2.4)
})

test('Mehrere Moebel nebeneinander werden weiterhin summiert', () => {
  assert.equal(parseLaufmeter('Schrank 2,40 m und Sideboard 1,80 m'), 4.2)
})

test('Reine Laufmeterangabe bleibt unveraendert', () => {
  assert.equal(parseLaufmeter('Einbauschrank 3,6 lfm raumhoch'), 3.6)
})

test('Quadratmeter und Millimeter zaehlen nicht als Laufmeter', () => {
  assert.equal(parseLaufmeter('16,1 m² Plattenbedarf, Kante 1 mm'), 0)
})

test('Ohne Massangabe null', () => {
  assert.equal(parseLaufmeter('Rollcontainer fuer die Werkstatt'), 0)
})

test('Unplausible Werte werden gedeckelt', () => {
  assert.equal(parseLaufmeter('Wand 90,0 m breit'), 25)
})
