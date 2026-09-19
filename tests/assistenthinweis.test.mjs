import { test } from 'node:test'
import assert from 'node:assert/strict'
import { zeigeHinweis, AB_START, RUHE_TAGE } from '../src/lib/assistenthinweis.ts'

const JETZT = new Date('2026-09-19T10:00:00Z')
const vorTagen = n => new Date(JETZT.getTime() - n * 86400000).toISOString()

test('Beim ersten und zweiten Öffnen kommt nichts', () => {
  assert.equal(zeigeHinweis({ starts: 1 }, JETZT), false)
  assert.equal(zeigeHinweis({ starts: 2 }, JETZT), false)
})

test('Ab dem dritten Öffnen stellt er sich vor', () => {
  assert.equal(zeigeHinweis({ starts: AB_START }, JETZT), true)
})

// Der wichtigste Fall: Wer ihn kennt, braucht keine Vorstellung.
test('Wer den Assistenten schon benutzt hat, sieht nie einen Hinweis', () => {
  assert.equal(zeigeHinweis({ starts: 50, benutzt: true }, JETZT), false)
})

test('Nach dem Wegklicken vierzehn Tage Ruhe', () => {
  assert.equal(zeigeHinweis({ starts: 9, weggeklickt: 1, zuletzt: vorTagen(3) }, JETZT), false)
  assert.equal(zeigeHinweis({ starts: 9, weggeklickt: 1, zuletzt: vorTagen(RUHE_TAGE + 1) }, JETZT), true)
})

test('Zweimal weggeklickt heißt nie wieder', () => {
  assert.equal(zeigeHinweis({ starts: 99, weggeklickt: 2, zuletzt: vorTagen(365) }, JETZT), false)
})

test('Ein leerer Stand zeigt nichts — kein Hinweis ohne Grundlage', () => {
  assert.equal(zeigeHinweis({}, JETZT), false)
})
