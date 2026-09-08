import { test } from 'node:test'
import assert from 'node:assert/strict'
import { baueRegelBlock, MAX_REGELN_IM_PROMPT, WARNUNG_AB_REGELN } from '../src/lib/learn.ts'

test('Leere Regelliste ergibt leeren String', () => {
  assert.equal(baueRegelBlock([]), '')
})

test('Regel mit Bedingung wird als "Wenn ... →" gerendert', () => {
  const s = baueRegelBlock([{ bereich: 'Material', wenn: 'Korpus mit Rückwand', dann: 'Rückwand 8mm Multiplex' }])
  assert.match(s, /\[Material\] Wenn Korpus mit Rückwand → Rückwand 8mm Multiplex/)
})

test('Regel ohne Bedingung wird als "Immer →" gerendert', () => {
  const s = baueRegelBlock([{ bereich: 'Zeit', wenn: '  ', dann: 'Zuschnitt 50 % länger' }])
  assert.match(s, /\[Zeit\] Immer → Zuschnitt 50 % länger/)
})

test('Block enthält Überschrift und Vorrang-Satz', () => {
  const s = baueRegelBlock([{ bereich: 'Material', wenn: '', dann: 'X' }])
  assert.match(s, /## MEINE BAUWEISE — VERBINDLICHE REGELN DIESES BETRIEBS/)
  assert.match(s, /Vorrang/)
})

test('Mehr als MAX_REGELN_IM_PROMPT Regeln werden abgeschnitten', () => {
  const viele = Array.from({ length: MAX_REGELN_IM_PROMPT + 5 }, (_, i) => ({ bereich: 'Material', wenn: '', dann: `Regel ${i}` }))
  const zeilen = baueRegelBlock(viele).split('\n').filter(z => z.startsWith('[Material]'))
  assert.equal(zeilen.length, MAX_REGELN_IM_PROMPT)
})

test('Schwellen haben die in der Spec festgelegten Werte', () => {
  assert.equal(MAX_REGELN_IM_PROMPT, 60)
  assert.equal(WARNUNG_AB_REGELN, 40)
})
