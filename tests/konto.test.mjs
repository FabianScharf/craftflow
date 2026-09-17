import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ermittleKonto, istImDeckel } from '../src/lib/konto.ts'

// Die Kontoauflösung ist die Stelle, an der entschieden wird, WESSEN Daten ein
// Login sieht. Ein Fehler hier ist ein Fremdzugriff — deshalb hat jeder Zweig
// einen Test, und jeder prüft auch die kontoId, nicht nur den Zustand.
// Spec: docs/superpowers/specs/2026-09-17-teamfunktion-design.md, Abschnitt 2.

const mitglied = (o = {}) => ({
  id: 'm1', inhaber_id: 'inh', user_id: 'u1', email: 'chef@example.de',
  status: 'aktiv', angenommen_am: '2026-03-01T10:00:00Z', eingeladen_am: '2026-02-01T10:00:00Z',
  ...o,
})

test('ohne Mitgliedschaft ist der Nutzer selbst der Betrieb', () => {
  assert.deepEqual(ermittleKonto('u1', [], [], 1), {
    kontoId: 'u1', istInhaber: true, zustand: 'inhaber', mitglied: null,
  })
})

test('offene Einladung (user_id noch null) macht noch keinen Mitarbeiter', () => {
  const offen = mitglied({ status: 'eingeladen', user_id: null, angenommen_am: null })
  const k = ermittleKonto('u1', [offen], [], 3)
  assert.equal(k.zustand, 'inhaber')
  assert.equal(k.kontoId, 'u1')
})

test('aktives Mitglied im Deckel arbeitet auf dem Konto des Inhabers', () => {
  const ich = mitglied({ id: 'm2', angenommen_am: '2026-03-01T10:00:00Z' })
  const aelter = mitglied({ id: 'm1', user_id: 'u9', angenommen_am: '2026-01-01T10:00:00Z' })
  const k = ermittleKonto('u1', [ich], [aelter, ich], 3)
  assert.equal(k.zustand, 'mitarbeiter')
  assert.equal(k.istInhaber, false)
  assert.equal(k.kontoId, 'inh')
  assert.equal(k.mitglied?.id, 'm2')
})

test('Deckel 1 (Solo/Starter): der Inhaber belegt den einzigen Platz, das Mitglied ruht', () => {
  const ich = mitglied()
  const k = ermittleKonto('u1', [ich], [ich], 1)
  assert.equal(k.zustand, 'ruhend')
  // WICHTIG: ein ruhendes Mitglied bekommt NIE die kontoId des Inhabers —
  // sonst würde es trotz Sperrseite auf fremden Daten arbeiten.
  assert.equal(k.kontoId, 'u1')
  assert.equal(k.istInhaber, false)
})

test('Deckel null (Enterprise) = unbegrenzt, jedes aktive Mitglied arbeitet mit', () => {
  const viele = Array.from({ length: 40 }, (_, i) =>
    mitglied({ id: `m${i}`, user_id: `u${i}`, angenommen_am: `2026-01-${String(i + 1).padStart(2, '0')}T10:00:00Z` }))
  const ich = viele[39]
  const k = ermittleKonto(ich.user_id, [ich], viele, null)
  assert.equal(k.zustand, 'mitarbeiter')
  assert.equal(k.kontoId, 'inh')
})

test('Deckel 3: Inhaber ist Platz 1, die zwei ältesten Mitglieder arbeiten, das dritte ruht', () => {
  const a = mitglied({ id: 'a', user_id: 'ua', angenommen_am: '2026-01-01T10:00:00Z' })
  const b = mitglied({ id: 'b', user_id: 'ub', angenommen_am: '2026-02-01T10:00:00Z' })
  const c = mitglied({ id: 'c', user_id: 'uc', angenommen_am: '2026-03-01T10:00:00Z' })
  const alle = [c, a, b]   // absichtlich unsortiert — die Reihenfolge macht die Logik
  assert.equal(ermittleKonto('ua', [a], alle, 3).zustand, 'mitarbeiter')
  assert.equal(ermittleKonto('ub', [b], alle, 3).zustand, 'mitarbeiter')
  assert.equal(ermittleKonto('uc', [c], alle, 3).zustand, 'ruhend')
  assert.equal(ermittleKonto('uc', [c], alle, 3).kontoId, 'uc')
})

test('entferntes Mitglied: eigener Zustand, eigene kontoId', () => {
  const weg = mitglied({ status: 'entfernt' })
  const k = ermittleKonto('u1', [weg], [], 3)
  assert.equal(k.zustand, 'entfernt')
  assert.equal(k.kontoId, 'u1')
  assert.equal(k.istInhaber, false)
  assert.equal(k.mitglied?.id, 'm1')
})

test('entfernt und neu eingeladen: die aktive Mitgliedschaft gewinnt', () => {
  const weg = mitglied({ id: 'alt', inhaber_id: 'alterChef', status: 'entfernt' })
  const neu = mitglied({ id: 'neu', inhaber_id: 'inh', status: 'aktiv' })
  const k = ermittleKonto('u1', [weg, neu], [neu], 3)
  assert.equal(k.zustand, 'mitarbeiter')
  assert.equal(k.kontoId, 'inh')
})

test('istImDeckel zählt den Inhaber als belegten Platz', () => {
  const a = mitglied({ id: 'a', angenommen_am: '2026-01-01T10:00:00Z' })
  const b = mitglied({ id: 'b', angenommen_am: '2026-02-01T10:00:00Z' })
  assert.equal(istImDeckel(a, [a, b], 2), true)
  assert.equal(istImDeckel(b, [a, b], 2), false)
  assert.equal(istImDeckel(a, [a, b], null), true)
  assert.equal(istImDeckel(b, [a, b], null), true)
  assert.equal(istImDeckel(a, [a], 0), false)
})

test('istImDeckel ist fail-closed, wenn das Mitglied nicht in der Liste steht', () => {
  // Kommt nur bei einem Supabase-Fehler vor (Liste leer geladen). Dann lieber
  // Sperrseite als stiller Zugriff auf fremde Daten.
  const a = mitglied({ id: 'a' })
  assert.equal(istImDeckel(a, [], 3), false)
})
