import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  zaehleTeile, plattenflaeche, erwarteteWerkstattzeit, deckelNachStueckliste, KEINE_TEILE,
} from '../src/lib/stueckliste.ts'

// ── Geeicht an zwei WIRKLICH gemessenen Kalkulationen ─────────────────────────

test('Referenzschrank: Formel trifft die gemessenen 695 min auf 10 % genau', () => {
  const teile = { drehtueren: 4, schiebetueren: 0, klappen: 0, schubladen: 2, einlegeboeden: 8 }
  const erwartet = erwarteteWerkstattzeit(16.1, teile)
  const gemessen = 695
  assert.ok(Math.abs(erwartet - gemessen) / gemessen < 0.10,
    `Formel ${erwartet} gegen gemessen ${gemessen}`)
})

test('Rollcontainer: Formel trifft die gemessenen 216 min auf 15 % genau', () => {
  const teile = { drehtueren: 0, schiebetueren: 0, klappen: 0, schubladen: 3, einlegeboeden: 0 }
  const erwartet = erwarteteWerkstattzeit(1.64, teile)
  const gemessen = 216
  assert.ok(Math.abs(erwartet - gemessen) / gemessen < 0.15,
    `Formel ${erwartet} gegen gemessen ${gemessen}`)
})

test('Es gibt jetzt ueberhaupt eine Grenze — sie faengt aber nur groben Ueberschuss', () => {
  // EHRLICHE EINORDNUNG (2026-09-07): Der Rollcontainer mit 8,8 h waere von dieser
  // Grenze NICHT gefangen worden. Dort lagen Zuschnitt + Zusammenbau bei 216 min,
  // klar unter dem Deckel. Die ueberschuessige Zeit steckte woanders: 1 h
  // Kantenanleimen, 0,8 h CNC, 1,4 h Planungsblock.
  //
  // Was die Stueckliste leistet: Wo vorher GAR NICHT geprueft wurde, gibt es jetzt
  // eine Obergrenze fuer den Hauptblock. Das faengt einen Ausreisser um Faktor zwei,
  // nicht eine ueber viele Kostenstellen verteilte Grosszuegigkeit.
  const teile = { drehtueren: 0, schiebetueren: 0, klappen: 0, schubladen: 3, einlegeboeden: 0 }
  const deckel = deckelNachStueckliste(1.64, teile)
  assert.ok(deckel > 0, 'Es gibt eine Grenze')
  assert.ok(deckel > 216, 'Der real gemessene Wert liegt darunter — richtigerweise')
  assert.ok(deckel < 700, `Deckel ${deckel} min faengt grobe Ausreisser`)
})

// ── Zaehlen aus dem Text ──────────────────────────────────────────────────────

test('Tueren, Schubkaesten und Boeden werden gezaehlt', () => {
  const t = zaehleTeile('Einbauschrank mit 4 Drehtüren, 2 Schubkästen und 8 Einlegeböden')
  assert.equal(t.drehtueren, 4)
  assert.equal(t.schubladen, 2)
  assert.equal(t.einlegeboeden, 8)
})

test('"4 Türen" ohne naehere Angabe zaehlen als Drehtueren', () => {
  assert.equal(zaehleTeile('Schrank mit 4 Türen').drehtueren, 4)
})

test('Neben Schiebetueren zaehlt "Türen" NICHT noch einmal mit', () => {
  const t = zaehleTeile('Schrank mit 2 Schiebetüren, insgesamt 2 Türen')
  assert.equal(t.schiebetueren, 2)
  assert.equal(t.drehtueren, 0)
})

test('Mehrere Nennungen werden summiert', () => {
  assert.equal(zaehleTeile('links 2 Schubladen, rechts 3 Schubladen').schubladen, 5)
})

test('Ohne Angaben null', () => {
  assert.deepEqual(zaehleTeile('Ein Möbel'), KEINE_TEILE)
  assert.deepEqual(zaehleTeile(''), KEINE_TEILE)
})

// ── Plattenflaeche ────────────────────────────────────────────────────────────

test('Nur Zeilen in Quadratmetern zaehlen', () => {
  const m = [
    { einheit: 'm2', menge: 10 },
    { einheit: 'm²', menge: 6 },
    { einheit: 'Stk', menge: 8 },
    { einheit: 'lfdm', menge: 30 },
  ]
  assert.equal(plattenflaeche(m), 16)
})

test('Fehlendes Material ergibt null', () => {
  assert.equal(plattenflaeche(undefined), 0)
  assert.equal(plattenflaeche([]), 0)
})

// ── Grenzen ───────────────────────────────────────────────────────────────────

test('Ohne Plattenflaeche gibt es keine Pruefgrundlage', () => {
  assert.equal(erwarteteWerkstattzeit(0, KEINE_TEILE), 0)
  assert.equal(deckelNachStueckliste(0, KEINE_TEILE), 0)
})

test('Mehr Ausstattung bedeutet mehr erwartete Zeit', () => {
  const wenig = erwarteteWerkstattzeit(5, KEINE_TEILE)
  const viel  = erwarteteWerkstattzeit(5, { ...KEINE_TEILE, drehtueren: 4, schubladen: 4 })
  assert.ok(viel > wenig)
})

test('Der Deckel ist doppelt so hoch wie die Erwartung', () => {
  const teile = { ...KEINE_TEILE, drehtueren: 2 }
  assert.equal(deckelNachStueckliste(8, teile), Math.round(erwarteteWerkstattzeit(8, teile) * 2))
})
