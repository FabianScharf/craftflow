import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  lerneFaktoren, median, bereichFuer, MIN_BEOBACHTUNGEN, DAEMPFUNG,
} from '../src/lib/lernschleife.ts'

const EINS = { werkstatt: 1, oberflaeche: 1, massivholz: 1, montage: 1 }
const beob = (bereich, vorher, nachher) => ({ bereich, vorher, nachher })

test('Ohne Beobachtungen aendert sich nichts', () => {
  const r = lerneFaktoren(EINS, [])
  assert.deepEqual(r.faktoren, EINS)
  assert.equal(r.begruendung.length, 0)
})

test('Unter der Mindestmenge wird nichts veraendert', () => {
  const zu_wenig = Array.from({ length: MIN_BEOBACHTUNGEN - 1 }, () => beob('werkstatt', 100, 50))
  assert.deepEqual(lerneFaktoren(EINS, zu_wenig).faktoren, EINS)
})

test('Ab der Mindestmenge wird nachgezogen — aber nur die halbe Strecke', () => {
  const b = Array.from({ length: MIN_BEOBACHTUNGEN }, () => beob('werkstatt', 100, 80))
  const r = lerneFaktoren(EINS, b)
  // Median 0,8 -> Ziel 0,8, halbe Strecke von 1,0 aus = 0,9
  assert.equal(r.faktoren.werkstatt, 1 * (1 + (0.8 - 1) * DAEMPFUNG))
  assert.equal(r.faktoren.werkstatt, 0.9)
})

test('Ein Ausreisser kippt das Ergebnis nicht — Median statt Mittelwert', () => {
  const b = [
    beob('werkstatt', 100, 90), beob('werkstatt', 100, 90),
    beob('werkstatt', 100, 90), beob('werkstatt', 100, 35),
  ]
  const r = lerneFaktoren(EINS, b)
  assert.equal(r.faktoren.werkstatt, 0.95)
})

test('Unsinnige Verhaeltnisse werden verworfen', () => {
  // 100 -> 5 ist keine Kalibrierung, sondern eine geloeschte Position.
  const b = Array.from({ length: MIN_BEOBACHTUNGEN }, () => beob('werkstatt', 100, 5))
  assert.deepEqual(lerneFaktoren(EINS, b).faktoren, EINS)
})

test('Jeder Bereich lernt fuer sich', () => {
  const b = [
    ...Array.from({ length: 3 }, () => beob('werkstatt', 100, 80)),
    ...Array.from({ length: 3 }, () => beob('montage', 100, 120)),
  ]
  const r = lerneFaktoren(EINS, b)
  assert.equal(r.faktoren.werkstatt, 0.9)
  assert.equal(r.faktoren.montage, 1.1)
  assert.equal(r.faktoren.oberflaeche, 1)
})

test('Die Deckelung haelt auch beim Lernen', () => {
  let f = { ...EINS }
  // Zwanzig Runden mit derselben starken Korrektur
  for (let i = 0; i < 20; i++) {
    f = lerneFaktoren(f, Array.from({ length: 5 }, () => beob('werkstatt', 100, 40))).faktoren
  }
  assert.ok(f.werkstatt >= 0.6, `Deckelung durchbrochen: ${f.werkstatt}`)
})

test('Ein bereits kalibrierter Faktor wird weiter nachgezogen, nicht ersetzt', () => {
  const alt = { ...EINS, werkstatt: 0.8 }
  const b = Array.from({ length: 3 }, () => beob('werkstatt', 100, 90))
  const r = lerneFaktoren(alt, b)
  // 0,8 * (1 + (0,9-1)*0,5) = 0,76
  assert.equal(r.faktoren.werkstatt, 0.76)
})

test('Die Begruendung nennt Bereich, Werte und Anzahl', () => {
  const b = Array.from({ length: 4 }, () => beob('oberflaeche', 100, 70))
  const r = lerneFaktoren(EINS, b)
  assert.equal(r.begruendung.length, 1)
  assert.match(r.begruendung[0], /Oberfläche/)
  assert.match(r.begruendung[0], /4 gewonnenen Angeboten/)
  assert.match(r.begruendung[0], /knapper/)
})

