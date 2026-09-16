import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  PROFIL_FELDER, GESPERRTE_PROFIL_FELDER, PROFIL_BOOL_FELDER, PROFIL_ZAHL_FELDER,
  darfGeschriebenWerden,
} from '../src/lib/profilfelder.ts'

// Audit 2026-09-17, Critical: 'plan' stand in der Whitelist von
// PATCH /api/settings/betriebsprofil. Ein einziger Aufruf reichte, um sich selbst
// Enterprise zu geben. Dieser Test ist die Wache davor — er schlägt an, sobald
// eines der Abrechnungs-/Zugangsfelder wieder beschreibbar wird.
test('Abrechnungs- und Zugangsfelder sind niemals beschreibbar', () => {
  for (const feld of ['plan', 'abo_status', 'plan_gueltig_bis', 'trial_starts_at', 'gutschein_code']) {
    assert.equal(PROFIL_FELDER.includes(feld), false, `${feld} darf nicht in PROFIL_FELDER stehen`)
    assert.equal(darfGeschriebenWerden(feld), false, `${feld} darf nicht geschrieben werden`)
  }
})

test('Kein stripe_-Feld kommt durch, auch kein künftiges', () => {
  for (const feld of ['stripe_customer_id', 'stripe_subscription_id', 'stripe_price_id', 'stripe_irgendwas_neues']) {
    assert.equal(darfGeschriebenWerden(feld), false, `${feld} darf nicht geschrieben werden`)
  }
})

test('Sperrliste und Whitelist überschneiden sich nicht', () => {
  const doppelt = PROFIL_FELDER.filter(f => GESPERRTE_PROFIL_FELDER.includes(f))
  assert.deepEqual(doppelt, [])
})

test('Normale Profilfelder bleiben beschreibbar', () => {
  for (const feld of ['firma_name', 'preisfaktor', 'farbe_primaer', 'pdf_briefpapier_url', 'kleinunternehmer']) {
    assert.equal(darfGeschriebenWerden(feld), true, `${feld} sollte beschreibbar sein`)
  }
})

test('Unbekannte Felder fallen durch', () => {
  assert.equal(darfGeschriebenWerden('user_id'), false)
  assert.equal(darfGeschriebenWerden('created_at'), false)
  assert.equal(darfGeschriebenWerden(''), false)
})

test('Bool- und Zahlfelder sind Teil der Whitelist', () => {
  for (const feld of [...PROFIL_BOOL_FELDER, ...PROFIL_ZAHL_FELDER]) {
    assert.equal(PROFIL_FELDER.includes(feld), true, `${feld} fehlt in PROFIL_FELDER`)
  }
})
