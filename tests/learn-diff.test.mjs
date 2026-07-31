import { test } from 'node:test'
import assert from 'node:assert/strict'
import { diffOffer } from '../src/lib/learn.ts'

// Hilfsfunktion: eine Position mit Standardwerten, einzelne Felder überschreibbar.
const p = (over = {}) => ({ id: 'p1', titel: 'Garderobe', material: [], arbeitszeit: [], ...over })

test('Material ersetzt (gleiche id, andere Bezeichnung)', () => {
  const alt = { positionen: [p({ material: [{ id: 'm1', bezeichnung: 'HPL 6mm', menge: 2 }] })] }
  const neu = { positionen: [p({ material: [{ id: 'm1', bezeichnung: 'Multiplex Birke 8mm', menge: 2 }] })] }
  const d = diffOffer(alt, neu)
  assert.equal(d.length, 1)
  assert.equal(d[0].art, 'material_ersetzt')
  assert.equal(d[0].vorher, 'HPL 6mm')
  assert.equal(d[0].nachher, 'Multiplex Birke 8mm')
  assert.equal(d[0].position, 'Garderobe')
  assert.equal(d[0].nr, 1)
})

test('Material ersetzt auch ohne ids (Paarung nach Reihenfolge)', () => {
  const alt = { positionen: [p({ material: [{ bezeichnung: 'HPL 6mm', menge: 1 }] })] }
  const neu = { positionen: [p({ material: [{ bezeichnung: 'Multiplex 8mm', menge: 1 }] })] }
  const d = diffOffer(alt, neu)
  assert.equal(d.length, 1)
  assert.equal(d[0].art, 'material_ersetzt')
})

test('Material entfernt und Material neu, wenn Anzahl abweicht', () => {
  const alt = { positionen: [p({ material: [{ id: 'm1', bezeichnung: 'HPL 6mm' }, { id: 'm2', bezeichnung: 'Kantenband ABS' }] })] }
  const neu = { positionen: [p({ material: [{ id: 'm1', bezeichnung: 'HPL 6mm' }] })] }
  const d = diffOffer(alt, neu)
  assert.equal(d.length, 1)
  assert.equal(d[0].art, 'material_entfernt')
  assert.equal(d[0].vorher, 'Kantenband ABS')

  const neu2 = { positionen: [p({ material: [{ id: 'm1', bezeichnung: 'HPL 6mm' }, { id: 'm9', bezeichnung: 'LED-Profil' }] })] }
  const d2 = diffOffer({ positionen: [p({ material: [{ id: 'm1', bezeichnung: 'HPL 6mm' }] })] }, neu2)
  assert.equal(d2.length, 1)
  assert.equal(d2[0].art, 'material_neu')
  assert.equal(d2[0].nachher, 'LED-Profil')
})

test('Minuten: 45 → 70 wird erkannt (55 %, 25 min)', () => {
  const alt = { positionen: [p({ arbeitszeit: [{ kostenstelle: 'Zuschnitt', minuten: 45 }] })] }
  const neu = { positionen: [p({ arbeitszeit: [{ kostenstelle: 'Zuschnitt', minuten: 70 }] })] }
  const d = diffOffer(alt, neu)
  assert.equal(d.length, 1)
  assert.equal(d[0].art, 'minuten_geaendert')
  assert.equal(d[0].kostenstelle, 'Zuschnitt')
  assert.equal(d[0].vorher, 45)
  assert.equal(d[0].nachher, 70)
})

test('Minuten: 45 → 56 wird NICHT erkannt (24 % unter der Prozentschwelle)', () => {
  const alt = { positionen: [p({ arbeitszeit: [{ kostenstelle: 'Zuschnitt', minuten: 45 }] })] }
  const neu = { positionen: [p({ arbeitszeit: [{ kostenstelle: 'Zuschnitt', minuten: 56 }] })] }
  assert.deepEqual(diffOffer(alt, neu), [])
})

