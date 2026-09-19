import { test } from 'node:test'
import assert from 'node:assert/strict'
import { effektiverPlan } from '../src/lib/plaene.ts'

// Der Fehler vom 19.09.2026: Der Entwickler-Umschalter schrieb nur `plan`.
// Fabian: "Als ich gestern auf Solo umgestellt habe, war mein Zugriff
// vollständig weg und die App sagte, der Testzeitraum sei abgelaufen."

const OHNE_ABO = { abo_status: null, trial_starts_at: null, plan_gueltig_bis: null }

test('SO WAR ES: nur plan gesetzt — solo sperrt das Konto', () => {
  assert.equal(effektiverPlan({ ...OHNE_ABO, plan: 'solo' }), 'gesperrt')
})

test('SO WAR ES: die anderen Plaene gingen durch — deshalb fiel es nur bei Solo auf', () => {
  for (const p of ['starter', 'pro', 'enterprise']) {
    assert.equal(effektiverPlan({ ...OHNE_ABO, plan: p }), p, p)
  }
})

test('SO IST ES JETZT: mit simuliertem Abo wirkt jeder Plan — auch Solo', () => {
  for (const p of ['solo', 'starter', 'pro', 'enterprise']) {
    assert.equal(effektiverPlan({ ...OHNE_ABO, abo_status: 'aktiv', plan: p }), p, p)
  }
})

// Die Regel, die NICHT gelockert werden darf: Sonst bekaeme jedes Konto nach der
// Testphase still den Solo-Plan geschenkt.
test('Ein abgelaufenes Testkonto ohne Abo bleibt gesperrt', () => {
  const vorbei = new Date(Date.now() - 60 * 86400000).toISOString()
  assert.equal(effektiverPlan({ plan: 'solo', abo_status: null, trial_starts_at: vorbei, plan_gueltig_bis: null }), 'gesperrt')
})

test('Ein beendetes Abo bleibt gesperrt, egal welcher Plan gespeichert ist', () => {
  assert.equal(effektiverPlan({ ...OHNE_ABO, abo_status: 'beendet', plan: 'pro' }), 'gesperrt')
})

// Der Knopf "Gesperrt" stellt genau diesen Zustand her.
test('Der Knopf Gesperrt ergibt den Zustand nach der Testphase', () => {
  assert.equal(effektiverPlan({ plan: 'solo', abo_status: null, plan_gueltig_bis: null, trial_starts_at: null }), 'gesperrt')
})
