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

import { notNachricht } from '../src/lib/chatantwort.ts'

// Der Rohtext aus dem Vercel-Log vom 2026-09-06 15:17: gueltig aussehendes JSON,
// das an EINEM geraden Anfuehrungszeichen mitten in der Nachricht zerbricht.
const KAPUTT = '{"message":"Verstanden. Soll ich folgende Regel dauerhaft merken?\\n\\n'
  + '„Wenn Materialkosten berechnet werden → 5 % als Kleinmaterial aufschlagen."\\n\\n'
  + 'Passt der Wortlaut so?","updatedOffer":null}'

test('Nachricht wird aus zerbrochenem JSON gerettet', () => {
  const r = notNachricht(KAPUTT)
  assert.ok(r)
  assert.match(r.message, /^Verstanden\. Soll ich folgende Regel dauerhaft merken\?/)
  assert.match(r.message, /Passt der Wortlaut so\?$/)
  assert.equal(r.updatedOffer, null)
})

test('Zeilenumbrueche kommen als echte Umbrueche zurueck', () => {
  assert.ok(notNachricht(KAPUTT).message.includes('\n\n'))
  assert.ok(!notNachricht(KAPUTT).message.includes('\\n'))
})

test('Ein zerbrochenes updatedOffer wird NICHT uebernommen', () => {
  const r = notNachricht('{"message":"Eingetragen","updatedOffer":{"positionen":[{"id":"a"')
  assert.equal(r.updatedOffer, null)
  assert.equal(r.message, 'Eingetragen')
})

test('Ohne message-Feld gibt es nichts zu retten', () => {
  assert.equal(notNachricht('{"foo":"bar"}'), null)
  assert.equal(notNachricht('einfach nur Text'), null)
})
