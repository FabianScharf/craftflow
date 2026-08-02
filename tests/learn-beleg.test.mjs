import { test } from 'node:test'
import assert from 'node:assert/strict'
import { pruefeKandidaten, istAusnahmeNachricht, istGleicheRegel, beschreibeAenderung, enthaeltWortfolge, MIN_ZITAT_ZEICHEN } from '../src/lib/learn.ts'

const AEND = [
  { nr: 1, art: 'material_ersetzt', position: 'Garderobe', vorher: 'HPL 6mm', nachher: 'Multiplex Birke 8mm' },
  { nr: 2, art: 'minuten_geaendert', position: 'Garderobe', kostenstelle: 'Zuschnitt', vorher: 45, nachher: 70 },
]
const CHAT = ['Rückwand bitte immer 8mm Multiplex, nie HPL']

test('Kandidat mit gültigem Diff-Beleg wird übernommen', () => {
  const k = [{ bereich: 'Material', wenn: 'Korpus mit Rückwand', dann: 'Rückwand 8mm Multiplex', belegt_durch: { art: 'diff', nr: 1 } }]
  const r = pruefeKandidaten(k, AEND, CHAT, [], [])
  assert.equal(r.length, 1)
  assert.equal(r[0].bereich, 'Material')
  assert.equal(r[0].wenn, 'Korpus mit Rückwand')
  assert.equal(r[0].aendertRegelId, null)
  assert.match(r[0].belegText, /HPL 6mm/)
})

test('Kandidat mit nicht existierender Diff-Nummer wird verworfen', () => {
  const k = [{ bereich: 'Material', wenn: '', dann: 'Irgendwas', belegt_durch: { art: 'diff', nr: 99 } }]
  assert.deepEqual(pruefeKandidaten(k, AEND, CHAT, [], []), [])
})

test('Kandidat mit Zitat aus dem Chat wird übernommen', () => {
  const k = [{ bereich: 'Konstruktion', wenn: '', dann: 'Nie HPL verwenden', belegt_durch: { art: 'zitat', text: 'nie HPL' } }]
  const r = pruefeKandidaten(k, AEND, CHAT, [], [])
  assert.equal(r.length, 1)
  assert.match(r[0].belegText, /Chat:/)
})

test('Kandidat mit erfundenem Zitat wird verworfen', () => {
  const k = [{ bereich: 'Konstruktion', wenn: '', dann: 'Alles aus Nussbaum', belegt_durch: { art: 'zitat', text: 'immer Nussbaum verwenden' } }]
  assert.deepEqual(pruefeKandidaten(k, AEND, CHAT, [], []), [])
})

test('Zu kurzes Zitat wird verworfen, auch wenn es im Chat vorkommt', () => {
  const chat = ['Die Rueckwand soll anders werden']
  const k = [{ bereich: 'Material', wenn: '', dann: 'Irgendwas', belegt_durch: { art: 'zitat', text: 'die' } }]
  assert.deepEqual(pruefeKandidaten(k, AEND, chat, [], []), [])
})

test('Zitat, das nur mitten in einem Wort trifft, wird verworfen', () => {
  const chat = ['Die Maschinen laufen gut']
  const k = [{ bereich: 'Zeit', wenn: '', dann: 'Irgendwas', belegt_durch: { art: 'zitat', text: 'maschin' } }]
  assert.deepEqual(pruefeKandidaten(k, AEND, chat, [], []), [])
})

test('enthaeltWortfolge trifft nur auf ganze Wortfolgen', () => {
  assert.equal(enthaeltWortfolge('rueckwand immer multiplex nie hpl', 'nie hpl'), true)
  assert.equal(enthaeltWortfolge('die maschinen laufen', 'maschin'), false)
  assert.equal(enthaeltWortfolge('nie hpl', 'nie hpl'), true)
  assert.equal(enthaeltWortfolge('irgendwas', ''), false)
})

test('MIN_ZITAT_ZEICHEN hat den festgelegten Wert', () => {
  assert.equal(MIN_ZITAT_ZEICHEN, 6)
})

