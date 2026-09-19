import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  anzeigeName, pruefeKommentar, darfSchreiben, fuerDieWebsite,
  KOMMENTAR_MAX, KOMMENTARE_JE_TAG, NAME_ART_STANDARD, NAME_FALLBACK, istNameArt,
} from '../src/lib/kommentare.ts'

const VOLL = { firma_name: 'Tischlerei Lilie', inhaber: 'Constantin Meier', plz: '48145', ort: 'Münster' }

test('Voreingestellt ist die anonymste Form', () => {
  assert.equal(NAME_ART_STANDARD, 'region')
  assert.equal(anzeigeName(undefined, VOLL), 'Schreiner aus 48145')
})

test('Die drei Namensformen', () => {
  assert.equal(anzeigeName('betrieb', VOLL), 'Tischlerei Lilie')
  assert.equal(anzeigeName('vorname', VOLL), 'Constantin')
  assert.equal(anzeigeName('region', VOLL), 'Schreiner aus 48145')
})

test('Vorname heisst Vorname, nicht der ganze Name', () => {
  assert.equal(anzeigeName('vorname', { inhaber: 'Anna Maria Schmitt-Weber', plz: '1' }), 'Anna')
})

// Der Fall, der sonst eine Luecke auf der oeffentlichen Seite ergibt.
test('Fehlt die gewaehlte Angabe, wird es anonymer statt leer', () => {
  assert.equal(anzeigeName('betrieb', { firma_name: '', plz: '63517' }), 'Schreiner aus 63517')
  assert.equal(anzeigeName('vorname', { inhaber: '   ', plz: '63517' }), 'Schreiner aus 63517')
})

test('Ohne jede Angabe bleibt ein Name uebrig', () => {
  assert.equal(anzeigeName('betrieb', {}), NAME_FALLBACK)
  assert.equal(anzeigeName('region', null), NAME_FALLBACK)
})

test('Unsinn in der Wahl faellt auf die Voreinstellung zurueck', () => {
  assert.equal(istNameArt('klarname'), false)
  assert.equal(anzeigeName('klarname', VOLL), 'Schreiner aus 48145')
})

test('Leerer Kommentar wird abgelehnt', () => {
  assert.equal(pruefeKommentar('   ').ok, false)
  assert.equal(pruefeKommentar(null).ok, false)
})

test('Zu langer Kommentar wird abgelehnt, nicht abgeschnitten', () => {
  const r = pruefeKommentar('x'.repeat(KOMMENTAR_MAX + 1))
  assert.equal(r.ok, false)
  assert.match(r.grund, /1001/)
})

test('Normaler Kommentar kommt getrimmt durch', () => {
  const r = pruefeKommentar('  Bei mir ist das genauso.  ')
  assert.deepEqual(r, { ok: true, text: 'Bei mir ist das genauso.' })
})

test('Die Tagesgrenze greift erst beim Ueberschreiten', () => {
  assert.equal(darfSchreiben(KOMMENTARE_JE_TAG - 1).ok, true)
  assert.equal(darfSchreiben(KOMMENTARE_JE_TAG).ok, false)
})

// Der wichtigste Test: was die App nach draussen gibt.
test('Nach aussen geht ein Name, nie die user_id', () => {
  const zeilen = [
    { id: 'k1', wunsch_id: 'w1', user_id: 'u1', text: 'Fehlt mir auch.', created_at: '2026-09-19T10:00:00Z' },
    { id: 'k2', wunsch_id: 'w1', user_id: 'u2', text: 'Kommt im Oktober.', created_at: '2026-09-19T11:00:00Z', vom_entwickler: true },
  ]
  const raus = fuerDieWebsite(zeilen, { u1: 'betrieb' }, { u1: VOLL })
  assert.equal(raus[0].autor, 'Tischlerei Lilie')
  assert.equal(raus[1].autor, 'CraftFlow')
  assert.equal(raus[1].vomEntwickler, true)
  const alsText = JSON.stringify(raus)
  assert.equal(alsText.includes('u1'), false)
  assert.equal(alsText.includes('u2'), false)
})

// Fabians Entscheidung „nur einmal waehlen": die Wahl wirkt rueckwirkend.
test('Wer auf anonym umstellt, wird auch rueckwirkend anonym', () => {
  const zeile = [{ id: 'k1', wunsch_id: 'w1', user_id: 'u1', text: 'Test', created_at: '2026-09-19T10:00:00Z' }]
  assert.equal(fuerDieWebsite(zeile, { u1: 'betrieb' }, { u1: VOLL })[0].autor, 'Tischlerei Lilie')
  assert.equal(fuerDieWebsite(zeile, { u1: 'region' }, { u1: VOLL })[0].autor, 'Schreiner aus 48145')
})

test('Ohne Kommentare kommt eine leere Liste, kein Fehler', () => {
  assert.deepEqual(fuerDieWebsite([], {}, {}), [])
  assert.deepEqual(fuerDieWebsite(undefined, {}, {}), [])
})
