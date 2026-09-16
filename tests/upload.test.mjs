import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  MAX_BYTES, ERLAUBTE_TYPEN, ERLAUBTE_ENDUNGEN,
  sichererName, pruefeDatei, zaehltGegenDeckel, bauePfad, istUuid, bildMedientyp,
} from '../src/lib/upload.ts'

test('Grenzen wörtlich aus der Spec: 10 MB, JPG/PNG/WEBP/PDF', () => {
  assert.equal(MAX_BYTES, 10 * 1024 * 1024)
  assert.deepEqual(ERLAUBTE_TYPEN, ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
  assert.deepEqual(ERLAUBTE_ENDUNGEN, ['.jpg', '.jpeg', '.png', '.webp', '.pdf'])
})

test('sichererName entfernt Pfadtrenner und Sonderzeichen', () => {
  assert.equal(sichererName('../../etc/passwd'), '..-..-etc-passwd')
  assert.equal(sichererName('Küchenfoto (1).jpg'), 'K_chenfoto _1_.jpg')
  assert.equal(sichererName(''), 'datei')
  // @ts-expect-error absichtlich ein Nicht-String, wie es aus unsicherem Input kommen kann
  assert.equal(sichererName(null), 'datei')
})

test('sichererName kürzt sehr lange Namen von vorn (Endung bleibt erhalten)', () => {
  const lang = 'a'.repeat(100) + '.png'
  const kurz = sichererName(lang)
  assert.equal(kurz.length, 80)
  assert.ok(kurz.endsWith('.png'))
})

test('pruefeDatei: zu groß wird abgelehnt', () => {
  const zuGross = { name: 'plan.pdf', size: MAX_BYTES + 1, type: 'application/pdf' }
  assert.deepEqual(pruefeDatei(zuGross), { ok: false, error: '„plan.pdf“ ist größer als 10 MB.' })
})

test('pruefeDatei: genau 10 MB ist noch erlaubt', () => {
  assert.deepEqual(pruefeDatei({ name: 'plan.pdf', size: MAX_BYTES, type: 'application/pdf' }), { ok: true })
})

test('pruefeDatei: erlaubte Typen gehen durch, egal ob per MIME-Typ oder Endung erkannt', () => {
  assert.deepEqual(pruefeDatei({ name: 'foto.jpg', size: 1000, type: 'image/jpeg' }), { ok: true })
  assert.deepEqual(pruefeDatei({ name: 'foto.png', size: 1000, type: 'image/png' }), { ok: true })
  assert.deepEqual(pruefeDatei({ name: 'foto.webp', size: 1000, type: 'image/webp' }), { ok: true })
  assert.deepEqual(pruefeDatei({ name: 'angebot.pdf', size: 1000, type: 'application/pdf' }), { ok: true })
  // Browser liefert manchmal keinen/falschen MIME-Typ — die Endung reicht dann.
  assert.deepEqual(pruefeDatei({ name: 'foto.PNG', size: 1000, type: '' }), { ok: true })
})

test('pruefeDatei: falscher Typ wird mit lesbarem Text abgelehnt', () => {
  assert.deepEqual(
    pruefeDatei({ name: 'plan.dwg', size: 1000, type: 'application/octet-stream' }),
    { ok: false, error: '„plan.dwg“ ist kein Bild und kein PDF. Erlaubt sind JPG, PNG, WEBP und PDF.' },
  )
  assert.deepEqual(
    pruefeDatei({ name: 'ohne-endung', size: 1000, type: '' }),
    { ok: false, error: '„ohne-endung“ ist kein Bild und kein PDF. Erlaubt sind JPG, PNG, WEBP und PDF.' },
  )
})

test('zaehltGegenDeckel: führender Unterstrich zählt nicht (interne Zwischenstände)', () => {
  assert.equal(zaehltGegenDeckel('foto.jpg'), true)
  assert.equal(zaehltGegenDeckel('_vorbereitet.json'), false)
})

test('bauePfad: <user_id>/<projekt_id>/<uuid>-<sicherer Name>', () => {
  assert.equal(
    bauePfad('u1', 'p1', 'uuid-123', 'Küchenfoto (1).jpg'),
    'u1/p1/uuid-123-K_chenfoto _1_.jpg',
  )
})

test('istUuid: erkennt gültige UUIDs, lehnt Pfad-Traversal und Unsinn ab', () => {
  assert.equal(istUuid('550e8400-e29b-41d4-a716-446655440000'), true)
  assert.equal(istUuid('550E8400-E29B-41D4-A716-446655440000'), true, 'Groß-/Kleinschreibung egal')
  assert.equal(istUuid('a/b'), false)
  assert.equal(istUuid('../x'), false)
  assert.equal(istUuid(''), false)
  assert.equal(istUuid('nicht-mal-annaehernd-eine-uuid'), false)
  // Version (13. Stelle) muss 1–5 sein, Variante (17. Stelle) 8/9/a/b — sonst keine echte UUID.
  assert.equal(istUuid('550e8400-e29b-61d4-a716-446655440000'), false, 'ungültige Version 6')
  assert.equal(istUuid('550e8400-e29b-41d4-c716-446655440000'), false, 'ungültige Variante c')
})

test('bildMedientyp: erkennt PNG, JPEG und WebP an den Magic Bytes — Dateiname egal', () => {
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  assert.equal(bildMedientyp(png, 'foto.jpg'), 'image/png', 'Bytes zählen mehr als eine falsche Endung')

  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10])
  assert.equal(bildMedientyp(jpeg, 'foto.png'), 'image/jpeg')

  const webp = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50])
  assert.equal(bildMedientyp(webp, 'foto.bin'), 'image/webp')
})

test('bildMedientyp: ohne erkennbare Magic Bytes entscheidet die Dateiendung', () => {
  const leer = new Uint8Array([0x00, 0x00, 0x00, 0x00])
  assert.equal(bildMedientyp(leer, 'foto.PNG'), 'image/png', 'Groß-/Kleinschreibung der Endung egal')
  assert.equal(bildMedientyp(leer, 'foto.jpeg'), 'image/jpeg')
  assert.equal(bildMedientyp(leer, 'foto.webp'), 'image/webp')
})

test('bildMedientyp: weder Bytes noch Endung eindeutig → null, nie geraten', () => {
  const leer = new Uint8Array([0x00, 0x00, 0x00, 0x00])
  assert.equal(bildMedientyp(leer, 'plan.dwg'), null)
  assert.equal(bildMedientyp(leer, 'ohne-endung'), null)
  assert.equal(bildMedientyp(new Uint8Array([]), 'foto.gif'), null)
})
