import { test } from 'node:test'
import assert from 'node:assert/strict'

// Schluessel setzen, BEVOR das Modul geladen wird — es liest ihn je Aufruf,
// aber so ist der Test unabhaengig von der Umgebung.
process.env.GEHEIMNIS_SCHLUESSEL = 'a'.repeat(64)
const { verschluessele, entschluessele, istVerschluesselt, schluesselVorhanden, GeheimnisFehlt }
  = await import('../src/lib/geheimnis.ts')

test('Verschluesseln und wieder lesen ergibt denselben Text', () => {
  const klar = 'mein-smtp-passwort-123!'
  const geheim = verschluessele(klar)
  assert.notEqual(geheim, klar)
  assert.equal(entschluessele(geheim), klar)
})

test('Der Geheimtext enthaelt den Klartext nicht', () => {
  const geheim = verschluessele('Hoellenmaschine42')
  assert.equal(geheim.includes('Hoellenmaschine42'), false)
})

// Zweimal dasselbe Passwort darf nicht zweimal gleich aussehen — sonst liesse
// sich aus der Datenbank ablesen, welche Betriebe dasselbe Passwort benutzen.
test('Derselbe Klartext ergibt zweimal verschiedene Geheimtexte', () => {
  assert.notEqual(verschluessele('gleich'), verschluessele('gleich'))
})

test('Umlaute und Sonderzeichen ueberleben', () => {
  const klar = 'Grüße!#$%&/()=?ßäöü€ 你好'
  assert.equal(entschluessele(verschluessele(klar)), klar)
})

test('Leeres Passwort bleibt leer', () => {
  assert.equal(verschluessele(''), '')
  assert.equal(entschluessele(''), '')
  assert.equal(entschluessele(null), '')
})

// Der wichtigste Test: manipulierter Geheimtext darf NICHT durchgehen.
test('Manipulation wird erkannt', () => {
  const geheim = verschluessele('geheim')
  const teile = geheim.split(':')
  const gefaelscht = Buffer.from(teile[3], 'base64')
  gefaelscht[0] = gefaelscht[0] ^ 0xff
  teile[3] = gefaelscht.toString('base64')
  assert.throws(() => entschluessele(teile.join(':')))
})

test('Altbestand im Klartext kommt unveraendert zurueck', () => {
  assert.equal(istVerschluesselt('altes-passwort'), false)
  assert.equal(entschluessele('altes-passwort'), 'altes-passwort')
})

test('Verschluesselte Werte sind als solche erkennbar', () => {
  assert.equal(istVerschluesselt(verschluessele('x')), true)
})

test('Unvollstaendiger Geheimtext wirft, statt Unsinn zu liefern', () => {
  assert.throws(() => entschluessele('v1:nur-ein-teil'))
})

test('Ohne Schluessel wird nicht stillschweigend weitergemacht', () => {
  const merk = process.env.GEHEIMNIS_SCHLUESSEL
  process.env.GEHEIMNIS_SCHLUESSEL = 'zu-kurz'
  try {
    assert.equal(schluesselVorhanden(), false)
    assert.throws(() => verschluessele('x'), GeheimnisFehlt)
  } finally {
    process.env.GEHEIMNIS_SCHLUESSEL = merk
  }
})
