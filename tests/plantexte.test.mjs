import { test } from 'node:test'
import assert from 'node:assert/strict'
import { zugangAblehnung } from '../src/lib/plantexte.ts'

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
