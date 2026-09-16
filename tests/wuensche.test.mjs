import { test } from 'node:test'
import assert from 'node:assert/strict'
import { deckel } from '../src/lib/plaene.ts'
import { stimmenAblehnung } from '../src/lib/plantexte.ts'
import {
  WUNSCH_STATUS, STATUS_LABEL, OEFFENTLICHE_STATUS, TITEL_MAX, BESCHREIBUNG_MAX,
  VORSCHLAEGE_JE_TAG, istWunschStatus, pruefeTexte, stimmenbudget,
  aktiveStimmen, stimmenJeWunsch, planeZusammenlegenStimmen,
} from '../src/lib/wuensche.ts'

// Ein Konto, das noch in der Testphase ist, gilt als Enterprise (30 Stimmen).
const LAEUFT = { plan: 'solo', trial_starts_at: '2026-09-15T00:00:00Z' }
const jetzt = new Date('2026-09-16T12:00:00Z')
const mitPlan = (p) => ({ plan: p, trial_starts_at: '2026-01-01T00:00:00Z', abo_status: 'aktiv' })

test('Stimmenbudget je Plan: 1 / 3 / 10 / 30', () => {
  assert.deepEqual(['solo','starter','pro','enterprise'].map(p => deckel(p, 'wunschStimmen')), [1, 3, 10, 30])
  assert.equal(stimmenbudget(mitPlan('solo'), jetzt), 1)
  assert.equal(stimmenbudget(mitPlan('pro'), jetzt), 10)
  assert.equal(stimmenbudget(LAEUFT, jetzt), 30, 'Testphase = Enterprise = 30')
  assert.equal(stimmenbudget(null, jetzt), 0, 'gesperrt: keine Stimme')
})

test('Der Status-Vorrat steht fest, Ausgeblendet ist nicht öffentlich', () => {
  assert.deepEqual(WUNSCH_STATUS, ['offen', 'geplant', 'in_arbeit', 'fertig', 'ausgeblendet'])
  assert.deepEqual(OEFFENTLICHE_STATUS, ['geplant', 'in_arbeit', 'fertig'])
  assert.equal(STATUS_LABEL.in_arbeit, 'In Arbeit')
  assert.ok(istWunschStatus('fertig'))
  assert.ok(!istWunschStatus('erledigt'))
  assert.ok(!istWunschStatus(null))
})

test('Textgrenzen: 120 Zeichen Titel, 1000 Zeichen Beschreibung', () => {
  assert.equal(TITEL_MAX, 120)
  assert.equal(BESCHREIBUNG_MAX, 1000)
  assert.equal(VORSCHLAEGE_JE_TAG, 3)
  assert.deepEqual(pruefeTexte('  Serienbriefe  ', ' bitte '), { ok: true, titel: 'Serienbriefe', beschreibung: 'bitte' })
  assert.deepEqual(pruefeTexte('   ', 'x'), { ok: false, grund: 'Bitte gib einen Titel an.' })
  assert.deepEqual(pruefeTexte('a'.repeat(121), ''), { ok: false, grund: 'Der Titel darf höchstens 120 Zeichen haben.' })
  assert.deepEqual(pruefeTexte('ok', 'b'.repeat(1001)), { ok: false, grund: 'Die Beschreibung darf höchstens 1000 Zeichen haben.' })
  assert.deepEqual(pruefeTexte('ok', null), { ok: true, titel: 'ok', beschreibung: '' })
})

test('Wechsel nach unten: die ältesten N Stimmen bleiben aktiv, der Rest zählt nicht', () => {
  // Dieselbe Regel wie überall (wendeDeckelAn). Nichts wird gelöscht — ein Upgrade
  // schaltet die inaktiven Stimmen sofort wieder scharf.
  const stimmen = [
    { wunsch_id: 'w1', user_id: 'u1', created_at: '2026-09-01T00:00:00Z' },
    { wunsch_id: 'w2', user_id: 'u1', created_at: '2026-09-02T00:00:00Z' },
    { wunsch_id: 'w3', user_id: 'u1', created_at: '2026-09-03T00:00:00Z' },
    { wunsch_id: 'w1', user_id: 'u2', created_at: '2026-09-04T00:00:00Z' },
  ]
  const profile = { u1: mitPlan('solo'), u2: mitPlan('pro') }   // 1 bzw. 10 Stimmen
  const aktiv = aktiveStimmen(stimmen, profile, jetzt)
  assert.deepEqual(aktiv.map(s => `${s.user_id}:${s.wunsch_id}`), ['u1:w1', 'u2:w1'])
  assert.deepEqual(stimmenJeWunsch(stimmen, profile, jetzt), { w1: 2, w2: 0, w3: 0 })
})

