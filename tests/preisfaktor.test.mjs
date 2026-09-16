import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  calcAngebotspos, nettoSumme, materialkostenGesamt, stundenGesamt,
} from '../src/lib/types.ts'
import {
  PREISFAKTOR_MIN, PREISFAKTOR_MAX, PREISFAKTOR_STANDARD,
  klemmePreisfaktor, stempelPreisfaktor, angezeigterPreisfaktor, verwirfKiPreisfaktor,
} from '../src/lib/preisfaktor.ts'
import { deckele, deckeleHand, HAND_MIN, HAND_MAX } from '../src/lib/kalibrierung.ts'
import { positionenAusKi } from '../src/lib/kiantwort.ts'

// Eine Position mit runden Zahlen: Material 10 m2 x 20 EUR x 1,30 = 260,00 EUR,
// Arbeit 120 min / 60 x 72 EUR/h = 144,00 EUR. Zusammen 404,00 EUR.
const POS = (extra = {}) => ({
  id: 1, titel: 'Einbauschrank', beschreibung: '',
  material: [{ id: 11, bezeichnung: 'Spanplatte 19 mm', menge: 10, einheit: 'm²', ekPreis: 20, aufschlag: 0.3 }],
  arbeitszeit: [{ id: 21, kostenstelle: 'Zuschnitt', minuten: 120, vkStunde: 72 }],
  ...extra,
})

test('Ohne Preisfaktor rechnet sich nichts anders als bisher', () => {
  assert.equal(calcAngebotspos(POS()), 404)
  assert.equal(PREISFAKTOR_STANDARD, 1)
})

test('Der Preisfaktor multipliziert den Endpreis der Position — Material und Lohn zusammen', () => {
  assert.equal(calcAngebotspos(POS({ preisfaktor: 1.25 })), 505)
  assert.equal(calcAngebotspos(POS({ preisfaktor: 0.5 })), 202)
  assert.equal(calcAngebotspos(POS({ preisfaktor: 3 })), 1212)
})

test('Stunden, Materialkosten und Stundensätze bleiben unberührt', () => {
  // GENAU DARUM geht es: Zeitfaktoren verfaelschen "Stunden gesamt" und den
  // Plancraft-Export. Der Preisfaktor darf das nicht.
  const teuer = [POS({ preisfaktor: 3 })]
  assert.equal(stundenGesamt(teuer), 2)
  assert.equal(materialkostenGesamt(teuer), 260)
  assert.equal(teuer[0].arbeitszeit[0].vkStunde, 72)
  assert.equal(teuer[0].material[0].aufschlag, 0.3)
})

test('nettoSumme summiert die gestempelten Preise, Alternativpositionen bleiben draußen', () => {
  assert.equal(nettoSumme([POS({ preisfaktor: 1.25 }), POS({ id: 2 })]), 505 + 404)
  assert.equal(nettoSumme([POS({ preisfaktor: 1.25 }), POS({ id: 2, preisfaktor: 2, alternativ: true })]), 505)
})

test('Ein kaputter Wert kippt die Kalkulation nicht — er gilt als 1,00', () => {
  // Ein NaN im Feld wuerde sonst die ganze Angebotssumme zu NaN machen, ohne Meldung.
  for (const kaputt of [NaN, 0, -1, Infinity, null, undefined, '1,25']) {
    assert.equal(calcAngebotspos(POS({ preisfaktor: kaputt })), 404, `preisfaktor ${String(kaputt)}`)
  }
})

test('klemmePreisfaktor hält 0,50 bis 3,00 ein und weist Unsinn ab', () => {
  assert.equal(PREISFAKTOR_MIN, 0.5)
  assert.equal(PREISFAKTOR_MAX, 3)
  assert.equal(klemmePreisfaktor(1.25), 1.25)
  assert.equal(klemmePreisfaktor('1.25'), 1.25)
  assert.equal(klemmePreisfaktor(0.1), 0.5)
  assert.equal(klemmePreisfaktor(9), 3)
  assert.equal(klemmePreisfaktor(1.2345), 1.23)
  assert.equal(klemmePreisfaktor(''), null)
  assert.equal(klemmePreisfaktor('abc'), null)
  assert.equal(klemmePreisfaktor(null), null)
  assert.equal(klemmePreisfaktor(undefined), null)
})