test('Kandidat ohne Beleg wird verworfen', () => {
  assert.deepEqual(pruefeKandidaten([{ bereich: 'Material', wenn: '', dann: 'Ohne Beleg' }], AEND, CHAT, [], []), [])
})

test('Unbekannter Bereich wird verworfen', () => {
  const k = [{ bereich: 'Preisfindung', wenn: '', dann: 'Stundensatz 95 Euro', belegt_durch: { art: 'diff', nr: 1 } }]
  assert.deepEqual(pruefeKandidaten(k, AEND, CHAT, [], []), [])
})

test('Leeres dann wird verworfen', () => {
  const k = [{ bereich: 'Material', wenn: 'x', dann: '   ', belegt_durch: { art: 'diff', nr: 1 } }]
  assert.deepEqual(pruefeKandidaten(k, AEND, CHAT, [], []), [])
})

test('Kandidat mit Kundennamen wird verworfen (Datenschutz)', () => {
  const k = [{ bereich: 'Material', wenn: 'bei Müller', dann: 'immer Multiplex', belegt_durch: { art: 'diff', nr: 1 } }]
  assert.deepEqual(pruefeKandidaten(k, AEND, CHAT, ['Müller', 'Rodenbach'], []), [])
})

test('Kurze Kundenwörter filtern nicht versehentlich mit', () => {
  // "Ilm" wäre 3 Zeichen und dürfte filtern; "AG" mit 2 Zeichen darf NICHT
  // dazu führen, dass jede Regel mit "ag" darin (z.B. "Anschlag") stirbt.
  const k = [{ bereich: 'Konstruktion', wenn: '', dann: 'Anschlag immer links', belegt_durch: { art: 'diff', nr: 1 } }]
  assert.equal(pruefeKandidaten(k, AEND, CHAT, ['AG'], []).length, 1)
})

test('Kandidat, der eine bestehende Regel ändert, wird markiert', () => {
  const bestehend = [{ id: 'r1', bereich: 'Material', wenn: 'Korpus mit Rückwand' }]
  const k = [{ bereich: 'Material', wenn: 'korpus mit rueckwand', dann: 'Neu: 10mm', belegt_durch: { art: 'diff', nr: 1 } }]
  // Normalisierung erfasst Gross/Kleinschreibung — Umlaut-Varianten bewusst NICHT.
  const r = pruefeKandidaten(
    [{ bereich: 'Material', wenn: 'Korpus mit Rückwand', dann: 'Neu: 10mm', belegt_durch: { art: 'diff', nr: 1 } }],
    AEND, CHAT, [], bestehend,
  )
  assert.equal(r.length, 1)
  assert.equal(r[0].aendertRegelId, 'r1')
  assert.equal(pruefeKandidaten(k, AEND, CHAT, [], bestehend)[0].aendertRegelId, null)
})

test('Leeres wenn ("gilt immer") gilt NIE als dieselbe Regel', () => {
  // Ein Bereich enthält viele unabhängige Immer-Regeln ("Rückwand immer
  // Multiplex", "Kanten immer ABS"). Würden zwei leere wenn als dieselbe Regel
  // gelten, gäbe es pro Bereich nur eine einzige Immer-Regel — über alle sechs
  // Bereiche also sechs im ganzen Betrieb.
  assert.equal(istGleicheRegel({ bereich: 'Zeit', wenn: '' }, { bereich: 'Zeit', wenn: '  ' }), false)
  assert.equal(istGleicheRegel({ bereich: 'Zeit', wenn: '' }, { bereich: 'Material', wenn: '' }), false)
  assert.equal(istGleicheRegel({ bereich: 'Zeit', wenn: '' }, { bereich: 'Zeit', wenn: 'bei Eiche' }), false)
})

