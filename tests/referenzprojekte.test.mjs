// Die fuenf Referenzprojekte der Betriebskalibrierung.
//
// Diese Datei ist ZUERST entstanden (Spec-Task R1, Step 1). Sie haelt fest, was die
// Daten leisten muessen — nicht, was gerade herauskommt: Vollstaendigkeit der
// Stuecklisten, gueltige Kostenstellen, und vor allem die FAUSTREGEL-KONTROLLE.
// Die Faustregel (CLAUDE.md 6.1) setzt hier keinen Preis, sie prueft ihn.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  REFERENZPROJEKTE, STANDARDSAETZE_REFERENZ, mitSaetzen, summen, faustregelKontrolle,
  projektDatenAus, umgebucht,
} from '../src/lib/referenzprojekte.ts'

const AUFSCHLAG = 0.30

// Die 14 Kostenstellen, die "Mein Betrieb" kennt (ohne "Azubi", der in keiner
// Referenz vorkommt). Absichtlich hier wiederholt statt importiert — weicht das
// Modul davon ab, soll der Test es merken, nicht mitwandern.
const KOSTENSTELLEN = [
  'Besprechung', 'Planung', 'Konstruktion', 'Arbeitsvorbereitung',
  'Produktion', 'Warenhandling', 'Zuschnitt', 'Bekantung', 'CNC',
  'Oberfläche', 'Zusammenbau', 'Verpacken', 'Montage', 'Lieferung',
]

const SCHLUESSEL = ['einbauschrank', 'kueche', 'tueren', 'treppen', 'solitaer']
const alle = () => SCHLUESSEL.map(k => REFERENZPROJEKTE[k])
const bewertet = p => mitSaetzen(p, STANDARDSAETZE_REFERENZ, AUFSCHLAG)

// ── (a) Aufbau ───────────────────────────────────────────────────────────────

test('Es gibt genau fuenf Referenzprojekte', () => {
  assert.deepEqual(Object.keys(REFERENZPROJEKTE).sort(), [...SCHLUESSEL].sort())
})

test('Jedes Projekt hat Kunde, Text, Faustregel und mindestens eine Grundposition', () => {
  for (const p of alle()) {
    assert.ok(p.name.length > 0, `${p.schluessel}: Name fehlt`)
    assert.ok(p.text.length > 200, `${p.schluessel}: Text zu kurz`)
    assert.ok(p.kunde.name && p.kunde.strasse && p.kunde.ort && p.kunde.projekt,
      `${p.schluessel}: Kundendaten unvollstaendig`)
    assert.ok(p.faustregel.von > 0 && p.faustregel.bis > p.faustregel.von,
      `${p.schluessel}: Faustregel unbrauchbar`)
    assert.ok(p.faustregel.quelle.includes('CLAUDE.md'), `${p.schluessel}: Quelle fehlt`)
    const grund = p.positionen.filter(q => !q.alternativ)
    assert.ok(grund.length >= 1, `${p.schluessel}: keine Grundposition`)
    assert.ok(p.fragen.grund, `${p.schluessel}: keine Grundfrage`)
  }
})

test('Zu jeder gestellten Variantenfrage gibt es genau eine Alternativposition', () => {
  for (const p of alle()) {
    for (const v of ['lack', 'massiv', 'montage']) {
      const treffer = p.positionen.filter(q => q.variante === v)
      const erwartet = p.fragen[v] ? 1 : 0
      assert.equal(treffer.length, erwartet,
        `${p.schluessel}: ${treffer.length} Alternativen fuer "${v}", erwartet ${erwartet}`)
    }
  }
})

test('alternativ ist genau dann gesetzt, wenn eine Variante dranhaengt', () => {
  for (const p of alle()) {
    for (const q of p.positionen) {
      assert.equal(!!q.alternativ, !!q.variante,
        `${p.schluessel}/${q.titel}: alternativ und variante passen nicht zusammen`)
    }
  }
})

