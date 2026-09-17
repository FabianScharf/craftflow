import { test } from 'node:test'
import assert from 'node:assert/strict'
import { einladungsMail, KONTAKT_MAIL, APP_URL } from '../src/lib/mail/vorlagen.ts'

// Die Einladungsmail hat genau eine Aufgabe: den Empfänger auf den Link bringen.
// Ohne Link ist sie wertlos — deshalb steht er in HTML UND Text (viele
// Mail-Programme zeigen nur die Textfassung).
const LINK = 'https://app.getcraftflow.de/einladung/11111111-2222-3333-4444-555555555555'

test('Betreff nennt den Betrieb, Link steht in HTML und Text', () => {
  const m = einladungsMail({ betriebName: 'Schreinerei Muster', einladerEmail: 'chef@muster.de', link: LINK })
  assert.equal(m.subject, 'Schreinerei Muster lädt dich zu CraftFlow ein')
  assert.ok(m.html.includes(LINK), 'HTML ohne Einladungslink')
  assert.ok(m.text.includes(LINK), 'Text ohne Einladungslink')
})

// Der häufigste Stolperstein: Der Empfänger registriert sich mit einer anderen
// Adresse, und /api/team/annehmen lehnt ab ("gilt für eine andere E-Mail-Adresse").
// Der Hinweis muss deshalb in der Mail stehen, nicht erst im Fehlerfall.
test('Mail sagt, dass genau diese E-Mail-Adresse gilt', () => {
  const m = einladungsMail({ betriebName: 'Muster', einladerEmail: 'chef@muster.de', link: LINK })
  for (const feld of [m.html, m.text]) {
    assert.ok(feld.includes('genau dieser E-Mail-Adresse'), 'Hinweis auf die Adresse fehlt')
  }
})

test('Der Einlader und der Kontakt stehen in der Mail', () => {
  const m = einladungsMail({ betriebName: 'Muster', einladerEmail: 'chef@muster.de', link: LINK })
  assert.ok(m.html.includes('chef@muster.de'))
  assert.ok(m.text.includes('chef@muster.de'))
  assert.ok(m.html.includes(KONTAKT_MAIL))
  assert.ok(m.text.includes(KONTAKT_MAIL))
  assert.ok(m.subject.length > 10 && m.subject.length < 90, 'Betreff unbrauchbar lang/kurz')
})

// Ein Konto kann /settings erreichen, ohne je einen Firmennamen eingetragen zu
// haben. Dann darf im Betreff kein „null lädt dich ein" stehen.
test('Ohne Firmennamen tritt die Adresse des Einladers an dessen Stelle', () => {
  for (const name of [null, undefined, '   ']) {
    const m = einladungsMail({ betriebName: name, einladerEmail: 'chef@muster.de', link: LINK })
    assert.equal(m.subject, 'chef@muster.de lädt dich zu CraftFlow ein')
    assert.ok(!/null|undefined/.test(m.subject))
    assert.ok(!/null|undefined/.test(m.text))
  }
})

// Der Firmenname kommt aus einem Eingabefeld des Inhabers und landet in HTML.
// Ungeschützt wäre die Mail ein Träger für fremdes Markup.
test('Spitze Klammern im Firmennamen kommen entschärft im HTML an', () => {
  const m = einladungsMail({ betriebName: '<script>alert(1)</script>Muster', einladerEmail: 'a@b.de', link: LINK })
  assert.ok(!m.html.includes('<script>'), 'rohes Markup im HTML')
  assert.ok(m.html.includes('&lt;script&gt;'), 'Firmenname nicht maskiert')
})

// Kein Markdown in Mails — Sternchen und Rauten kämen beim Empfänger roh an.
test('Kein Markdown in der Textfassung', () => {
  const m = einladungsMail({ betriebName: 'Muster', einladerEmail: 'a@b.de', link: LINK })
  assert.ok(!/\*\*|^#+\s/m.test(m.text), 'Markdown im Text')
})

// Der Link zeigt auf die App, nicht auf die Website — dort gibt es /einladung nicht.
test('Der Einladungslink liegt unter der App-Adresse', () => {
  assert.ok(LINK.startsWith(APP_URL + '/einladung/'))
})
