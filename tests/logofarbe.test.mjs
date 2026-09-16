import { test } from 'node:test'
import assert from 'node:assert/strict'
import { dominanteFarbe, MINDEST_ANTEIL } from '../src/lib/logofarbe.ts'

const px = (liste) => liste.flatMap(([r, g, b, a = 255, n = 1]) => Array.from({ length: n }, () => [r, g, b, a]).flat())

test('Das Lembeck-Muster: Ziegelrot mit weißer Schrift und schwarzem Text ergibt das Ziegelrot', () => {
  const p = px([[129, 55, 50, 255, 400], [255, 255, 255, 255, 300], [0, 0, 0, 255, 200], [0, 0, 0, 0, 500]])
  assert.equal(dominanteFarbe(p), '#813732')
})

test('Kantenglättung und leichtes Rauschen fallen in denselben Farbton', () => {
  const p = px([[129, 55, 50, 255, 100], [131, 57, 52, 255, 100], [127, 53, 48, 255, 100], [200, 200, 200, 255, 50]])
  const hex = dominanteFarbe(p)
  assert.match(hex, /^#8[0-3]3[5-9]3[0-4]$/)
})

test('Zwei Farben: die häufigere gewinnt, nicht ein Mischton', () => {
  const p = px([[200, 136, 90, 255, 60], [30, 90, 200, 255, 100]])
  assert.equal(dominanteFarbe(p), '#1E5AC8')
})

test('Nur Schwarz, Weiß, Grau oder Durchsichtiges → null', () => {
  assert.equal(dominanteFarbe(px([[0, 0, 0], [255, 255, 255], [128, 128, 128], [90, 90, 90, 0]])), null)
  assert.equal(dominanteFarbe([]), null)
  assert.equal(dominanteFarbe(null), null)
})

test('Ein winziger Farbfleck unter dem Mindestanteil zählt nicht', () => {
  const n = Math.ceil(1 / MINDEST_ANTEIL) * 2
  const p = px([[255, 255, 255, 255, n], [200, 0, 0, 255, 1]])
  assert.equal(dominanteFarbe(p), null)
})