test('Positions-, Material- und Zeit-IDs sind je Projekt eindeutig', () => {
  for (const p of alle()) {
    const posIds = p.positionen.map(q => q.id)
    assert.equal(new Set(posIds).size, posIds.length, `${p.schluessel}: doppelte Positions-ID`)
    const zeilenIds = p.positionen.flatMap(q =>
      [...q.material.map(m => m.id), ...q.arbeitszeit.map(a => a.id)])
    assert.equal(new Set(zeilenIds).size, zeilenIds.length, `${p.schluessel}: doppelte Zeilen-ID`)
  }
})

// ── (b) Stueckliste und Kostenstellen ────────────────────────────────────────

test('Keine Materialzeile ohne Preis oder Menge', () => {
  for (const p of alle()) {
    for (const q of p.positionen) {
      for (const m of q.material) {
        assert.ok(m.ekPreis > 0, `${p.schluessel}/${q.titel}: "${m.bezeichnung}" hat EK ${m.ekPreis}`)
        assert.ok(m.menge > 0, `${p.schluessel}/${q.titel}: "${m.bezeichnung}" hat Menge ${m.menge}`)
        assert.ok(m.einheit.length > 0, `${p.schluessel}/${q.titel}: "${m.bezeichnung}" ohne Einheit`)
      }
    }
  }
})

test('Jede Zeitzeile sitzt auf einer bekannten Kostenstelle und hat Minuten', () => {
  for (const p of alle()) {
    for (const q of p.positionen) {
      for (const a of q.arbeitszeit) {
        assert.ok(KOSTENSTELLEN.includes(a.kostenstelle),
          `${p.schluessel}/${q.titel}: unbekannte Kostenstelle "${a.kostenstelle}"`)
        assert.ok(a.minuten > 0, `${p.schluessel}/${q.titel}: ${a.kostenstelle} mit ${a.minuten} min`)
      }
    }
  }
})

test('mitSaetzen setzt Stundensaetze und Aufschlag des Betriebs', () => {
  const eigene = { ...STANDARDSAETZE_REFERENZ, Zuschnitt: 99 }
  const pos = mitSaetzen(REFERENZPROJEKTE.einbauschrank, eigene, 0.45)
  for (const q of pos) {
    for (const a of q.arbeitszeit) {
      if (a.kostenstelle === 'Zuschnitt') assert.equal(a.vkStunde, 99)
      else assert.equal(a.vkStunde, eigene[a.kostenstelle])
    }
    for (const m of q.material) assert.equal(m.aufschlag, 0.45)
  }
})

test('mitSaetzen faellt auf den Platzhalter zurueck, wenn ein Satz fehlt', () => {
  const pos = mitSaetzen(REFERENZPROJEKTE.einbauschrank, { Zuschnitt: 99 }, 0.3)
  const roh = REFERENZPROJEKTE.einbauschrank.positionen
  for (let i = 0; i < pos.length; i++) {
    for (let j = 0; j < pos[i].arbeitszeit.length; j++) {
      const a = pos[i].arbeitszeit[j]
      if (a.kostenstelle !== 'Zuschnitt') {
        assert.equal(a.vkStunde, roh[i].arbeitszeit[j].vkStunde)
      }
    }
  }
})

test('mitSaetzen laesst die Vorlage unberuehrt', () => {
  const vorher = JSON.stringify(REFERENZPROJEKTE.kueche.positionen)
  mitSaetzen(REFERENZPROJEKTE.kueche, { Zuschnitt: 1 }, 0.99)
  assert.equal(JSON.stringify(REFERENZPROJEKTE.kueche.positionen), vorher)
})

// ── (c) Die Faustregel als KONTROLLE ─────────────────────────────────────────

