import { test } from 'node:test'
import assert from 'node:assert/strict'
import { zugangAblehnung, deckelAblehnung, stimmenAblehnung } from '../src/lib/plantexte.ts'

test('zugangAblehnung(testphase): Standardtext, minPlan solo', () => {
  const r = zugangAblehnung('testphase')
  assert.equal(r.error, 'Deine Testphase ist abgelaufen. Wähle einen Plan, um weiterzuarbeiten.')
  assert.equal(r.minPlan, 'solo')
})

test('zugangAblehnung(gutschein): eigener Text, minPlan solo', () => {
  const r = zugangAblehnung('gutschein')
  assert.equal(r.error, 'Dein Gutschein ist abgelaufen. Wähle einen Plan, um weiterzuarbeiten.')
  assert.equal(r.minPlan, 'solo')
})

test('zugangAblehnung: beide Gründe liefern unterschiedliche Texte', () => {
  assert.notEqual(zugangAblehnung('testphase').error, zugangAblehnung('gutschein').error)
})

test('Deckel-Ablehnung kennt auch die Stimmen für Wünsche', () => {
  assert.deepEqual(deckelAblehnung('wunschStimmen', 'solo', 1),
    { error: 'Im Solo-Plan ist 1 Stimme für Wünsche möglich. Ab dem Starter-Plan 3 Stimmen für Wünsche.', minPlan: 'starter' })
})
