import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ablehnung, deckelAblehnung } from '../src/lib/plantexte.ts'

test('Ablehnung nennt Funktion und den Plan, der sie hebt', () => {
  assert.deepEqual(ablehnung('lernschleife'), { error: 'Die Lernschleife ist ab dem Pro-Plan verfügbar.', minPlan: 'pro' })
  assert.deepEqual(ablehnung('gaeb'), { error: 'Der GAEB-Import ist ab dem Enterprise-Plan verfügbar.', minPlan: 'enterprise' })
})
test('Deckel-Ablehnung nennt Zahl, Plan und nächsten Plan', () => {
  assert.deepEqual(deckelAblehnung('bauweiseRegeln', 'starter', 5),
    { error: 'Im Starter-Plan sind 5 Bauweise-Regeln möglich. Ab dem Pro-Plan unbegrenzt.', minPlan: 'pro' })
  assert.deepEqual(deckelAblehnung('optimierenRunden', 'enterprise', 40),
    { error: 'Im Enterprise-Plan sind 40 Optimieren-Runden je Angebot möglich.', minPlan: null })
  assert.deepEqual(deckelAblehnung('dateien', 'solo', 0),
    { error: 'Im Solo-Plan ist kein Datei-Upload möglich. Ab dem Starter-Plan 5 Dateien je Projekt.', minPlan: 'starter' })
})
