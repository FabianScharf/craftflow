import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  serienFaktor, montageFaktor, materialRabatt, zeitFaktorFuer, stueckzahlVon, serienHinweis,
} from '../src/lib/types.ts'

test('Ein Stueck aendert nichts', () => {
  assert.equal(serienFaktor(1), 1)
  assert.equal(montageFaktor(1), 1)
  assert.equal(materialRabatt(1), 0)
})

test('Die Staffel entspricht der abgestimmten Tabelle', () => {
  const erwartet = { 1: 1.00, 2: 0.92, 3: 0.85, 4: 0.85, 5: 0.78, 9: 0.78,
                     10: 0.70, 24: 0.70, 25: 0.62, 50: 0.55, 99: 0.55, 100: 0.50, 500: 0.50 }
  for (const [n, w] of Object.entries(erwartet)) {
    assert.equal(serienFaktor(Number(n)), w, `bei ${n} Stück`)
  }
})

test('Die Staffel faellt monoton — mehr Stueck sind nie teurer je Stueck', () => {
  let letzter = 1.01
  for (const n of [1,2,3,5,10,25,50,100,250]) {
    const f = serienFaktor(n)
    assert.ok(f <= letzter, `bei ${n}: ${f} > ${letzter}`)
    letzter = f
  }
})

test('Die Montage faellt flacher als die Werkstatt', () => {
  for (const n of [3, 10, 100]) {
    assert.ok(montageFaktor(n) > serienFaktor(n), `bei ${n} Stück`)
  }
})

test('Fixkosten fallen EINMAL an, nicht je Stueck', () => {
  for (const ks of ['Besprechung', 'Planung', 'Konstruktion', 'Arbeitsvorbereitung']) {
    assert.equal(zeitFaktorFuer(ks, 100), 1, ks)
  }
})

test('Werkstattzeit waechst mit der Stueckzahl, aber unterproportional', () => {
  const f10 = zeitFaktorFuer('Zusammenbau', 10)
  assert.equal(f10, 10 * 0.70)
  assert.ok(f10 < 10, 'unterproportional')
  assert.ok(f10 > 1, 'aber es waechst')
})

test('Montage waechst fast proportional', () => {
  assert.equal(zeitFaktorFuer('Montage', 10), 10 * 0.85)
  assert.ok(zeitFaktorFuer('Montage', 10) > zeitFaktorFuer('Zusammenbau', 10))
})

test('Das durchgerechnete Beispiel aus der Abstimmung stimmt', () => {
  // Ein Spind: 6 h Werkstatt, 1,5 h Planung, 0,5 h Montage, 200 € Material, 70 €/h.
  const satz = 70
  const werkstatt = 6 * zeitFaktorFuer('Zusammenbau', 10) * satz
  const planung   = 1.5 * zeitFaktorFuer('Planung', 10) * satz
  const montage   = 0.5 * zeitFaktorFuer('Montage', 10) * satz
  const material  = 200 * 10 * (1 - materialRabatt(10))
  const gesamt = werkstatt + planung + montage + material
  // Abgestimmt waren rund 5.243 € gesamt, 524 € je Stueck.
  assert.ok(Math.abs(gesamt - 5243) < 30, `Gesamt ${gesamt.toFixed(0)} statt ~5243`)
  assert.ok(Math.abs(gesamt / 10 - 524) < 3, `Je Stück ${(gesamt/10).toFixed(0)} statt ~524`)
})

test('Ohne Staffel waere es 7.600 € — der Unterschied ist der Sinn der Sache', () => {
  const naiv = (6 + 1.5 + 0.5) * 10 * 70 + 200 * 10
  assert.equal(naiv, 7600)
})

test('Materialrabatt in Stufen', () => {
  assert.equal(materialRabatt(4), 0)
  assert.equal(materialRabatt(5), 0.03)
  assert.equal(materialRabatt(10), 0.05)
  assert.equal(materialRabatt(25), 0.08)
  assert.equal(materialRabatt(100), 0.10)
})

test('Unsinn im Stueckzahl-Feld kippt nichts', () => {
  assert.equal(stueckzahlVon(undefined), 1)
  assert.equal(stueckzahlVon({}), 1)
  assert.equal(stueckzahlVon({ stueckzahl: 0 }), 1)
  assert.equal(stueckzahlVon({ stueckzahl: -5 }), 1)
  assert.equal(stueckzahlVon({ stueckzahl: NaN }), 1)
  assert.equal(stueckzahlVon({ stueckzahl: 3.7 }), 3)
})

test('Der Klartext nennt alle drei Wirkungen', () => {
  const h = serienHinweis(10)
  assert.match(h, /Planung fällt einmal an/)
  assert.match(h, /30 %/)
  assert.match(h, /5 %/)
  assert.equal(serienHinweis(1), '')
})