test('Gleiche nicht-leere Bedingung gilt weiterhin als dieselbe Regel', () => {
  assert.equal(istGleicheRegel(
    { bereich: 'Material', wenn: 'Korpus mit Rückwand' },
    { bereich: 'material', wenn: 'korpus mit rückwand.' },
  ), true)
  assert.equal(istGleicheRegel(
    { bereich: 'Material', wenn: 'Korpus mit Rückwand' },
    { bereich: 'Material', wenn: 'Schrank ohne Rückwand' },
  ), false)
})

test('Zwei verschiedene Immer-Regeln im selben Bereich bleiben beide erhalten', () => {
  const k = [
    { bereich: 'Material', wenn: '', dann: 'Rückwand immer 8mm Multiplex Birke', belegt_durch: { art: 'diff', nr: 1 } },
    { bereich: 'Material', wenn: '', dann: 'Kanten immer ABS 2mm', belegt_durch: { art: 'diff', nr: 2 } },
  ]
  const r = pruefeKandidaten(k, AEND, CHAT, [], [])
  assert.equal(r.length, 2)
  assert.deepEqual(r.map(x => x.dann), ['Rückwand immer 8mm Multiplex Birke', 'Kanten immer ABS 2mm'])
  assert.deepEqual(r.map(x => x.aendertRegelId), [null, null])
})

test('Immer-Regel ersetzt nie eine bestehende Immer-Regel', () => {
  const bestehend = [{ id: 'r1', bereich: 'Material', wenn: '' }]
  const k = [{ bereich: 'Material', wenn: '', dann: 'Kanten immer ABS 2mm', belegt_durch: { art: 'diff', nr: 1 } }]
  const r = pruefeKandidaten(k, AEND, CHAT, [], bestehend)
  assert.equal(r.length, 1)
  assert.equal(r[0].aendertRegelId, null)
})

test('Wortgleiche Immer-Regeln im selben Durchlauf fallen trotzdem zusammen', () => {
  const k = [
    { bereich: 'Material', wenn: '', dann: 'Kanten immer ABS 2mm', belegt_durch: { art: 'diff', nr: 1 } },
    { bereich: 'material', wenn: '  ', dann: 'Kanten immer ABS 2mm.', belegt_durch: { art: 'diff', nr: 2 } },
  ]
  const r = pruefeKandidaten(k, AEND, CHAT, [], [])
  assert.equal(r.length, 1)
})

test('Ausnahme-Nachrichten werden erkannt', () => {
  assert.equal(istAusnahmeNachricht('Diesmal bitte HPL, der Kunde will das so'), true)
  assert.equal(istAusnahmeNachricht('Nur bei diesem Projekt anders'), true)
  assert.equal(istAusnahmeNachricht('Ausnahmsweise ohne Bekantung'), true)
  assert.equal(istAusnahmeNachricht('Rückwand immer 8mm Multiplex'), false)
})

test('beschreibeAenderung liefert lesbaren Text für jede Art', () => {
  assert.match(beschreibeAenderung(AEND[0]), /HPL 6mm.*Multiplex Birke 8mm/)
  assert.match(beschreibeAenderung(AEND[1]), /Zuschnitt 45 → 70 min/)
})

test('Nicht-Array als Kandidatenliste bricht nicht', () => {
  assert.deepEqual(pruefeKandidaten(null, AEND, CHAT, [], []), [])
  assert.deepEqual(pruefeKandidaten('kaputt', AEND, CHAT, [], []), [])
})

test('Zwei Kandidaten mit gleichem bereich+wenn im selben Durchlauf: nur der erste bleibt', () => {
  const k = [
    { bereich: 'Material', wenn: 'Korpus mit Rückwand', dann: 'Rückwand 8mm Multiplex', belegt_durch: { art: 'diff', nr: 1 } },
    { bereich: 'material', wenn: 'Korpus mit Rückwand.', dann: 'Rückwand 6mm HPL', belegt_durch: { art: 'zitat', text: 'nie HPL' } },
  ]
  const r = pruefeKandidaten(k, AEND, CHAT, [], [])
  assert.equal(r.length, 1)
  assert.equal(r[0].dann, 'Rückwand 8mm Multiplex')
})
