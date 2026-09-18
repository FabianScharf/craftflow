import { test } from 'node:test'
import assert from 'node:assert/strict'
import { rechnungsMail } from '../src/lib/mail/vorlagen.ts'

const BEISPIEL = {
  nummer: 'A1B2C3-0001',
  planName: 'Pro',
  nettoCent: 4900,
  steuerCent: 931,
  gesamtCent: 5831,
  vonSek: Math.floor(Date.UTC(2026, 8, 18) / 1000),
  bisSek: Math.floor(Date.UTC(2026, 9, 18) / 1000),
  rechnungUrl: 'https://invoice.stripe.com/i/abc',
  mitAnhang: true,
}

test('Die Rechnungsmail nennt Nummer, Netto, Steuer und Gesamt — in HTML und Text', () => {
  const m = rechnungsMail(BEISPIEL)
  for (const teil of [m.html, m.text]) {
    assert.ok(teil.includes('A1B2C3-0001'), 'Rechnungsnummer fehlt')
    assert.ok(teil.includes('49,00'), 'Nettobetrag fehlt')
    assert.ok(teil.includes('9,31'), 'Steuerbetrag fehlt')
    assert.ok(teil.includes('58,31'), 'Gesamtbetrag fehlt')
  }
  assert.ok(m.subject.includes('A1B2C3-0001'), 'Betreff ohne Rechnungsnummer')
})

// Ein Kunde, der keinen Anhang bekommt, braucht den Link — sonst steht er ohne Rechnung da.
test('Ohne Anhang verweist die Mail auf die Rechnung bei Stripe', () => {
  const m = rechnungsMail({ ...BEISPIEL, mitAnhang: false })
  assert.ok(m.html.includes('invoice.stripe.com/i/abc'), 'Link fehlt im HTML')
  assert.ok(m.text.includes('invoice.stripe.com/i/abc'), 'Link fehlt im Text')
  assert.ok(!m.html.includes('liegt dieser Mail bei'), 'behauptet einen Anhang, der fehlt')
})

test('Mit Anhang wird der Anhang genannt, nicht nur der Link', () => {
  const m = rechnungsMail(BEISPIEL)
  assert.ok(m.html.includes('liegt dieser Mail bei'), 'Anhang wird nicht erwähnt')
})

// Der Zeitraum ist die einzige Stelle, an der ein Kunde sieht, wofür er zahlt.
test('Der Abrechnungszeitraum steht in der Mail, deutsch geschrieben', () => {
  const m = rechnungsMail(BEISPIEL)
  assert.ok(m.html.includes('September 2026'), 'Zeitraumbeginn fehlt')
  assert.ok(m.html.includes('Oktober 2026'), 'Zeitraumende fehlt')
})

// Fehlt der Plan, darf trotzdem keine kaputte Zeile entstehen.
test('Ohne Plan-Namen steht schlicht CraftFlow da', () => {
  const m = rechnungsMail({ ...BEISPIEL, planName: null })
  assert.ok(m.html.includes('CraftFlow'), 'Bezeichnung fehlt')
  assert.ok(!m.html.includes('CraftFlow <br>'), 'leerer Plan hinterlässt Lücke')
})
