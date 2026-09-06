import { test } from 'node:test'
import assert from 'node:assert/strict'
import { brauchbarerText } from '../src/lib/chatantwort.ts'

// Der Text, den das Modell am 2026-09-06 wirklich lieferte — inhaltlich richtig,
// nur ohne JSON-Umschlag. Er wurde verworfen.
const ECHT = 'Das ist eine sinnvolle Regel. Soll ich sie so merken:\n\n'
  + '"Wenn Materialkosten vorhanden → 5 % der Materialkosten als Kleinmaterial-Pauschale hinzufügen"\n\n'
  + 'Passt der Wortlaut so?'

test('Reiner Text wird durchgereicht statt verworfen', () => {
  assert.equal(brauchbarerText(ECHT), ECHT.trim())
})

test('Leerer Text ergibt nichts', () => {
  assert.equal(brauchbarerText(''), null)
  assert.equal(brauchbarerText('   \n '), null)
})

test('Angefangenes JSON wird nicht durchgereicht', () => {
  assert.equal(brauchbarerText('{"message":"Kantenband fehlt'), null)
})

test('Text mit JSON-Innereien wird nicht durchgereicht', () => {
  assert.equal(brauchbarerText('Hier die Aenderung: "updatedOffer": {"positionen"'), null)
})

test('Codeblock wird nicht durchgereicht', () => {
  assert.equal(brauchbarerText('```json\n{"message":"x"}\n```'), null)
})
