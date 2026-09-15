import { test } from 'node:test'
import assert from 'node:assert/strict'
import { nutzungAusAntwort, summiereNutzung, kostenUsd, nutzungAlsZeile } from '../src/lib/kinutzung.ts'

test('usage-Objekt wird gelesen, fehlende Felder sind 0', () => {
  assert.deepEqual(nutzungAusAntwort({ input_tokens: 100, output_tokens: 20 }), { eingabe: 100, cacheGeschrieben: 0, cacheGelesen: 0, ausgabe: 20 })
  assert.deepEqual(nutzungAusAntwort(undefined), { eingabe: 0, cacheGeschrieben: 0, cacheGelesen: 0, ausgabe: 0 })
})

test('Runden werden zusammengezaehlt', () => {
  const s = summiereNutzung({ eingabe: 1, cacheGeschrieben: 2, cacheGelesen: 3, ausgabe: 4 }, { eingabe: 10, cacheGeschrieben: 20, cacheGelesen: 30, ausgabe: 40 })
  assert.deepEqual(s, { eingabe: 11, cacheGeschrieben: 22, cacheGelesen: 33, ausgabe: 44 })
})

test('Kosten: Cache-Lesen kostet ein Zehntel, Schreiben das 1,25-fache', () => {
  // 1 Mio. Eingabe bei Sonnet 4.6 = 3 $
  assert.equal(kostenUsd({ eingabe: 1_000_000, cacheGeschrieben: 0, cacheGelesen: 0, ausgabe: 0 }, 'claude-sonnet-4-6'), 3)
  assert.equal(kostenUsd({ eingabe: 0, cacheGeschrieben: 0, cacheGelesen: 1_000_000, ausgabe: 0 }, 'claude-sonnet-4-6'), 0.3)
  assert.equal(kostenUsd({ eingabe: 0, cacheGeschrieben: 1_000_000, cacheGelesen: 0, ausgabe: 0 }, 'claude-sonnet-4-6'), 3.75)
  assert.equal(kostenUsd({ eingabe: 0, cacheGeschrieben: 0, cacheGelesen: 0, ausgabe: 1_000_000 }, 'claude-sonnet-4-6'), 15)
  assert.equal(kostenUsd({ eingabe: 1000, cacheGeschrieben: 0, cacheGelesen: 0, ausgabe: 0 }, 'unbekannt'), 0)
})

test('Eine typische Analyse (13k rein, 8k raus) kostet rund 16 Cent — und mit Cache deutlich weniger', () => {
  const ohne = kostenUsd({ eingabe: 13000, cacheGeschrieben: 0, cacheGelesen: 0, ausgabe: 8000 }, 'claude-sonnet-4-6')
  const mit = kostenUsd({ eingabe: 3500, cacheGeschrieben: 0, cacheGelesen: 9500, ausgabe: 8000 }, 'claude-sonnet-4-6')
  assert.ok(ohne > 0.15 && ohne < 0.17, String(ohne))
  assert.ok(mit < ohne, 'Cache muss billiger sein')
  assert.match(nutzungAlsZeile('analyze', 'claude-sonnet-4-6', { eingabe: 1, cacheGeschrieben: 2, cacheGelesen: 3, ausgabe: 4 }), /^\[analyze\] tokens — eingabe 1, cache geschrieben 2, cache gelesen 3, ausgabe 4 → ca\. 0\.\d{4} \$$/)
})
