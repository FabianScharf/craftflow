import { test } from 'node:test'
import assert from 'node:assert/strict'
import { vergleichsstandFehlt, istUngespeichert } from '../src/lib/speicherstand.ts'

// Ein Stand ist ein JSON-Abbild des Angebots. Für die Regel zählt nur, ob zwei
// Stände gleich sind — deshalb reichen hier kurze Platzhalter.
const LEERES_FORMULAR = JSON.stringify({ kunde: { name: '' }, pos: [] })
const MIT_POSITION = JSON.stringify({ kunde: { name: '' }, pos: [{ titel: 'Einbauschrank' }] })
const GEAENDERT = JSON.stringify({ kunde: { name: '' }, pos: [{ titel: 'Einbauschrank', minuten: 660 }] })

test('Im Angebot ohne Vergleichsstand: es fehlt einer', () => {
  assert.equal(vergleichsstandFehlt('app', ''), true)
})

test('Im Angebot mit Vergleichsstand: alles in Ordnung', () => {
  assert.equal(vergleichsstandFehlt('app', LEERES_FORMULAR), false)
})

// Der Startbildschirm ist der Grund, warum es den leeren Wert überhaupt gibt.
test('Auf dem Startbildschirm fehlt nichts — dort ist leer richtig', () => {
  assert.equal(vergleichsstandFehlt('start', ''), false)
})

test('Auf keinem anderen Bildschirm wird ein Stand erzwungen', () => {
  for (const b of ['pdf', 'pdf-preview', 'projekte']) {
    assert.equal(vergleichsstandFehlt(b, ''), false, b)
  }
})

test('Gleicher Stand heisst gespeichert', () => {
  assert.equal(istUngespeichert(MIT_POSITION, MIT_POSITION), false)
})

test('Abweichender Stand heisst ungespeichert', () => {
  assert.equal(istUngespeichert(MIT_POSITION, GEAENDERT), true)
})

test('Ohne Vergleichsstand meldet sich nichts — genau das war die Falle', () => {
  assert.equal(istUngespeichert('', GEAENDERT), false)
})

// Der Fehler vom 19.09.2026, einmal als ganzer Ablauf.
test('Von Hand angelegtes Angebot: erste Änderung muss sich melden', () => {
  // 1. Der Nutzer klickt „Manuell eingeben". Kein Projekt geladen, keine
  //    Analyse gelaufen — vorher blieb der Vergleichsstand hier leer.
  let vergleich = ''
  let jetzt = LEERES_FORMULAR

  // 2. Weil er im Angebot steht, wird der leere Stand als Ausgangspunkt gemerkt.
  assert.equal(vergleichsstandFehlt('app', vergleich), true)
  vergleich = jetzt

  // 3. Das leere Formular allein ist noch nichts Ungespeichertes.
  assert.equal(istUngespeichert(vergleich, jetzt), false)

  // 4. Er legt eine Position an — ab hier muss die Leiste kommen.
  jetzt = MIT_POSITION
  assert.equal(istUngespeichert(vergleich, jetzt), true)

  // 5. Er speichert. Danach ist wieder Ruhe.
  vergleich = jetzt
  assert.equal(istUngespeichert(vergleich, jetzt), false)

  // 6. Er ändert eine Zeit — und wird wieder gewarnt.
  jetzt = GEAENDERT
  assert.equal(istUngespeichert(vergleich, jetzt), true)
})

// Der Fehler vom 06.09.2026, damit er nicht ein drittes Mal kommt.
test('Geladenes Projekt: Zeiten ändern muss sich melden', () => {
  const vergleich = MIT_POSITION // beim Laden gesetzt
  assert.equal(vergleichsstandFehlt('app', vergleich), false)
  assert.equal(istUngespeichert(vergleich, GEAENDERT), true)
})