test('Jede Grundsumme liegt in ihrer Faustregel-Spanne', () => {
  for (const p of alle()) {
    const s = summen(bewertet(p))
    assert.ok(s.netto >= p.faustregel.von && s.netto <= p.faustregel.bis,
      `${p.schluessel}: ${s.netto.toFixed(2)} € liegt nicht in ${p.faustregel.von}–${p.faustregel.bis} €`)
  }
})

// 2026-09-17, Fabian: Spanplatte 25 €/m² statt 14, CNC als eigene Kostenstelle.
// Die urspruenglich gemessenen 2.245 € / 409,50 € EK sind damit Geschichte; der
// Schrank liegt jetzt bei 2.528 € — am oberen Rand der Faustregel 1.800–2.600 €.
test('Der Einbauschrank liegt bei 2.528 € (Fabians Plattenpreis, CNC herausgeloest)', () => {
  const s = summen(bewertet(REFERENZPROJEKTE.einbauschrank))
  assert.ok(Math.abs(s.netto - 2528) <= 30, `Grundsumme war ${s.netto.toFixed(2)} €`)
})

test('Der Material-EK des Einbauschranks ist 584,50 € (409,50 € gemessen + 25 €/m² Platte)', () => {
  const grund = REFERENZPROJEKTE.einbauschrank.positionen.filter(q => !q.alternativ)
  const ek = grund.reduce((s, q) => s + q.material.reduce((t, m) => t + m.menge * m.ekPreis, 0), 0)
  assert.ok(Math.abs(ek - 584.5) <= 1, `Material-EK war ${ek.toFixed(2)} €`)
})

test('Der Einbauschrank und die Kueche tragen die Kostenstelle CNC', () => {
  for (const k of ['einbauschrank', 'kueche']) {
    const grund = REFERENZPROJEKTE[k].positionen.filter(q => !q.alternativ)
    assert.ok(grund.some(q => q.arbeitszeit.some(a => a.kostenstelle === 'CNC')), `${k}: keine CNC-Zeile`)
  }
})

test('Die Kueche liegt im Mittelfeld: 8.000–9.500 € netto ohne Geraete, ueber 70 Stunden', () => {
  // Fabian 2026-09-17: "Das ist insgesamt sehr wenig Zeit" (vorher 6.044 € / 23 h
  // Werkstatt) — "wir muessen ein gutes Mittelfeld abbilden".
  const s = summen(bewertet(REFERENZPROJEKTE.kueche))
  assert.ok(s.netto >= 8000 && s.netto <= 9500, `Kueche war ${s.netto.toFixed(2)} €`)
  assert.ok(s.stunden >= 70, `Kueche hat nur ${s.stunden.toFixed(1)} h`)
})

test('Jeder Unterschrank mit Drehtuer braucht mindestens 3,5 Stunden je Stueck', () => {
  const pos = REFERENZPROJEKTE.kueche.positionen.find(q => q.titel.startsWith('Unterschrank mit Drehtür'))
  const min = pos.arbeitszeit.reduce((s, a) => s + a.minuten, 0)
  assert.ok(min >= 210, `nur ${min} min je Stueck`)
  assert.equal(pos.material.find(m => m.bezeichnung.startsWith('Griff')).menge, 2, 'zwei Tueren, zwei Griffe')
})

// ── umgebucht: Betrieb ohne CNC / Kantenanleimmaschine ───────────────────────

