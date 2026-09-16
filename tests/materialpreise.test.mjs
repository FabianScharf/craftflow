import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  findePreis, bauePreisBlock, istVeraltet, fehlendeMaterialpreise, materialpreisWarnung,
} from '../src/lib/materialpreise.ts'

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

// ── Platzhalter mit 0 EUR ────────────────────────────────────────────────────
// Live-Test 2026-09-17 (Kuechen-Referenz): "Arbeitsplatte 38 mm — Material nach
// Kundenwahl, Quadratmeterpreis eintragen" stand mit 0 EUR im Angebot, obwohl
// der Text "Schichtstoff 38 mm" nannte.

const M = (bezeichnung, ekPreis) => ({ bezeichnung, menge: 1, einheit: 'm²', ekPreis, aufschlag: 0.3 })

test('Ein Platzhalter mit 0 EUR wird gemeldet', () => {
  const treffer = fehlendeMaterialpreise([
    M('Arbeitsplatte 38 mm — Material nach Kundenwahl, Quadratmeterpreis eintragen', 0),
  ])
  assert.deepEqual(treffer, ['Arbeitsplatte 38 mm — Material nach Kundenwahl, Quadratmeterpreis eintragen'])
})

test('Mehrere Platzhalter kommen alle durch', () => {
  const treffer = fehlendeMaterialpreise([
    M('Lackierung (Zukauf) — Quadratmeterpreis eintragen', 0),
    M('Spanplatte dekorbeidseitig 18 mm', 15),
    M('Arbeitsplatte nach Kundenwahl', 0),
  ])
  assert.equal(treffer.length, 2)
})

test('Ein bepreister Platzhalter ist kein Fall — der Nutzer hat ihn ausgefuellt', () => {
  assert.deepEqual(fehlendeMaterialpreise([M('Lackierung (Zukauf) — Quadratmeterpreis eintragen', 42)]), [])
})

test('Ein normales Material mit 0 EUR wird NICHT gemeldet — nur Platzhalter', () => {
  // Beigestelltes Material des Kunden darf 0 EUR kosten und ist kein Fehler.
  assert.deepEqual(fehlendeMaterialpreise([M('Beistellung Kunde: Griffe', 0)]), [])
})

test('Leere und fehlende Listen ergeben nichts', () => {
  assert.deepEqual(fehlendeMaterialpreise([]), [])
  assert.deepEqual(fehlendeMaterialpreise(undefined), [])
  assert.deepEqual(fehlendeMaterialpreise(null), [])
  assert.deepEqual(fehlendeMaterialpreise([M('   ', 0)]), [])
})

test('Der Warntext nennt die Bezeichnung und die 0 EUR', () => {
  const text = materialpreisWarnung([M('Arbeitsplatte nach Kundenwahl', 0)])
  assert.equal(text, 'Materialpreis fehlt: Arbeitsplatte nach Kundenwahl steht mit 0 € im Angebot.')
  assert.equal(materialpreisWarnung([M('Spanplatte roh 18 mm', 12)]), '')
})
