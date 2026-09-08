import { test } from 'node:test'
import assert from 'node:assert/strict'
import { calcAngebotspos, materialkostenPos, stundenPos } from '../src/lib/types.ts'

// Ein Spind: 6 h Werkstatt, 1,5 h Planung, 0,5 h Montage, 200 € Material, 70 €/h.
const spind = (stueckzahl) => ({
  id: 1, titel: 'Spind', beschreibung: '', stueckzahl,
  material: [{ id: 1, bezeichnung: 'Platte', menge: 1, einheit: 'pauschal', ekPreis: 200, aufschlag: 0 }],
  arbeitszeit: [
    { id: 1, kostenstelle: 'Zusammenbau', minuten: 360, vkStunde: 70 },
    { id: 2, kostenstelle: 'Planung',     minuten: 90,  vkStunde: 70 },
    { id: 3, kostenstelle: 'Montage',     minuten: 30,  vkStunde: 70 },
  ],
})

test('Ein Stueck rechnet wie bisher', () => {
  assert.equal(Math.round(calcAngebotspos(spind(1))), 760)
})

test('Zehn Stueck: die abgestimmten 5.243 € kommen durch die ganze Kette', () => {
  const gesamt = calcAngebotspos(spind(10))
  assert.ok(Math.abs(gesamt - 5243) < 30, `Gesamt ${gesamt.toFixed(0)} statt ~5243`)
  assert.ok(Math.abs(gesamt / 10 - 524) < 3, `Je Stück ${(gesamt/10).toFixed(0)} statt ~524`)
})

test('Zehn Stueck sind deutlich guenstiger als zehnmal eines', () => {
  const zehnfach = calcAngebotspos(spind(1)) * 10
  const serie = calcAngebotspos(spind(10))
  assert.ok(serie < zehnfach * 0.75, `Serie ${serie.toFixed(0)} gegen ${zehnfach.toFixed(0)}`)
})

test('Fehlende Stueckzahl verhaelt sich wie eine', () => {
  const ohne = { ...spind(1) }
  delete ohne.stueckzahl
  assert.equal(calcAngebotspos(ohne), calcAngebotspos(spind(1)))
})

test('Material bekommt den Mengenrabatt', () => {
  // 200 € × 10 × (1 − 5 %)
  assert.equal(Math.round(materialkostenPos(spind(10))), 1900)
})

test('Die Stunden folgen derselben Staffel wie der Preis', () => {
  const h = stundenPos(spind(10))
  // Werkstatt 6 × 10 × 0,70 = 42 · Planung 1,5 einmal · Montage 0,5 × 10 × 0,85 = 4,25
  assert.ok(Math.abs(h - (42 + 1.5 + 4.25)) < 0.01, `Stunden ${h}`)
})

test('Legacy-Kostenstellencodes werden trotzdem richtig zugeordnet', () => {
  // Echter Legacy-Code aus LEGACY_KS_MAP, nicht erfunden.
  const alt = { ...spind(10), arbeitszeit: [{ id: 1, kostenstelle: '01_02_Planung', minuten: 90, vkStunde: 70 }] }
  const neu = { ...spind(10), arbeitszeit: [{ id: 1, kostenstelle: 'Planung', minuten: 90, vkStunde: 70 }] }
  assert.equal(calcAngebotspos(alt), calcAngebotspos(neu))
})