test('Ohne Veraenderung gibt es keine Begruendung', () => {
  const b = Array.from({ length: 3 }, () => beob('werkstatt', 100, 100))
  assert.equal(lerneFaktoren(EINS, b).begruendung.length, 0)
})

test('Der Median rechnet richtig', () => {
  assert.equal(median([]), 1)
  assert.equal(median([2]), 2)
  assert.equal(median([1, 2, 3]), 2)
  assert.equal(median([1, 2, 3, 4]), 2.5)
  assert.equal(median([3, 1, 2]), 2)
})

test('Kostenstellen werden dem richtigen Bereich zugeordnet', () => {
  assert.equal(bereichFuer('Zuschnitt'), 'werkstatt')
  assert.equal(bereichFuer('Oberfläche'), 'oberflaeche')
  assert.equal(bereichFuer('Montage'), 'montage')
  assert.equal(bereichFuer('Lieferung'), 'montage')
  // Der Fixsockel lernt NICHT mit — er skaliert nicht mit der Betriebsgroesse.
  assert.equal(bereichFuer('Besprechung'), null)
  assert.equal(bereichFuer('Planung'), null)
  assert.equal(bereichFuer('Konstruktion'), null)
  assert.equal(bereichFuer('Arbeitsvorbereitung'), null)
})

test('Nullwerte und Unsinn stuerzen nicht ab', () => {
  const b = [beob('werkstatt', 0, 50), beob('werkstatt', NaN, 10), beob('werkstatt', 100, -5)]
  assert.deepEqual(lerneFaktoren(EINS, b).faktoren, EINS)
})

import { beobachtungenAus } from '../src/lib/lernschleife.ts'

const angebot = (minuten) => ({ positionen: [{ id: 1, arbeitszeit: [
  { kostenstelle: 'Zuschnitt', minuten: minuten.zuschnitt },
  { kostenstelle: 'Zusammenbau', minuten: minuten.zusammenbau },
  { kostenstelle: 'Montage', minuten: minuten.montage },
  { kostenstelle: 'Besprechung', minuten: 20 },
] }] })

test('Aus zwei Fassungen entstehen Beobachtungen je Bereich', () => {
  const b = beobachtungenAus(
    angebot({ zuschnitt: 200, zusammenbau: 400, montage: 240 }),
    angebot({ zuschnitt: 150, zusammenbau: 330, montage: 240 }))
  const werkstatt = b.find(x => x.bereich === 'werkstatt')
  assert.equal(werkstatt.vorher, 600)
  assert.equal(werkstatt.nachher, 480)
  const montage = b.find(x => x.bereich === 'montage')
  assert.equal(montage.vorher, 240)
  assert.equal(montage.nachher, 240)
})

test('Der Fixsockel erzeugt keine Beobachtung', () => {
  const b = beobachtungenAus(
    angebot({ zuschnitt: 200, zusammenbau: 400, montage: 240 }),
    angebot({ zuschnitt: 200, zusammenbau: 400, montage: 240 }))
  assert.equal(b.some(x => x.bereich === 'werkstatt'), true)
  assert.equal(b.length, 2)
})

test('Verschieben innerhalb eines Bereichs sagt nichts aus', () => {
  const b = beobachtungenAus(
    angebot({ zuschnitt: 200, zusammenbau: 400, montage: 240 }),
    angebot({ zuschnitt: 100, zusammenbau: 500, montage: 240 }))
  const werkstatt = b.find(x => x.bereich === 'werkstatt')
  assert.equal(werkstatt.vorher, werkstatt.nachher)
})

test('Positionen ohne Gegenstueck werden uebersprungen', () => {
  const a = { positionen: [{ id: 1, arbeitszeit: [{ kostenstelle: 'Zuschnitt', minuten: 100 }] }] }
  const c = { positionen: [{ id: 2, arbeitszeit: [{ kostenstelle: 'Zuschnitt', minuten: 50 }] }] }
  assert.deepEqual(beobachtungenAus(a, c), [])
})

