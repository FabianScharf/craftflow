import { test } from 'node:test'
import assert from 'node:assert/strict'
import { funktionsseitenBlock } from '../src/lib/funktionsseiten.ts'
import { assistentWissen } from '../src/lib/assistentwissen.ts'

const SEITEN = [
  { slug: 'team', titel: 'Mitarbeiter einladen', kurz: 'Team arbeitet auf deinen Daten.', url: 'https://www.getcraftflow.de/werkstatt/team' },
  { slug: 'preisfaktor', titel: 'Ein Regler für dein Preisniveau', kurz: '', url: 'https://www.getcraftflow.de/werkstatt/preisfaktor' },
]

test('Der Block nennt jede Seite mit Titel und Adresse', () => {
  const b = funktionsseitenBlock(SEITEN)
  for (const s of SEITEN) {
    assert.ok(b.includes(s.titel), `Titel fehlt: ${s.titel}`)
    assert.ok(b.includes(s.url), `Adresse fehlt: ${s.url}`)
  }
})

// Ohne Seiten darf keine leere Überschrift entstehen — der Assistent würde sonst
// einen Abschnitt ankündigen, unter dem nichts steht.
test('Ohne Seiten entsteht kein leerer Abschnitt', () => {
  assert.equal(funktionsseitenBlock([]), '')
  assert.ok(!assistentWissen({ funktionsseiten: '' }).includes('AUSFÜHRLICHE ANLEITUNGEN'))
})

test('Das Wissen enthält den Block, wenn er übergeben wird', () => {
  const wissen = assistentWissen({ funktionsseiten: funktionsseitenBlock(SEITEN) })
  assert.ok(wissen.includes('AUSFÜHRLICHE ANLEITUNGEN IM NETZ'), 'Abschnitt fehlt')
  assert.ok(wissen.includes('werkstatt/team'), 'Adresse fehlt im Wissen')
})

// Erfundene Adressen sind der wahrscheinlichste Fehler eines Sprachmodells — die
// Anweisung dagegen muss im Block stehen.
test('Der Block verbietet erfundene Adressen ausdrücklich', () => {
  assert.ok(funktionsseitenBlock(SEITEN).includes('Nenne nie eine Adresse, die hier nicht steht'))
})
