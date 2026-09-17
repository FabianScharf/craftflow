import { test } from 'node:test'
import assert from 'node:assert/strict'
import { tag3Faellig, tag3Mail, vornameAus, TAG3_AB, TAG3_MERKER, WHATSAPP_NUMMER } from '../src/lib/mail/tag3.ts'

const jetzt = new Date('2026-09-20T07:00:00Z')
const konto = (over = {}) => ({ created_at: '2026-09-16T10:00:00Z', email_confirmed_at: '2026-09-16T10:05:00Z', email: 'a@b.de', meta: {}, ...over })

test('faellig nach drei Tagen, bestaetigt, ohne Merker, nach dem Stichtag', () => {
  assert.equal(tag3Faellig(konto(), jetzt).faellig, true)
})
test('nicht faellig: zu jung, Bestandskonto, unbestaetigt, schon gesendet, zu alt', () => {
  assert.equal(tag3Faellig(konto({ created_at: '2026-09-18T10:00:00Z' }), jetzt).faellig, false)
  assert.equal(tag3Faellig(konto({ created_at: '2026-09-11T10:00:00Z' }), jetzt).grund, 'Bestandskonto')
  assert.ok(new Date('2026-09-11T10:00:00Z') < new Date(TAG3_AB))
  assert.equal(tag3Faellig(konto({ email_confirmed_at: null }), jetzt).faellig, false)
  assert.equal(tag3Faellig(konto({ meta: { [TAG3_MERKER]: '2026-09-19' } }), jetzt).grund, 'bereits gesendet')
  assert.equal(tag3Faellig(konto({ created_at: '2026-09-15T10:00:00Z' }), new Date('2026-10-05T00:00:00Z')).grund, 'Testphase vorbei')
})
test('Sofortversand: mindestTage 0 macht ein zwei Tage altes Konto faellig', () => {
  assert.equal(tag3Faellig(konto({ created_at: '2026-09-18T10:00:00Z' }), jetzt, 0).faellig, true)
})
test('Vorname aus dem Inhaberfeld', () => {
  assert.equal(vornameAus('Max Mustermann'), 'Max')
  assert.equal(vornameAus('  Leonie  '), 'Leonie')
  assert.equal(vornameAus('GmbH & Co.'), 'GmbH')
  assert.equal(vornameAus(''), '')
  assert.equal(vornameAus(null), '')
})
test('Die Mail traegt Anrede, vier Tipps, WhatsApp-Link, Portrait und Impressum', () => {
  const m = tag3Mail({ inhaber: 'Max Mustermann' })
  assert.equal(m.subject, 'Wie läuft es mit CraftFlow, Max?')
  assert.match(m.html, /Hallo Max, läuft alles\?/)
  assert.equal((m.html.match(/border-top:1px solid #E6DDD1;font-family:Georgia/g) || []).length, 4)
  assert.match(m.html, new RegExp(`https://wa.me/${WHATSAPP_NUMMER}\\?text=`))
  assert.match(m.html, /getcraftflow\.de\/fabian\.jpg/)
  assert.match(m.html, /Impressum/)
  assert.match(m.text, /WhatsApp/)
  assert.doesNotMatch(m.html, /Nachkalkulation/)
  const ohne = tag3Mail({})
  assert.equal(ohne.subject, 'Wie läuft es mit CraftFlow?')
  assert.match(ohne.html, /Hallo, läuft alles\?/)
})