test('Minuten: 45 → 57 wird NICHT erkannt (26 %, aber nur 12 min absolut)', () => {
  const alt = { positionen: [p({ arbeitszeit: [{ kostenstelle: 'Zuschnitt', minuten: 45 }] })] }
  const neu = { positionen: [p({ arbeitszeit: [{ kostenstelle: 'Zuschnitt', minuten: 57 }] })] }
  assert.deepEqual(diffOffer(alt, neu), [])
})

test('Minuten: 60 → 76 wird erkannt (26 %, 16 min — beide Schwellen erfüllt)', () => {
  const alt = { positionen: [p({ arbeitszeit: [{ kostenstelle: 'Oberfläche', minuten: 60 }] })] }
  const neu = { positionen: [p({ arbeitszeit: [{ kostenstelle: 'Oberfläche', minuten: 76 }] })] }
  const d = diffOffer(alt, neu)
  assert.equal(d.length, 1)
  assert.equal(d[0].art, 'minuten_geaendert')
})

test('Reine vkStunde-Änderung erzeugt KEINE Änderung', () => {
  const alt = { positionen: [p({ arbeitszeit: [{ kostenstelle: 'Zuschnitt', minuten: 45, vkStunde: 72 }] })] }
  const neu = { positionen: [p({ arbeitszeit: [{ kostenstelle: 'Zuschnitt', minuten: 45, vkStunde: 95 }] })] }
  assert.deepEqual(diffOffer(alt, neu), [])
})

test('Reine aufschlag-Änderung erzeugt KEINE Änderung', () => {
  const alt = { positionen: [p({ material: [{ id: 'm1', bezeichnung: 'Eiche massiv', menge: 3, aufschlag: 0.3 }] })] }
  const neu = { positionen: [p({ material: [{ id: 'm1', bezeichnung: 'Eiche massiv', menge: 3, aufschlag: 0.45 }] })] }
  assert.deepEqual(diffOffer(alt, neu), [])
})

test('Kostenstelle entfernt und Kostenstelle neu', () => {
  const alt = { positionen: [p({ arbeitszeit: [{ kostenstelle: 'CNC', minuten: 30 }] })] }
  const neu = { positionen: [p({ arbeitszeit: [{ kostenstelle: 'Zusammenbau', minuten: 30 }] })] }
  const d = diffOffer(alt, neu)
  assert.equal(d.length, 2)
  assert.deepEqual(d.map(x => x.art).sort(), ['kostenstelle_entfernt', 'kostenstelle_neu'])
})

test('Menge: 10 → 13 wird erkannt (30 %), 10 → 11 nicht (10 %)', () => {
  const mk = (menge) => ({ positionen: [p({ material: [{ id: 'm1', bezeichnung: 'Multiplex 18mm', menge }] })] })
  const d = diffOffer(mk(10), mk(13))
  assert.equal(d.length, 1)
  assert.equal(d[0].art, 'menge_geaendert')
  assert.deepEqual(diffOffer(mk(10), mk(11)), [])
})

test('Gelöschte oder neue Position erzeugt keine Änderungen', () => {
  const alt = { positionen: [p({ id: 'p1', material: [{ id: 'm1', bezeichnung: 'HPL 6mm' }] })] }
  const neu = { positionen: [p({ id: 'p2', material: [{ id: 'm9', bezeichnung: 'Multiplex 8mm' }] })] }
  assert.deepEqual(diffOffer(alt, neu), [])
})

test('Leere Eingaben brechen nicht', () => {
  assert.deepEqual(diffOffer({}, {}), [])
  assert.deepEqual(diffOffer({ positionen: [] }, { positionen: [] }), [])
})

test('Änderungsnummern sind lückenlos ab 1', () => {
  const alt = { positionen: [p({ material: [{ id: 'm1', bezeichnung: 'HPL 6mm' }], arbeitszeit: [{ kostenstelle: 'Zuschnitt', minuten: 45 }] })] }
  const neu = { positionen: [p({ material: [{ id: 'm1', bezeichnung: 'Multiplex 8mm' }], arbeitszeit: [{ kostenstelle: 'Zuschnitt', minuten: 90 }] })] }
  const d = diffOffer(alt, neu)
  assert.deepEqual(d.map(x => x.nr), [1, 2])
})
