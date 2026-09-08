import { test } from 'node:test'
import assert from 'node:assert/strict'
// buildPDF selbst ist nicht per Test erreichbar: pdf.ts importiert types.ts, und
// Node kann in einer .ts-Datei keinen Pfad ohne Endung aufloesen. Die Logik liegt
// deshalb in pdftext.ts — der Rest ist Vorlage und wird live im Browser geprueft.
import { alsAbsaetze, SCHRIFTEN, fontFaces, anredeAus, positionsBloecke, unterNummer } from '../src/lib/pdftext.ts'
import { nettoSumme } from '../src/lib/types.ts'

const posten = (titel, betrag, extra = {}) => ({
  id: Math.round(Math.random() * 1e9), titel, beschreibung: '',
  material: [{ id: 1, bezeichnung: 'Platte', menge: 1, einheit: 'Stk', ekPreis: betrag, aufschlag: 0 }],
  arbeitszeit: [],
  ...extra,
})

// ── Absätze (Constantin Ludewigt, 2026-08-26) ───────────────────────────────

test('Eine Leerzeile wird ein eigener Absatz', () => {
  // "Wenn ich Absaetze einbaue, um das Geschriebene uebersichtlich zu gestalten,
  // dann werden die Absaetze nicht uebernommen und sind in der PDF als
  // absatzfreier Fliesstext eingesetzt."
  assert.equal(alsAbsaetze('Erster Absatz.\n\nZweiter Absatz.'),
    '<p>Erster Absatz.</p><p>Zweiter Absatz.</p>')
})

test('Ein einzelner Umbruch bleibt ein Umbruch, kein neuer Absatz', () => {
  assert.equal(alsAbsaetze('Zeile eins\nZeile zwei'), '<p>Zeile eins<br>Zeile zwei</p>')
})

test('Mehrere Leerzeilen erzeugen keine leeren Absätze', () => {
  assert.equal(alsAbsaetze('A\n\n\n\nB'), '<p>A</p><p>B</p>')
  assert.equal(alsAbsaetze('   '), '')
  assert.equal(alsAbsaetze(''), '')
})

test('Windows-Zeilenenden zählen genauso', () => {
  assert.equal(alsAbsaetze('A\r\n\r\nB'), '<p>A</p><p>B</p>')
})

test('Alle Textfelder laufen durch dieselbe Absatzfunktion', () => {
  // Vorher wurde `anschr` ROH eingesetzt. Sechs von acht Textfeldern hatten das
  // Problem. Dass sie jetzt alle alsAbsaetze() benutzen, prueft der Live-Test am
  // fertigen PDF — hier wird die Funktion selbst festgenagelt.
  const texte = [
    'herzlichen Dank für Ihr Vertrauen.\n\nHiermit erhalten Sie unseren Vorschlag.',
    'Zeile A.\n\nZeile B.',
  ]
  for (const t of texte) {
    const raus = alsAbsaetze(t)
    assert.equal((raus.match(/<p>/g) ?? []).length, 2, `${t} ergab keine zwei Absätze`)
  }
})

// ── Positionsüberschrift stand zweimal da ───────────────────────────────────

test('Ohne Gruppe entsteht kein Kopfblock — der Titel steht nur einmal', () => {
  // "Die Positionsueberschriften werden immer 2-mal aufgezaehlt." — stimmte:
  // Der Titel war hart in der Gruppen- UND in der Detailzeile.
  const bloecke = positionsBloecke([{ titel: 'Einbauschrank Flur' }])
  assert.equal(bloecke.length, 1)
  assert.equal(bloecke[0].gruppe, undefined, 'ohne Gruppe darf keine Kopfzeile entstehen')
  assert.equal(bloecke[0].teile.length, 1)
})

test('Aufeinanderfolgende Positionen derselben Gruppe bilden einen Block', () => {
  const bloecke = positionsBloecke([
    { titel: 'Korpusse', gruppe: 'Flurschrank' },
    { titel: 'Türen', gruppe: 'Flurschrank' },
    { titel: 'Arbeitsplatte', gruppe: 'Küche' },
  ])
  assert.equal(bloecke.length, 2)
  assert.equal(bloecke[0].gruppe, 'Flurschrank')
  assert.equal(bloecke[0].teile.length, 2)
  assert.equal(bloecke[1].gruppe, 'Küche')
})

test('Gleiche Gruppe, aber nicht hintereinander — zwei Blöcke', () => {
  // Sonst stünden im PDF Positionen unter einer Überschrift, zwischen denen etwas
  // anderes liegt. Das wäre falsch nummeriert und irreführend.
  const bloecke = positionsBloecke([
    { gruppe: 'Flurschrank' }, { gruppe: 'Küche' }, { gruppe: 'Flurschrank' },
  ])
  assert.equal(bloecke.length, 3)
})