test('umgebucht ohne CNC: keine CNC-Zeile mehr, Minuten × 1,6 auf dem Zusammenbau', () => {
  const p = REFERENZPROJEKTE.kueche
  const u = umgebucht(p, ['CNC'])
  assert.notEqual(u, p)
  for (let i = 0; i < p.positionen.length; i++) {
    const vorher = p.positionen[i], nachher = u.positionen[i]
    const cnc = vorher.arbeitszeit.find(a => a.kostenstelle === 'CNC')?.minuten ?? 0
    assert.equal(nachher.arbeitszeit.some(a => a.kostenstelle === 'CNC'), false, `${vorher.titel}: CNC noch da`)
    const zbVor = vorher.arbeitszeit.find(a => a.kostenstelle === 'Zusammenbau')?.minuten ?? 0
    const zbNach = nachher.arbeitszeit.find(a => a.kostenstelle === 'Zusammenbau')?.minuten ?? 0
    assert.equal(zbNach, zbVor + Math.round(cnc * 1.6), `${vorher.titel}: Zusammenbau ${zbNach} statt ${zbVor + Math.round(cnc * 1.6)}`)
  }
  const sVor = summen(bewertet(p)), sNach = summen(mitSaetzen(u, STANDARDSAETZE_REFERENZ, AUFSCHLAG))
  assert.ok(sNach.stunden > sVor.stunden, 'ohne CNC muessen es MEHR Stunden sein')
})

test('umgebucht laesst die Vorlage unberuehrt und vergibt eindeutige Zeilen-IDs', () => {
  const p = REFERENZPROJEKTE.einbauschrank
  const vorher = JSON.stringify(p.positionen)
  const u = umgebucht(p, ['CNC', 'Bekantung'])
  assert.equal(JSON.stringify(p.positionen), vorher)
  const ids = u.positionen.flatMap(q => q.arbeitszeit.map(a => a.id))
  assert.equal(new Set(ids).size, ids.length)
  assert.ok(ids.every(id => Number.isInteger(id) && id > 0))
})

test('umgebucht ignoriert Kostenstellen ohne Handarbeits-Ziel (Montage) und leere Listen', () => {
  const p = REFERENZPROJEKTE.kueche
  assert.equal(umgebucht(p, ['Montage']), p)
  assert.equal(umgebucht(p, []), p)
  assert.equal(umgebucht(p, ['Zuschnitt']), p)
})

test('Der Massivholz-EK des Einbauschranks ist die gemessene Summe 1.770 €', () => {
  const alt = REFERENZPROJEKTE.einbauschrank.positionen.find(q => q.variante === 'massiv')
  const ek = alt.material.reduce((s, m) => s + m.menge * m.ekPreis, 0)
  assert.ok(Math.abs(ek - 1770) <= 1, `Massiv-EK war ${ek.toFixed(2)} €`)
})

test('summen trennt Material und Arbeit und zaehlt Alternativen nur auf Wunsch', () => {
  const pos = bewertet(REFERENZPROJEKTE.einbauschrank)
  const nurGrund = summen(pos)
  const alles = summen(pos, false)
  assert.ok(Math.abs((nurGrund.material + nurGrund.arbeit) - nurGrund.netto) < 0.01)
  assert.ok(alles.netto > nurGrund.netto, 'Alternativen fehlen in der Gesamtsumme')
  assert.ok(nurGrund.stunden > 0 && alles.stunden > nurGrund.stunden)
})

// ── (d) Die Alternativen ─────────────────────────────────────────────────────

const alternative = (p, v) => {
  const pos = bewertet(p)
  const treffer = pos.find(q => q.variante === v)
  return treffer ? summen([treffer], false).netto : null
}

test('Lack- und Massivholz-Alternativen sind teurer als die Grundausfuehrung', () => {
  for (const p of alle()) {
    const grund = summen(bewertet(p)).netto
    for (const v of ['lack', 'massiv']) {
      const preis = alternative(p, v)
      if (preis === null) continue
      assert.ok(preis > grund,
        `${p.schluessel}/${v}: ${preis.toFixed(2)} € ist nicht teurer als ${grund.toFixed(2)} €`)
    }
  }
})