test('Leere oder fehlende Angebote stuerzen nicht ab', () => {
  assert.deepEqual(beobachtungenAus(null, null), [])
  assert.deepEqual(beobachtungenAus({}, {}), [])
  assert.deepEqual(beobachtungenAus(undefined, angebot({ zuschnitt: 1, zusammenbau: 1, montage: 1 })), [])
})

// ── Die beiden Module muessen dieselbe Aufteilung benutzen (2026-09-07) ──────

import { wendeFaktorenAn } from '../src/lib/zeitfaktoren.ts'

test('Was der Faktor verändert, beobachtet die Schleife auch', () => {
  // DIE KOPPLUNG: Veraendert der Werkstattfaktor eine Kostenstelle, muss die
  // Lernschleife sie als "werkstatt" beobachten — sonst korrigiert der Nutzer
  // Zeiten, die nie gelernt werden, und die Faktoren laufen auseinander.
  //
  // Vorher zaehlten BEIDE Module die sieben Werkstattstellen einzeln auf. Azubi und
  // jede eigene Kostenstelle fielen durch beide Raster.
  const kostenstellen = [
    'Besprechung', 'Planung', 'Konstruktion', 'Arbeitsvorbereitung', 'Produktion',
    'Warenhandling', 'Zuschnitt', 'Bekantung', 'CNC', 'Oberfläche', 'Zusammenbau',
    'Verpacken', 'Azubi', 'Montage', 'Lieferung', 'Polieren von Hand', 'Furnieren',
  ]
  for (const ks of kostenstellen) {
    const nurWerkstatt = { werkstatt: 0.5, oberflaeche: 1, massivholz: 1, montage: 1 }
    const [zeile] = wendeFaktorenAn([{ kostenstelle: ks, minuten: 100 }], nurWerkstatt, false)
    const wirdSkaliert = zeile.minuten !== 100
    const wirdBeobachtet = bereichFuer(ks) === 'werkstatt'
    assert.equal(wirdSkaliert, wirdBeobachtet,
      `${ks}: Faktor wirkt=${wirdSkaliert}, Schleife beobachtet=${wirdBeobachtet}`)
  }
})

test('Der Fixsockel wird weder skaliert noch gelernt', () => {
  for (const ks of ['Besprechung', 'Planung', 'Konstruktion', 'Arbeitsvorbereitung'])
    assert.equal(bereichFuer(ks), null, `${ks} wird gelernt, obwohl es ein Sockel ist`)
})

test('Neue ids nach erneuter Analyse werfen das Angebot nicht aus der Schleife', () => {
  // Die id ist Date.now() + i, clientseitig vergeben. Wer sein Angebot ein zweites
  // Mal analysieren laesst, bekommt neue ids — und haette bis zum 2026-09-07 keine
  // einzige Beobachtung mehr beigetragen, ohne dass es auffaellt.
  const pos = (id, minuten) => ({
    id, titel: 'Einbauschrank Flur',
    arbeitszeit: [{ kostenstelle: 'Zuschnitt', minuten }],
  })
  const b = beobachtungenAus({ positionen: [pos(111, 200)] }, { positionen: [pos(999, 240)] })
  assert.deepEqual(b, [{ bereich: 'werkstatt', vorher: 200, nachher: 240 }])
})

test('Der Ausweichweg paart niemals zwei verschiedene Möbel', () => {
  const a = { id: 1, titel: 'Einbauschrank', arbeitszeit: [{ kostenstelle: 'Zuschnitt', minuten: 200 }] }
  const b = { id: 2, titel: 'Küchenzeile',   arbeitszeit: [{ kostenstelle: 'Zuschnitt', minuten: 900 }] }
  assert.deepEqual(beobachtungenAus({ positionen: [a] }, { positionen: [b] }), [],
    'Unterschiedliche Titel duerfen nicht gepaart werden')
  // Unterschiedliche Anzahl: ebenfalls kein Ausweichweg.
  const c = { id: 3, titel: 'Einbauschrank', arbeitszeit: [{ kostenstelle: 'Zuschnitt', minuten: 240 }] }
  assert.deepEqual(beobachtungenAus({ positionen: [a] }, { positionen: [c, b] }), [])
})