test('Leere Gruppen zählen wie keine Gruppe', () => {
  const bloecke = positionsBloecke([{ gruppe: '' }, { gruppe: '   ' }, {}])
  assert.equal(bloecke.length, 3)
  assert.ok(bloecke.every(b => b.gruppe === undefined))
})

test('Die Nummerierung folgt dem Referenzangebot', () => {
  assert.equal(unterNummer(1, 1), '1.001')
  assert.equal(unterNummer(1, 2), '1.002')
  assert.equal(unterNummer(2, 13), '2.013')
})

// ── Alternativpositionen ────────────────────────────────────────────────────

test('Eine Alternativposition zählt nicht in die Summe', () => {
  // Aus dem Referenzangebot: Preis in Klammern, nicht in der Gesamtsumme.
  const normal = posten('Türen', 1000)
  const alternativ = posten('Türen in Eiche', 2000, { alternativ: true })
  assert.equal(nettoSumme([normal]), nettoSumme([normal, alternativ]),
    'Die Alternative hat die Summe verändert')
  assert.ok(nettoSumme([alternativ]) === 0)
})

// ── Schrift ─────────────────────────────────────────────────────────────────

test('Die Schrift wird mitgeliefert, sonst wirkt die Auswahl nicht', () => {
  // GEMESSEN: Auf Vercel ist genau EINE Schrift installiert (OpenSans-Regular).
  // Ohne @font-face waere jede Auswahl wirkungslos.
  const css = fontFaces('ptserif', 'https://app.getcraftflow.de')
  assert.ok(css.includes('@font-face'))
  assert.ok(css.includes('https://app.getcraftflow.de/fonts/pt-serif-400.woff2'))
  assert.ok(css.includes('https://app.getcraftflow.de/fonts/pt-serif-700.woff2'))
  assert.ok(css.includes("font-family:'PT Serif'"))
})

test('Ohne Basisadresse kein @font-face — dann gilt die Systemschrift', () => {
  assert.equal(fontFaces('inter', ''), '')
})

test('Jede angebotene Schrift hat Datei und Stapel für Normal und Fett', () => {
  for (const [id, s] of Object.entries(SCHRIFTEN)) {
    assert.equal(s.dateien.length, 2, `${id}: nicht zwei Schnitte`)
    assert.deepEqual(s.dateien.map(d => d.gewicht), [400, 700], `${id}: falsche Gewichte`)
    assert.ok(s.stapel.includes(s.name), `${id}: Name fehlt im Stapel`)
    // Ein Ersatz MUSS im Stapel stehen: Faellt der Abruf aus, darf das Angebot
    // nicht in einer Zufallsschrift erscheinen.
    assert.ok(s.stapel.split(',').length >= 3, `${id}: kein Ersatz im Stapel`)
  }
})

// ── Anrede ──────────────────────────────────────────────────────────────────

test('Anrede und Nachname sind einsetzbar', () => {
  assert.equal(
    anredeAus('Sehr geehrte/r {anrede} {nachname},', { name: 'Constantin Ludewigt', anrede: 'Herr', nachname: 'Ludewigt' }),
    'Sehr geehrte/r Herr Ludewigt,')
})

test('Ohne Nachname wird das letzte Wort des Namens genommen', () => {
  assert.equal(
    anredeAus('Sehr geehrte/r {anrede} {nachname},', { name: 'Constantin Ludewigt', anrede: 'Herr' }),
    'Sehr geehrte/r Herr Ludewigt,')
})

test('Ohne Anrede bleibt kein Leerzeichen vor dem Komma stehen', () => {
  // Genau der Punkt aus der Rueckmeldung: "Nach der Anrede sollte ein Komma stehen."
  // Ein "Sehr geehrte/r  Ludewigt ," waere schlimmer als vorher.
  assert.equal(
    anredeAus('Sehr geehrte/r {anrede} {nachname},', { name: 'Constantin Ludewigt' }),
    'Sehr geehrte/r Ludewigt,')
})

test('Die alte Vorlage mit {name} funktioniert unverändert weiter', () => {
  assert.equal(anredeAus('Liebe/r {name},', { name: 'Constantin Ludewigt' }),
    'Liebe/r Constantin Ludewigt,')
})

test('Ohne Vorlage und ohne Namen entsteht trotzdem eine gültige Anrede', () => {
  assert.equal(anredeAus('', {}), 'Liebe/r Kundin / Kunde,')
})