test('Die Montage-Alternative kostet mehr Zeit, aber kein zusaetzliches Material', () => {
  for (const p of alle()) {
    const preis = alternative(p, 'montage')
    if (preis === null) continue
    const grund = summen(bewertet(p))
    const alt = summen(bewertet(p).filter(q => q.variante === 'montage'), false)
    assert.ok(Math.abs(alt.material - grund.material) < 0.01,
      `${p.schluessel}: Montage-Alternative aendert das Material`)
    assert.ok(alt.stunden > grund.stunden, `${p.schluessel}: Montage-Alternative ohne Mehrzeit`)
    assert.ok(preis > grund.netto)
  }
})

test('Kueche: massiv teurer als Grund, Lack-Aufpreis positiv und kleiner als der Grundpreis', () => {
  const p = REFERENZPROJEKTE.kueche
  const grund = summen(bewertet(p)).netto
  const massiv = alternative(p, 'massiv')
  const lackAufpreis = alternative(p, 'lack') - grund
  assert.ok(massiv > grund, `massiv ${massiv.toFixed(2)} <= grund ${grund.toFixed(2)}`)
  assert.ok(grund > lackAufpreis, `Lack-Aufpreis ${lackAufpreis.toFixed(2)} >= grund`)
  assert.ok(lackAufpreis > 0, `Lack-Aufpreis ${lackAufpreis.toFixed(2)} ist nicht positiv`)
})

test('Eine Alternative beschreibt IMMER das ganze Projekt, nicht nur den Unterschied', () => {
  // Sonst waeren die Antwortspannen aus Grundpreis und Alternativpreis nicht
  // vergleichbar — genau der Fehler, den die alte Formel-Referenz hatte.
  for (const p of alle()) {
    const grund = summen(bewertet(p))
    for (const q of bewertet(p).filter(x => x.alternativ)) {
      const s = summen([q], false)
      assert.ok(s.stunden > grund.stunden * 0.8,
        `${p.schluessel}/${q.variante}: nur ${s.stunden.toFixed(1)} h gegen ${grund.stunden.toFixed(1)} h Grund`)
    }
  }
})

// ── (e) Faustregel-Kontrolle ─────────────────────────────────────────────────

test('faustregelKontrolle meldet im Rahmen, darunter und darueber', () => {
  const f = { von: 1800, bis: 2600, quelle: 'CLAUDE.md 6.1' }
  const drin = faustregelKontrolle(2245, f)
  assert.equal(drin.imRahmen, true)
  assert.ok(drin.text.includes('liegt im Rahmen'), drin.text)
  assert.ok(drin.text.includes('1.800') && drin.text.includes('2.600'), drin.text)

  const drunter = faustregelKontrolle(1200, f)
  assert.equal(drunter.imRahmen, false)
  assert.ok(drunter.text.includes('darunter'), drunter.text)
  assert.ok(drunter.text.includes('Zeitrichtwerte'), drunter.text)

  const drueber = faustregelKontrolle(4000, f)
  assert.equal(drueber.imRahmen, false)
  assert.ok(drueber.text.includes('darüber'), drueber.text)
})

test('Zu breite Faustregeln werden nicht angezeigt — die Kueche (5.000–20.000 €) bleibt reine Kontrolle', () => {
  const k = REFERENZPROJEKTE.kueche
  assert.equal(faustregelKontrolle(8593, k.faustregel).anzeigen, false)
  assert.equal(faustregelKontrolle(8593, k.faustregel).imRahmen, true)
  for (const s of ['einbauschrank', 'tueren', 'treppen', 'solitaer']) {
    assert.equal(faustregelKontrolle(1, REFERENZPROJEKTE[s].faustregel).anzeigen, true, `${s} muss angezeigt werden`)
  }
})

test('Die Bandgrenzen selbst gelten noch als im Rahmen', () => {
  const f = { von: 1800, bis: 2600, quelle: 'CLAUDE.md 6.1' }
  assert.equal(faustregelKontrolle(1800, f).imRahmen, true)
  assert.equal(faustregelKontrolle(2600, f).imRahmen, true)
})

// ── Sonderregeln einzelner Referenzen ────────────────────────────────────────