test('stempelPreisfaktor setzt den Faktor nur auf Positionen, die noch keinen tragen', () => {
  // Ein verschicktes Angebot darf sich nicht rueckwirkend veraendern: Wer schon
  // einen Faktor traegt, behaelt ihn — auch wenn der Betrieb seinen inzwischen
  // geaendert hat.
  const gestempelt = stempelPreisfaktor(
    [{ id: 1, titel: 'neu' }, { id: 2, titel: 'alt', preisfaktor: 1.1 }],
    1.4,
  )
  assert.deepEqual(gestempelt.map(p => p.preisfaktor), [1.4, 1.1])
  // Faktor 1,00 wird nicht gestempelt — sonst steht in jedem Angebot "preisfaktor: 1"
  // herum und der Versionsvergleich meldet Aenderungen, die keine sind.
  assert.ok(!('preisfaktor' in stempelPreisfaktor([{ id: 1 }], 1)[0]))
  // Die Eingabeliste bleibt unveraendert (keine stillen Nebenwirkungen).
  const eingabe = [{ id: 1 }]
  stempelPreisfaktor(eingabe, 1.5)
  assert.ok(!('preisfaktor' in eingabe[0]))
})

test('I-6: ein von der KI erfundener Preisfaktor wird verworfen, nicht übernommen', () => {
  // So laufen /api/analyze und /api/analyze/block: verwirfKiPreisfaktor VOR
  // stempelPreisfaktor. Ohne diesen Schritt liesse stempelPreisfaktor einen
  // "vorhandenen" Wert bewusst stehen (Regel 1) — hier waere das eine ungeprüfte
  // KI-Zahl mit direkter Preiswirkung (schreibt die KI "preisfaktor": 7, würde
  // sich der Preis versiebenfachen).
  const kiPositionen = [{ id: 1, titel: 'X', preisfaktor: 7 }, { id: 2, titel: 'Y' }]
  const bereinigt = verwirfKiPreisfaktor(kiPositionen)
  const gestempelt = stempelPreisfaktor(bereinigt, 1.4)
  assert.deepEqual(gestempelt.map(p => p.preisfaktor), [1.4, 1.4])
  // Ohne den Verwurf bliebe der erfundene Wert stehen — zur Kontrolle, dass der
  // Test wirklich den Verwurf prüft und nicht nur stempelPreisfaktor selbst.
  const ohneVerwurf = stempelPreisfaktor(kiPositionen, 1.4)
  assert.equal(ohneVerwurf[0].preisfaktor, 7)
})

test('angezeigterPreisfaktor meldet nur, was wirklich wirkt', () => {
  assert.equal(angezeigterPreisfaktor([]), null)
  assert.equal(angezeigterPreisfaktor([{ id: 1 }, { id: 2 }]), null)
  assert.equal(angezeigterPreisfaktor([{ preisfaktor: 1 }, {}]), null)
  assert.equal(angezeigterPreisfaktor([{ preisfaktor: 1.25 }, { preisfaktor: 1.25 }]), 1.25)
  assert.equal(angezeigterPreisfaktor([{ preisfaktor: 1.25 }, { preisfaktor: 1.1 }]), 'gemischt')
  assert.equal(angezeigterPreisfaktor([{ preisfaktor: 1.25 }, {}]), 'gemischt')
})

test('positionenAusKi reicht den gestempelten Preisfaktor durch', () => {
  // Der Server stempelt NACH validateAndFix. Wuerde diese Umwandlung das Feld
  // weglassen, waere der Faktor in der Oberflaeche weg — genau so ist 2026-09-08
  // die Stueckzahl verschwunden.
  const [p] = positionenAusKi([{ titel: 'X', preisfaktor: 1.25, material: [], arbeitszeit: [] }], 1000)
  assert.equal(p.preisfaktor, 1.25)
  const [q] = positionenAusKi([{ titel: 'X', material: [], arbeitszeit: [] }], 1000)
  assert.ok(!('preisfaktor' in q), 'ohne Faktor wird keiner erfunden')
  const [r] = positionenAusKi([{ titel: 'X', preisfaktor: 'viel', material: [], arbeitszeit: [] }], 1000)
  assert.ok(!('preisfaktor' in r), 'Unsinn wird nicht uebernommen')
})

test('Zeitfaktoren von Hand: 0,50 bis 3,00 — die Ableitung bleibt bei 0,6 bis 1,4', () => {
  // Fabian am 16.09.: Die enge Grenze war nur ein Tippfehler-Schutz. Sie gilt
  // weiterhin fuer die ABLEITUNG aus den Kalibrierungsantworten (deckele), nicht
  // mehr fuer die Handeingabe (deckeleHand).
  assert.equal(HAND_MIN, 0.5)
  assert.equal(HAND_MAX, 3)
  assert.equal(deckeleHand(0.1), 0.5)
  assert.equal(deckeleHand(9), 3)
  assert.equal(deckeleHand(2.5), 2.5)
  assert.equal(deckeleHand(0.83), 0.83)
  assert.equal(deckeleHand(NaN), 1)
  assert.equal(deckele(0.1), 0.6)
  assert.equal(deckele(9), 1.4)
  assert.equal(deckele(2.5), 1.4)
})
