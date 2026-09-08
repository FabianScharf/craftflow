import { test } from 'node:test'
import assert from 'node:assert/strict'
import { willkommensMail, neuigkeitenMail, STARTHILFE_URL } from '../src/lib/mail/vorlagen.ts'

// Beide Mails führen zur Starthilfe — ohne den Link wären sie sinnlos.
test('Beide Vorlagen verlinken die Starthilfe, in HTML und Text', () => {
  for (const m of [willkommensMail(), neuigkeitenMail()]) {
    assert.ok(m.html.includes(STARTHILFE_URL), 'HTML ohne Starthilfe-Link')
    assert.ok(m.text.includes(STARTHILFE_URL), 'Text ohne Starthilfe-Link')
  }
})

// Die Kapitel-Anker sind der Vertrag mit der Website (app/willkommen/page.tsx).
test('Die Neuigkeiten-Mail nutzt nur Kapitel-Anker, die es auf der Website gibt', () => {
  const erlaubt = ['prinzip', 'einrichtung', 'beschreiben', 'ergebnis', 'optimierung', 'check', 'angebot', 'praxis', 'faq']
  const anker = [...neuigkeitenMail().html.matchAll(/willkommen#([a-z]+)/g)].map(m => m[1])
  assert.ok(anker.length > 0, 'keine Anker gefunden')
  for (const a of anker) assert.ok(erlaubt.includes(a), `Unbekannter Anker #${a}`)
})

test('Willkommens-Mail: Anrede mit und ohne Firmenname', () => {
  assert.ok(willkommensMail({ firma: 'Schreinerei Muster' }).html.includes('Schreinerei Muster'))
  assert.ok(willkommensMail({ firma: '  ' }).html.includes('Hallo und willkommen bei CraftFlow!'))
  assert.ok(willkommensMail().text.startsWith('Hallo und willkommen bei CraftFlow!'))
})

// Kein Markdown in Mails — Sternchen und Rauten kämen beim Empfänger roh an.
test('Kein Markdown in den Textfassungen', () => {
  for (const m of [willkommensMail(), neuigkeitenMail()]) {
    assert.ok(!/\*\*|^#+\s/m.test(m.text), 'Markdown im Text')
  }
})

// Die Info-Mail geht an Bestandskunden — sie muss sagen, warum sie kommt, und
// einen Ausweg nennen.
test('Neuigkeiten-Mail nennt Grund und Abmeldemöglichkeit', () => {
  const m = neuigkeitenMail()
  assert.ok(m.html.includes('weil du ein CraftFlow-Konto hast'))
  assert.ok(m.text.includes('keine Infos'))
})

test('Kontakt steht in jeder Mail', () => {
  for (const m of [willkommensMail(), neuigkeitenMail()]) {
    assert.ok(m.html.includes('anfrage@fscrafted.de'))
    assert.ok(m.text.includes('anfrage@fscrafted.de'))
    assert.ok(m.subject.length > 10 && m.subject.length < 90, 'Betreff unbrauchbar lang/kurz')
  }
})
