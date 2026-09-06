import { test } from 'node:test'
import assert from 'node:assert/strict'
import { unsichereBetragsangabe } from '../src/lib/lernwerkzeuge.ts'

// Fabians echter Satz vom 2026-09-06. Daraus wurde eine harte 60,00 €.
const UNSICHER = 'Eine Eiche Lade in der Groesse kostet ca. 60 EUR pro Stueck'
// Sein Satz zum Movento — eindeutig, der darf fixiert werden.
const SICHER = 'Der Blum Movento kostet mich 26,27 EUR, merk dir das'

test('„ca." vor dem Betrag macht ihn unsicher', () => {
  assert.equal(unsichereBetragsangabe(60, [UNSICHER]), true)
})

test('Ein glatt genannter Preis bleibt fixierbar', () => {
  assert.equal(unsichereBetragsangabe(26.27, [SICHER]), false)
})

test('„kommt auf Groesse und Holzart an" NACH dem Betrag zaehlt auch', () => {
  assert.equal(unsichereBetragsangabe(60, ['kostet 60 EUR, kommt auf Groesse und Holzart an']), true)
})

test('„je nach" nach dem Betrag zaehlt', () => {
  assert.equal(unsichereBetragsangabe(60, ['60 EUR je nach Ausfuehrung']), true)
})

test('Eine Spanne ist unsicher', () => {
  assert.equal(unsichereBetragsangabe(70, ['die liegen zwischen 50 und 70 EUR']), true)
})

test('Wird der Betrag spaeter genau genannt, gilt er', () => {
  assert.equal(unsichereBetragsangabe(62, [UNSICHER, 'Ich habe nachgesehen: genau 62 EUR']), false)
})

test('Kein Treffer in den Nutzerworten heisst nicht unsicher (Handeingabe im Formular)', () => {
  assert.equal(unsichereBetragsangabe(41.5, ['merk dir den Preis aus der Zeile']), false)
})

test('160 ist nicht 60 — keine Verwechslung', () => {
  assert.equal(unsichereBetragsangabe(60, ['die Platte kostet ca. 160 EUR']), false)
})

test('Komma- und Punktschreibweise werden beide gefunden', () => {
  assert.equal(unsichereBetragsangabe(26.27, ['ungefaehr 26,27 EUR']), true)
  assert.equal(unsichereBetragsangabe(26.27, ['ungefaehr 26.27 EUR']), true)
})
