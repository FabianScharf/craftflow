import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  PLAENE, PLAN_RANK, PREIS_IDS, erlaubt, mindestPlan, deckel, wendeDeckelAn,
  effektiverPlan, planFuerPreisId, merkmaleFuerAnzeige, TRIAL_DAYS,
} from '../src/lib/plaene.ts'

// Die Matrix aus der Spec (Abschnitt 3), Zahl für Zahl. Wer hier etwas ändert,
// ändert Fabians Preisliste — bewusst, nicht nebenbei.
test('Angebote pro Monat: 3 / 15 / 50 / Fair Use 150', () => {
  assert.equal(deckel('solo', 'angebote'), 3)
  assert.equal(deckel('starter', 'angebote'), 15)
  assert.equal(deckel('pro', 'angebote'), 50)
  assert.equal(deckel('enterprise', 'angebote'), 150)
})
test('Optimieren-Runden je Angebot: 5 / 10 / 20 / 40', () => {
  assert.deepEqual(['solo','starter','pro','enterprise'].map(p => deckel(p, 'optimierenRunden')), [5, 10, 20, 40])
})
test('Dateien je Projekt: 0 / 5 / 25 / 60', () => {
  assert.deepEqual(['solo','starter','pro','enterprise'].map(p => deckel(p, 'dateien')), [0, 5, 25, 60])
})
test('Bauweise-Regeln: 0 / 5 / unbegrenzt / unbegrenzt', () => {
  assert.deepEqual(['solo','starter','pro','enterprise'].map(p => deckel(p, 'bauweiseRegeln')), [0, 5, null, null])
})
test('Materialpreise: 0 / 20 / unbegrenzt / unbegrenzt', () => {
  assert.deepEqual(['solo','starter','pro','enterprise'].map(p => deckel(p, 'materialpreise')), [0, 20, null, null])
})
test('Nutzer: 1 / 1 / 3 / unbegrenzt', () => {
  assert.deepEqual(['solo','starter','pro','enterprise'].map(p => deckel(p, 'nutzer')), [1, 1, 3, null])
})
test('Funktionen je Plan (Spec-Matrix)', () => {
  const f = (p) => ['dateien','bloecke','ausschreibung','kalibrierung','bauweise','lernschleife','materialpreise','gestaltung','lieferanten','internetsuche','auswertung','smtp','export','gaeb'].filter(x => erlaubt(p, x))
  assert.deepEqual(f('solo'), [])
  assert.deepEqual(f('starter'), ['dateien','kalibrierung','bauweise','materialpreise','gestaltung','lieferanten','export'])
  assert.deepEqual(f('pro'), ['dateien','bloecke','kalibrierung','bauweise','lernschleife','materialpreise','gestaltung','lieferanten','auswertung','smtp','export'])
  assert.deepEqual(f('enterprise'), ['dateien','bloecke','ausschreibung','kalibrierung','bauweise','lernschleife','materialpreise','gestaltung','lieferanten','internetsuche','auswertung','smtp','export','gaeb'])
  for (const p of ['solo','starter','pro','enterprise']) for (const x of ['spracheingabe','pdf','assistent']) assert.ok(erlaubt(p, x), `${p} ${x}`)
})
test('mindestPlan nennt den ersten Plan, der die Funktion hat', () => {
  assert.equal(mindestPlan('dateien'), 'starter')
  assert.equal(mindestPlan('lernschleife'), 'pro')
  assert.equal(mindestPlan('gaeb'), 'enterprise')
  assert.equal(mindestPlan('pdf'), 'solo')
})
test('Monotonie: kein höherer Plan hat weniger als ein niedrigerer', () => {
  const reihe = ['solo','starter','pro','enterprise']
  for (const art of ['angebote','optimierenRunden','dateien','bauweiseRegeln','materialpreise','nutzer']) {
    let vorher = -1
    for (const p of reihe) {
      const d = deckel(p, art); const wert = d === null ? Infinity : d
      assert.ok(wert >= vorher, `${art}: ${p} (${d}) kleiner als Vorgänger`)
      vorher = wert
    }
  }
  for (let i = 1; i < reihe.length; i++) assert.ok(PLAN_RANK[reihe[i]] > PLAN_RANK[reihe[i-1]])
})
test('wendeDeckelAn: die ältesten N bleiben aktiv, der Rest wird inaktiv — nichts fällt weg', () => {
  const e = [
    { id: 'c', created_at: '2026-09-03T00:00:00Z' },
    { id: 'a', created_at: '2026-09-01T00:00:00Z' },
    { id: 'b', created_at: '2026-09-02T00:00:00Z' },
  ]
  const r = wendeDeckelAn(e, 2)
  assert.equal(r.length, 3)
  assert.deepEqual(r.map(x => [x.id, x.aktivDurchPlan]), [['c', false], ['a', true], ['b', true]], 'Reihenfolge der Eingabe bleibt erhalten')
  assert.ok(wendeDeckelAn(e, null).every(x => x.aktivDurchPlan), 'null = unbegrenzt')
  assert.ok(wendeDeckelAn(e, 0).every(x => !x.aktivDurchPlan), '0 = alle inaktiv')
})
test('effektiverPlan: Testphase = Enterprise, danach gespeicherter Plan, Standard Solo', () => {
  const jetzt = new Date('2026-09-15T12:00:00Z')
  assert.equal(effektiverPlan({ plan: 'starter', trial_starts_at: '2026-09-10T00:00:00Z' }, jetzt), 'enterprise')
  assert.equal(effektiverPlan({ plan: 'starter', trial_starts_at: '2026-08-01T00:00:00Z' }, jetzt), 'starter')
  assert.equal(effektiverPlan({ plan: null, trial_starts_at: null }, jetzt), 'solo')
  assert.equal(effektiverPlan({ plan: 'unsinn', trial_starts_at: null }, jetzt), 'solo')
  assert.equal(TRIAL_DAYS, 14)
})
test('Preis-IDs: BEIDE Sätze werden erkannt (Kauf über Einstellungen landete auf Solo — 15.09.)', () => {
  assert.equal(planFuerPreisId('price_1Tn1y0RvozvhvO9J4QXMCzje'), 'pro')      // Einstellungen (aktuell)
  assert.equal(planFuerPreisId('price_1TmScSRvozvhvO9J0RF42acJ'), 'pro')      // älterer Satz
  assert.equal(planFuerPreisId('price_1Tn1xzRvozvhvO9JJ3og0R3w'), 'solo')
  assert.equal(planFuerPreisId('price_1Tn1y1RvozvhvO9JYlX8lp4z'), 'enterprise')
  assert.equal(planFuerPreisId('price_gibtsnicht'), null)
  assert.equal(PREIS_IDS.pro, 'price_1Tn1y0RvozvhvO9J4QXMCzje')
})
test('Preise netto: 7 / 29 / 49 / 79', () => {
  assert.deepEqual(['solo','starter','pro','enterprise'].map(p => PLAENE[p].preisNetto), [7, 29, 49, 79])
})
test('merkmaleFuerAnzeige nennt Deckel als Zahlen und nur Funktionen, die der Plan hat', () => {
  const solo = merkmaleFuerAnzeige('solo').join(' | ')
  assert.match(solo, /3 Angebote/); assert.match(solo, /5 Optimieren-Runden/); assert.doesNotMatch(solo, /Kalibrierung/)
  const pro = merkmaleFuerAnzeige('pro').join(' | ')
  assert.match(pro, /50 Angebote/); assert.match(pro, /Große Projekte/); assert.match(pro, /Lernschleife/); assert.match(pro, /3 Nutzer/)
  assert.match(merkmaleFuerAnzeige('enterprise').join(' | '), /Fair Use/)
})
