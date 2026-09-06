import { test } from 'node:test'
import assert from 'node:assert/strict'
import { findePreis, bauePreisBlock, istVeraltet } from '../src/lib/materialpreise.ts'

const P = (bezeichnung, ek, stand = '2026-09-06') => ({ bezeichnung, ek, einheit: 'Stk', stand })

test('Findet den Preis bei exakter Bezeichnung', () => {
  const t = findePreis('Blum Movento Softclose-Auszug', [P('Blum Movento Softclose-Auszug', 26.27)])
  assert.equal(t?.ek, 26.27)
})

test('Findet den Preis auch als Teilstring, Gross/Klein egal', () => {
  const t = findePreis('3x BLUM MOVENTO Softclose-Auszug inkl. Montage', [P('Blum Movento', 26.27)])
  assert.equal(t?.ek, 26.27)
})

test('Die laengste passende Bezeichnung gewinnt', () => {
  const t = findePreis('Blum Movento Softclose-Auszug 500mm',
    [P('Blum', 5), P('Blum Movento Softclose-Auszug', 26.27), P('Blum Movento', 20)])
  assert.equal(t?.ek, 26.27)
})

test('Kein Treffer ergibt null — nie geraten', () => {
  assert.equal(findePreis('Egger Dekorspanplatte 19mm', [P('Blum Movento', 26.27)]), null)
})

test('Leere Bezeichnung ergibt null', () => {
  assert.equal(findePreis('   ', [P('Blum Movento', 26.27)]), null)
})

test('Leere Preisliste ergibt leeren Block', () => {
  assert.equal(bauePreisBlock([]), '')
})

test('Preisblock nennt Bezeichnung, EK und Einheit', () => {
  const s = bauePreisBlock([P('Blum Movento', 26.27)])
  assert.match(s, /Blum Movento/)
  assert.match(s, /26\.27/)
  assert.match(s, /Stk/)
})

test('Preisblock traegt einen Verbindlich-Satz', () => {
  assert.match(bauePreisBlock([P('X', 1)]), /verbindlich/i)
})

test('Preisblock sagt ausdruecklich, dass der Aufschlag unberuehrt bleibt', () => {
  assert.match(bauePreisBlock([P('X', 1)]), /Aufschlag/)
})

test('Preis aelter als ein Jahr gilt als veraltet', () => {
  assert.equal(istVeraltet('2025-09-05', '2026-09-06'), true)
  assert.equal(istVeraltet('2026-09-05', '2026-09-06'), false)
})

test('Unlesbares Datum gilt nicht als veraltet — kein Fehlalarm', () => {
  assert.equal(istVeraltet('kaputt', '2026-09-06'), false)
})
