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

test('stimmenAblehnung: Einzahl bei genau einer Stimme (Solo-Plan)', () => {
  // Minor (Live-Test W6, Controller-Review 16.09.): "Du hast alle 1 Stimmen ..."
  // ist falsches Deutsch — trifft ausgerechnet den Solo-Plan (Budget 1), also die
  // häufigste Ablehnung überhaupt.
  assert.deepEqual(stimmenAblehnung('solo'), {
    error: 'Du hast deine 1 Stimme deines Plans vergeben. Nimm eine zurück oder wechsle den Plan.',
    minPlan: 'starter',
  })
})

test('stimmenAblehnung: Mehrzahl bleibt bei mehr als einer Stimme', () => {
  assert.deepEqual(stimmenAblehnung('starter'), {
    error: 'Du hast alle 3 Stimmen deines Plans vergeben. Nimm eine zurück oder wechsle den Plan.',
    minPlan: 'pro',
  })
})
