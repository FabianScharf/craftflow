import { test } from 'node:test'
import assert from 'node:assert/strict'
import { positionenAusKi, KI_POSITIONSFELDER } from '../src/lib/kiantwort.ts'

const VOLL = {
  titel: 'Schulspind 400 mm',
  beschreibung: 'Egger Dekor grau, Drehtür, Garderobenstange',
  stueckzahl: 10,
  gruppe: 'Umkleide Turnhalle',
  alternativ: true,
  warnung: 'Werkstattzeit weit außerhalb des Richtwerts',
  material: [{ bezeichnung: 'Spanplatte 19 mm', menge: 4.2, einheit: 'm²', ekPreis: 16, aufschlag: 0.25 }],
  arbeitszeit: [{ kostenstelle: 'Zuschnitt', minuten: 43, vkStunde: 72 }],
}

test('Kein Feld der KI-Antwort geht verloren', () => {
  // DER EIGENTLICHE TEST. Diese Umwandlung baut jede Position Feld fuer Feld neu
  // auf — was in der Liste fehlt, ist danach weg, ohne Fehler und ohne Meldung.
  //
  // GENAU SO IST DIE STUECKZAHL VERSCHWUNDEN (gefunden 2026-09-08): Die KI lieferte
  // sie korrekt, die Serienstaffel war gebaut und getestet, aber die Oberflaeche
  // liess das Feld beim Uebernehmen weg. Wer "100 Spinde" kalkulierte, bekam den
  // Preis fuer EIN Stueck.
  //
  // Dieser Test prueft deshalb nicht einzelne Felder, sondern die Vollstaendigkeit.
  const [p] = positionenAusKi([VOLL], 1000)
  for (const feld of KI_POSITIONSFELDER) {
    assert.ok(feld in p, `Feld "${feld}" wurde nicht uebernommen`)
  }
  assert.equal(p.stueckzahl, 10)
  assert.equal(p.gruppe, 'Umkleide Turnhalle')
  assert.equal(p.alternativ, true)
  assert.equal(p.material[0].bezeichnung, 'Spanplatte 19 mm')
  assert.equal(p.arbeitszeit[0].minuten, 43)
})

test('Die Stückzahl kommt genau so an, wie die KI sie geschickt hat', () => {
  for (const n of [1, 2, 3, 5, 10, 25, 100]) {
    const [p] = positionenAusKi([{ ...VOLL, stueckzahl: n }], 1000)
    // Bei genau einem Stueck bleibt das Feld weg — dann ist es kein Serienauftrag.
    assert.equal(p.stueckzahl ?? 1, n, `stueckzahl ${n} kam als ${p.stueckzahl} an`)
  }
})

test('Was nicht da ist, wird nicht erfunden', () => {
  // Sonst stehen in jedem Angebot "stueckzahl: 1" und "gruppe: ''" herum, und der
  // Versionsvergleich der Lernschleife meldet Aenderungen, die keine sind.
  const [p] = positionenAusKi([{ titel: 'Einzelstück', material: [], arbeitszeit: [] }], 1000)
  assert.ok(!('stueckzahl' in p))
  assert.ok(!('gruppe' in p))
  assert.ok(!('alternativ' in p))
  assert.ok(!('warnung' in p))
})

test('Kaputte Antworten stürzen nicht ab', () => {
  assert.deepEqual(positionenAusKi(null), [])
  assert.deepEqual(positionenAusKi('kein Array'), [])
  const [p] = positionenAusKi([null], 1000)
  assert.equal(p.titel, 'Position')
  assert.deepEqual(p.material, [])
  assert.deepEqual(p.arbeitszeit, [])
  const [q] = positionenAusKi([{ stueckzahl: 'viele', material: 'kaputt' }], 1000)
  assert.equal(q.stueckzahl ?? 1, 1)
  assert.deepEqual(q.material, [])
})

test('Die ids sind innerhalb eines Angebots eindeutig', () => {
  // Doppelte ids wuerden das Bearbeiten und den Versionsvergleich der Lernschleife
  // durcheinanderbringen — die paart Positionen ueber die id.
  const positionen = positionenAusKi([VOLL, VOLL, VOLL], 1000)
  const alle = [
    ...positionen.map(p => p.id),
    ...positionen.flatMap(p => p.material.map(m => m.id)),
    ...positionen.flatMap(p => p.arbeitszeit.map(a => a.id)),
  ]
  assert.equal(new Set(alle).size, alle.length, `doppelte ids: ${alle.join(', ')}`)
})

test('Der Stundensatz fällt auf den übergebenen Wert zurück, nicht auf null', () => {
  const [p] = positionenAusKi([{ arbeitszeit: [{ kostenstelle: 'Zuschnitt', minuten: 60 }] }], 1000, 72)
  assert.equal(p.arbeitszeit[0].vkStunde, 72)
})
