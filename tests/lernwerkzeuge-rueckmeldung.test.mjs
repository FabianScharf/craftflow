import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  unbelegteWoerter, pruefeRegelInhalt, bereinigeWenn, baueBelegquellen,
} from '../src/lib/lernwerkzeuge.ts'

// Der echte Fall vom 2026-09-06: Fabian nennt die Regel, die KI formuliert sie
// mit einem gewoehnlichen Verb neu — und der Beleg-Test lehnt still ab.
const NUTZER = 'Ich rechne immer 5 % der Materialkosten zusätzlich als Kleinmaterial dazu – Dübel, Schrauben, Leim und so weiter.'

test('Ablehnung nennt genau das nicht belegte Wort', () => {
  const fehlend = unbelegteWoerter('Kleinmaterial mit 5 % der Materialkosten ansetzen.', [NUTZER])
  assert.deepEqual(fehlend, ['ansetzen'])
})

test('Belegte Regel hat keine offenen Woerter', () => {
  assert.deepEqual(unbelegteWoerter('5 % der Materialkosten als Kleinmaterial', [NUTZER]), [])
})

test('Erfundene Zahl taucht als offenes Wort auf', () => {
  assert.ok(unbelegteWoerter('7 % der Materialkosten als Kleinmaterial', [NUTZER]).includes('7'))
})

test('pruefeRegelInhalt bleibt mit unbelegteWoerter im Einklang', () => {
  const dann = 'Kleinmaterial mit 5 % der Materialkosten ansetzen.'
  assert.equal(pruefeRegelInhalt(dann, [NUTZER]), unbelegteWoerter(dann, [NUTZER]).length === 0)
})

// Der Muell, der am 2026-09-06 wirklich in der Datenbank landete.
test('Steuerzeichen im Wenn-Feld werden verworfen', () => {
  const muell = '</parameter>\n<parameter name="dann">5 % der Materialkosten zusätzlich als Kleinmaterial.'
  assert.equal(bereinigeWenn(muell), '')
})

test('Echte Bedingung bleibt unveraendert', () => {
  assert.equal(bereinigeWenn('  Korpus mit Rückwand  '), 'Korpus mit Rückwand')
})

test('Leeres Wenn bleibt leer', () => {
  assert.equal(bereinigeWenn(''), '')
})

// Fabians Entscheidung 2026-09-06: Er bestaetigt den Wortlaut. Damit zaehlt,
// was die KI ihm VORHER gezeigt hat — aber nur aus frueheren Runden, nie aus
// derselben Antwort, in der sie speichern will.
test('Fruehere KI-Nachrichten zaehlen als Belegquelle', () => {
  const quellen = baueBelegquellen(
    ['Egger Dekorspanplatte 19 mm'],
    [{ role: 'user', content: NUTZER },
     { role: 'assistant', content: 'Ich würde das so merken: Kleinmaterial mit 5 % der Materialkosten ansetzen. Passt der Wortlaut?' }],
    'ja',
  )
  assert.equal(pruefeRegelInhalt('Kleinmaterial mit 5 % der Materialkosten ansetzen.', quellen), true)
})

test('Angebotstexte und aktuelle Nachricht sind weiterhin Belegquelle', () => {
  const quellen = baueBelegquellen(['Blum Movento Softclose-Auszug'], [], 'kostet 26,27 EUR')
  assert.ok(quellen.includes('Blum Movento Softclose-Auszug'))
  assert.ok(quellen.includes('kostet 26,27 EUR'))
})
