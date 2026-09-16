import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  MAX_BYTES, ERLAUBTE_TYPEN, ERLAUBTE_ENDUNGEN,
  sichererName, pruefeDatei, zaehltGegenDeckel, bauePfad,
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