test('Tueren und Treppe fragen ohne Material, Tueren rechnen je Stueck', () => {
  assert.deepEqual(REFERENZPROJEKTE.tueren.ohneMaterial, ['grund', 'massiv'])
  assert.deepEqual(REFERENZPROJEKTE.treppen.ohneMaterial, ['grund'])
  for (const k of ['grund', 'lack', 'massiv', 'montage']) {
    assert.equal(REFERENZPROJEKTE.tueren.teiler[k], 5, `Teiler fuer "${k}" fehlt`)
  }
})

test('Treppe und Tisch stellen keine Massivholzfrage — sie SIND massiv', () => {
  assert.equal(REFERENZPROJEKTE.treppen.fragen.massiv, undefined)
  assert.equal(REFERENZPROJEKTE.solitaer.fragen.massiv, undefined)
  assert.equal(REFERENZPROJEKTE.treppen.positionen.some(q => q.variante === 'massiv'), false)
  assert.equal(REFERENZPROJEKTE.solitaer.positionen.some(q => q.variante === 'massiv'), false)
})

test('Der Tisch wird geliefert, nicht montiert', () => {
  const grund = REFERENZPROJEKTE.solitaer.positionen.filter(q => !q.alternativ)
  const ks = grund.flatMap(q => q.arbeitszeit.map(a => a.kostenstelle))
  assert.ok(ks.includes('Lieferung'))
  assert.equal(ks.includes('Montage'), false)
})

// ── projektDatenAus (Task R3: "Als Projekt öffnen") ──────────────────────────

test('projektDatenAus liefert genau die Form, in der die App ein Projekt speichert', () => {
  const p = REFERENZPROJEKTE.einbauschrank
  const positionen = mitSaetzen(p, STANDARDSAETZE_REFERENZ, AUFSCHLAG)
  const d = projektDatenAus(p, positionen, '17.9.2026')

  assert.deepEqual(Object.keys(d).sort(), [
    'anschr', 'angebotsdatum', 'bausteinIds', 'docNr', 'docTyp', 'kunde', 'pos', 'widerruf',
  ].sort())
  assert.deepEqual(d.kunde, {
    name: p.kunde.name, zusatz: '', strasse: p.kunde.strasse, ort: p.kunde.ort, projekt: p.kunde.projekt,
  })
  assert.equal(d.docNr, '')
  assert.equal(d.docTyp, 'Angebot')
  assert.equal(d.anschr, '')
  assert.equal(d.widerruf, false)
  assert.equal(d.angebotsdatum, '17.9.2026')
  assert.deepEqual(d.bausteinIds, [])
})

test('projektDatenAus vergibt frische fortlaufende IDs und behaelt alternativ, streicht variante', () => {
  const p = REFERENZPROJEKTE.einbauschrank
  const positionen = mitSaetzen(p, STANDARDSAETZE_REFERENZ, AUFSCHLAG)
  const d = projektDatenAus(p, positionen, '17.9.2026')

  assert.deepEqual(d.pos.map(q => q.id), positionen.map((_, i) => i + 1))
  assert.equal(d.pos.length, positionen.length)
  for (const q of d.pos) assert.equal('variante' in q, false, `${q.titel} traegt noch "variante"`)

  const alternative = positionen.filter(q => q.alternativ)
  assert.ok(alternative.length > 0)
  assert.equal(d.pos.filter(q => q.alternativ).length, alternative.length)
})

test('projektDatenAus veraendert die uebergebene Positionsliste nicht (Kopien)', () => {
  const p = REFERENZPROJEKTE.einbauschrank
  const positionen = mitSaetzen(p, STANDARDSAETZE_REFERENZ, AUFSCHLAG)
  const idsVorher = positionen.map(q => q.id)
  projektDatenAus(p, positionen, '17.9.2026')
  assert.deepEqual(positionen.map(q => q.id), idsVorher)
})
