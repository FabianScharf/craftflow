import { test } from 'node:test'
import assert from 'node:assert/strict'
import { pruefeRegelInhalt, pruefePreisInhalt, WERKZEUGE } from '../src/lib/lernwerkzeuge.ts'

// Belegquellen = Materialbezeichnungen der echten Kalkulation + Nachrichten des Nutzers.
const QUELLEN = [
  'Rückwand Spanplatte 8 mm',
  'Blum Movento Softclose-Auszug inkl. Montage',
  'Egger Anthrazit Dekorspanplatte 19 mm',
  'Der Blum Movento kostet mich 26,27 EUR, ändere den Preis und merke dir das',
  'Die Rückwand wird bei mir standardmäßig aus einer 8mm Spanplatte gefertigt',
]

test('Regel mit belegtem Inhalt wird angenommen', () => {
  assert.equal(pruefeRegelInhalt('Rückwände aus Spanplatte 8 mm', QUELLEN), true)
})

test('Regel mit erfundener Holzart wird abgelehnt', () => {
  assert.equal(pruefeRegelInhalt('Rückwände aus Nussbaum massiv', QUELLEN), false)
})

test('Nie erwaehnte Materialstaerke wird abgelehnt', () => {
  assert.equal(pruefeRegelInhalt('Rückwände aus Spanplatte 22 mm', QUELLEN), false)
})

// Dokumentiert eine bewusste Grenze: geprueft werden Woerter, nicht Bedeutung.
// "19 mm" steht im Angebot (Egger-Seitenteile), also gilt es als belegt — auch
// in einer Regel ueber Rueckwaende. Dagegen schuetzt die Rueckfrage an den
// Nutzer, nicht dieser Filter.
test('Falsch zugeordnete, aber vorhandene Zahl passiert den Filter', () => {
  assert.equal(pruefeRegelInhalt('Rückwände aus Spanplatte 19 mm', QUELLEN), true)
})

test('Plural findet den Singular aus der Kalkulation', () => {
  assert.equal(pruefeRegelInhalt('Rückwände immer aus Spanplatte', QUELLEN), true)
})

// Der deutsche Umlaut-Plural wechselt den Vokal (Rückwand -> Rückwände).
// Ohne Umlaut-Aufloesung wuerde JEDE allgemein formulierte Regel abgelehnt.
test('Umlaut-Plural wird erkannt', () => {
  assert.equal(pruefeRegelInhalt('Auszüge von Blum Movento', QUELLEN), true)
  assert.equal(pruefeRegelInhalt('Auszüge von Hettich Quadro', QUELLEN), false)
})

test('Erfundener Kontext wird abgelehnt — der stimme-Fall', () => {
  assert.equal(pruefeRegelInhalt('Im Altbau mit Fußbodenheizung immer Multiplex', QUELLEN), false)
})

test('Leere Quellen lehnen alles ab', () => {
  assert.equal(pruefeRegelInhalt('Rückwände aus Spanplatte', []), false)
})

test('Leerer Regelinhalt wird abgelehnt', () => {
  assert.equal(pruefeRegelInhalt('   ', QUELLEN), false)
})

test('Preis aus dem Chat wird angenommen, Komma wie Punkt', () => {
  assert.equal(pruefePreisInhalt('Blum Movento', 26.27, QUELLEN), true)
})

test('Erfundener Preis wird abgelehnt', () => {
  assert.equal(pruefePreisInhalt('Blum Movento', 99.0, QUELLEN), false)
})

test('Preis fuer nie erwaehntes Material wird abgelehnt', () => {
  assert.equal(pruefePreisInhalt('Hettich Quadro', 26.27, QUELLEN), false)
})

test('Beide Werkzeuge sind strict und geschlossen definiert', () => {
  assert.equal(WERKZEUGE.length, 2)
  const namen = WERKZEUGE.map(w => w.name).sort()
  assert.deepEqual(namen, ['preis_merken', 'regel_merken'])
  for (const w of WERKZEUGE) {
    assert.equal(w.strict, true, `${w.name} muss strict sein`)
    assert.equal(w.input_schema.additionalProperties, false, `${w.name} darf keine Extrafelder erlauben`)
    assert.ok(Array.isArray(w.input_schema.required) && w.input_schema.required.length > 0)
  }
})

test('regel_merken kennt genau die sechs erlaubten Bereiche', () => {
  const w = WERKZEUGE.find(x => x.name === 'regel_merken')
  assert.deepEqual([...w.input_schema.properties.bereich.enum],
    ['Material', 'Konstruktion', 'Zeit', 'Oberfläche', 'Montage', 'Sonstiges'])
})
