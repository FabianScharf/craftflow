import { test } from 'node:test'
import assert from 'node:assert/strict'
import { emailGueltig, normalisiereEmail, plaetzeFrei, sortiereNachAnnahme, TEAM_TEXTE } from '../src/lib/team.ts'

test('E-Mail-Prüfung: eine Adresse braucht eine echte Domain', () => {
  assert.equal(emailGueltig('a@b.de'), true)
  assert.equal(emailGueltig('vorname.nachname+team@firma.co.uk'), true)
  assert.equal(emailGueltig('a@b'), false)
  assert.equal(emailGueltig('a@b.d'), false)
  assert.equal(emailGueltig('ab.de'), false)
  assert.equal(emailGueltig('a b@firma.de'), false)
  assert.equal(emailGueltig(''), false)
  assert.equal(emailGueltig('a@@b.de'), false)
})

test('E-Mail wird kleingeschrieben und getrimmt (unique (inhaber_id, email))', () => {
  assert.equal(normalisiereEmail(' A@B.DE '), 'a@b.de')
  assert.equal(normalisiereEmail('Chef@Firma.De'), 'chef@firma.de')
})

test('plaetzeFrei: der Inhaber belegt immer den ersten Platz', () => {
  // Pro = 3 Nutzer: Inhaber + 1 aktives + 1 eingeladenes Mitglied → voll.
  assert.deepEqual(plaetzeFrei('pro', 1, 1), { frei: 0, voll: true })
  assert.deepEqual(plaetzeFrei('pro', 0, 0), { frei: 2, voll: false })
  assert.deepEqual(plaetzeFrei('pro', 1, 0), { frei: 1, voll: false })
  // Enterprise = unbegrenzt: nie voll, frei bleibt unbekannt (null).
  assert.deepEqual(plaetzeFrei('enterprise', 9, 9), { frei: null, voll: false })
  // Solo/Starter = 1 Nutzer: kein Platz für Mitarbeiter, auch ohne Mitglieder.
  assert.deepEqual(plaetzeFrei('solo', 0, 0), { frei: 0, voll: true })
  assert.deepEqual(plaetzeFrei('starter', 0, 0), { frei: 0, voll: true })
  // Gesperrt (Testphase vorbei): erst recht kein Platz.
  assert.deepEqual(plaetzeFrei('gesperrt', 0, 0), { frei: 0, voll: true })
})

test('plaetzeFrei rutscht nie unter 0 (Wechsel nach unten mit zu vielen Mitgliedern)', () => {
  assert.deepEqual(plaetzeFrei('solo', 4, 0), { frei: 0, voll: true })
  assert.deepEqual(plaetzeFrei('pro', 5, 2), { frei: 0, voll: true })
})

test('sortiereNachAnnahme: älteste Annahme zuerst, Eingeladene hinten, ohne die Eingabe zu ändern', () => {
  const a = { id: 'a', angenommen_am: '2026-02-01T00:00:00Z', eingeladen_am: '2026-01-01T00:00:00Z' }
  const b = { id: 'b', angenommen_am: '2026-01-15T00:00:00Z', eingeladen_am: '2026-01-10T00:00:00Z' }
  const c = { id: 'c', angenommen_am: null, eingeladen_am: '2026-01-05T00:00:00Z' }
  const d = { id: 'd', angenommen_am: null, eingeladen_am: '2026-01-02T00:00:00Z' }
  const ein = [a, b, c, d]
  assert.deepEqual(sortiereNachAnnahme(ein).map(x => x.id), ['b', 'a', 'd', 'c'])
  assert.deepEqual(ein.map(x => x.id), ['a', 'b', 'c', 'd'])
})

test('Team-Texte sagen immer den Grund (keine stummen Ablehnungen)', () => {
  assert.equal(TEAM_TEXTE.nurInhaber, 'Nur der Inhaber des Betriebs kann das.')
  assert.equal(TEAM_TEXTE.voll('Pro'), 'Dein Plan Pro hat keine freien Nutzerplätze mehr.')
  assert.equal(TEAM_TEXTE.ruhend, 'Dein Betrieb hat aktuell weniger Nutzerplätze als Mitglieder — sprich mit dem Inhaber.')
  assert.equal(TEAM_TEXTE.entfernt, 'Du gehörst diesem Betrieb nicht mehr an.')
})