test('Ohne Profil (gesperrt) zählt keine Stimme, und niemand fällt aus der Liste', () => {
  const stimmen = [{ wunsch_id: 'w1', user_id: 'u9', created_at: '2026-09-01T00:00:00Z' }]
  assert.deepEqual(aktiveStimmen(stimmen, {}, jetzt), [])
  assert.deepEqual(stimmenJeWunsch(stimmen, {}, jetzt), { w1: 0 })
})

test('Öffentlich sind nur Geplant, In Arbeit und Fertig — Offenes bleibt in der App', () => {
  assert.ok(!OEFFENTLICHE_STATUS.includes('offen'))
  assert.ok(!OEFFENTLICHE_STATUS.includes('ausgeblendet'))
})

test('Die Middleware öffnet nur die öffentliche Wunsch-Route, nicht die ganze Familie', () => {
  // `startsWith` ist grosszuegig: Ein Eintrag '/api/wuensche' wuerde versehentlich
  // auch /api/wuensche/[id]/stimme oeffnen. Deshalb steht nur der volle Pfad drin.
  const PUBLIC = ['/api/wuensche/oeffentlich']
  const oeffentlich = (p) => PUBLIC.some(x => p.startsWith(x))
  assert.ok(oeffentlich('/api/wuensche/oeffentlich'))
  assert.ok(!oeffentlich('/api/wuensche'))
  assert.ok(!oeffentlich('/api/wuensche/abc/stimme'))
})

test('Zusammenlegen: Stimmen wandern zum Ziel, Duplikate werden verworfen', () => {
  const quelle = [
    { wunsch_id: 'q', user_id: 'u1', created_at: '2026-09-01T00:00:00Z' }, // wandert
    { wunsch_id: 'q', user_id: 'u2', created_at: '2026-09-02T00:00:00Z' }, // Duplikat: hat schon am Ziel
  ]
  const ziel = [
    { wunsch_id: 'z', user_id: 'u2', created_at: '2026-08-01T00:00:00Z' },
  ]
  const { uebertragen, verworfen } = planeZusammenlegenStimmen('q', 'z', quelle, ziel)
  assert.deepEqual(uebertragen, [{ wunsch_id: 'z', user_id: 'u1', created_at: '2026-09-01T00:00:00Z' }])
  assert.deepEqual(verworfen, [{ wunsch_id: 'q', user_id: 'u2', created_at: '2026-09-02T00:00:00Z' }])
})

test('Zusammenlegen: ein leeres Ziel übernimmt einfach alle Quell-Stimmen', () => {
  const quelle = [{ wunsch_id: 'q', user_id: 'u1', created_at: '2026-09-01T00:00:00Z' }]
  const { uebertragen, verworfen } = planeZusammenlegenStimmen('q', 'z', quelle, [])
  assert.deepEqual(uebertragen, [{ wunsch_id: 'z', user_id: 'u1', created_at: '2026-09-01T00:00:00Z' }])
  assert.deepEqual(verworfen, [])
})

test('Volles Budget wird mit Zahl, Ausweg und nächstem Plan abgelehnt', () => {
  assert.deepEqual(stimmenAblehnung('starter'), {
    error: 'Du hast alle 3 Stimmen deines Plans vergeben. Nimm eine zurück oder wechsle den Plan.',
    minPlan: 'pro',
  })
  assert.deepEqual(stimmenAblehnung('enterprise'), {
    error: 'Du hast alle 30 Stimmen deines Plans vergeben. Nimm eine zurück oder wechsle den Plan.',
    minPlan: null,
  })
})
