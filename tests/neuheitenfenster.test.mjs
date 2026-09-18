import { test } from 'node:test'
import assert from 'node:assert/strict'
import { wasZeigen, HOECHSTENS } from '../src/lib/neuheitenfenster.ts'

const n = (slug, datum, einstufung = 'gross') => ({
  slug, datum, einstufung, bereich: 'Test', titel: slug, kurz: '', url: `https://x/${slug}`,
})
const ALT = '2026-01-01T00:00:00Z'

test('Ohne Neues wird nichts gezeigt', () => {
  assert.deepEqual(wasZeigen([n('a', '2026-09-01')], '2026-09-30T00:00:00Z', ALT), { art: 'nichts' })
})

// Der wichtigste Fall: Ein frisch registrierter Nutzer darf nicht mit Neuerungen
// begrüßt werden, die für ihn gar keine sind.
test('Ein frisches Konto sieht nichts', () => {
  const heute = new Date().toISOString()
  assert.deepEqual(wasZeigen([n('a', '2026-09-17')], null, heute), { art: 'nichts' })
})

test('Ein altes Konto ohne Merker sieht alles seither', () => {
  const a = wasZeigen([n('a', '2026-09-17'), n('b', '2026-09-16')], null, ALT)
  assert.equal(a.art, 'fenster')
  assert.equal(a.neuheiten.length, 2)
  assert.equal(a.neuheiten[0].slug, 'a', 'neueste zuerst')
})

test('Nur Kleines ergibt den Streifen, kein Fenster', () => {
  const a = wasZeigen([n('a', '2026-09-17', 'klein'), n('b', '2026-09-16', 'klein')], null, ALT)
  assert.deepEqual(a, { art: 'streifen', anzahl: 2 })
})

test('Großes zieht Kleines mit ins Fenster, steht aber oben', () => {
  const a = wasZeigen([n('k', '2026-09-18', 'klein'), n('g', '2026-09-16', 'gross')], null, ALT)
  assert.equal(a.art, 'fenster')
  assert.equal(a.neuheiten[0].slug, 'g', 'Großes gehört nach oben')
})

test('Höchstens drei im Fenster, der Rest wird gezählt', () => {
  const viele = ['a', 'b', 'c', 'd', 'e'].map((s, i) => n(s, `2026-09-1${i + 1}`))
  const a = wasZeigen(viele, null, ALT)
  assert.equal(a.neuheiten.length, HOECHSTENS)
  assert.equal(a.weitere, 2)
})
