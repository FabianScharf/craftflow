import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  MAX_ZEICHEN_JE_BLOCK, MAX_BILDER_JE_BLOCK,
  schnittRang, schneideText, teileInBloecke, blockInfos,
} from '../src/lib/bloecke.ts'
import { bloeckeAblehnung } from '../src/lib/plantexte.ts'

test('Die Grenzen stehen fest: 8.000 Zeichen und 6 Bilder je Block', () => {
  assert.equal(MAX_ZEICHEN_JE_BLOCK, 8000)
  assert.equal(MAX_BILDER_JE_BLOCK, 6)
})

test('Schnittstellen werden nach Rang erkannt: Positionsnummer vor Seite vor Absatz', () => {
  assert.equal(schnittRang('1.2 Einbauschrank Flur', 'irgendwas'), 3)
  assert.equal(schnittRang('01.03.0040  Drehtür', 'x'), 3)
  assert.equal(schnittRang('Pos. 4 Garderobe', 'x'), 3)
  assert.equal(schnittRang('--- Seite 12 ---', 'x'), 2)
  assert.equal(schnittRang('\fSeite 13', 'x'), 2)
  assert.equal(schnittRang('Nach einer Leerzeile', ''), 1)
  assert.equal(schnittRang('Mitten im Absatz', 'davor'), 0)
  assert.equal(schnittRang('', 'davor'), 0, 'eine Leerzeile ist selbst keine Grenze')
})

test('Kurzer Text bleibt ein Block', () => {
  assert.deepEqual(schneideText('Ein Satz.', 8000), ['Ein Satz.'])
  assert.deepEqual(schneideText('   ', 8000), [])
  assert.deepEqual(schneideText('', 8000), [])
})

test('Geschnitten wird an Positionsnummern — und nichts geht verloren', () => {
  // NICHTS WIRD MEHR STUMM GEKUERZT: Der Test prueft nicht nur die Schnittstellen,
  // sondern dass alle Zeilen wieder auftauchen. Genau daran ist die alte
  // 10.000-Zeichen-Kuerzung gescheitert — sie hat schweigend weggeworfen.
  const zeilen = []
  for (let i = 1; i <= 20; i++) {
    zeilen.push(`${i}.1 Position ${i}`)
    zeilen.push('Beschreibung: ' + 'x'.repeat(40))
  }
  const text = zeilen.join('\n')
  const teile = schneideText(text, 200)
  assert.ok(teile.length > 1, 'es muss geschnitten werden')
  for (const t of teile) {
    assert.ok(/^\d+\.1 Position /.test(t), `Block beginnt nicht an einer Position: ${t.slice(0, 40)}`)
  }
  assert.equal(teile.join('\n'), text, 'kein Zeichen darf verloren gehen')
})

test('Ohne Positionsnummern fällt der Schnitt auf Seitengrenzen zurück, dann auf Absätze', () => {
  const mitSeiten = ['A'.repeat(90), '--- Seite 2 ---', 'B'.repeat(90), '--- Seite 3 ---', 'C'.repeat(90)].join('\n')
  const teileS = schneideText(mitSeiten, 120)
  assert.ok(teileS.length >= 2)
  assert.ok(teileS[1].startsWith('--- Seite'), 'der zweite Block beginnt an einer Seitengrenze')

  const mitAbsaetzen = ['A'.repeat(90), '', 'B'.repeat(90), '', 'C'.repeat(90)].join('\n')
  const teileA = schneideText(mitAbsaetzen, 120)
  assert.ok(teileA.length >= 2)
  assert.ok(teileA[1].startsWith('B'), 'der zweite Block beginnt am Absatz')
})

test('Eine einzelne überlange Zeile wird nicht weggeworfen', () => {
  const lang = 'y'.repeat(500)
  const teile = schneideText(`kurz\n${lang}\nkurz2`, 100)
  assert.ok(teile.some(t => t.includes(lang)), 'die lange Zeile fehlt')
  assert.equal(teile.join('\n'), `kurz\n${lang}\nkurz2`)
})

test('Bilder werden in Upload-Reihenfolge verteilt, höchstens sechs je Block', () => {
  const bilder = Array.from({ length: 14 }, (_, i) => `p/${i}.jpg`)
  const bloecke = teileInBloecke('nur ein kurzer Text', bilder, 8000, 6)
  assert.equal(bloecke.length, 3, '14 Bilder ergeben drei Blöcke')
  assert.deepEqual(bloecke.map(b => b.bilder.length), [6, 6, 2])
  assert.deepEqual(bloecke.flatMap(b => b.bilder), bilder, 'kein Bild fällt weg, Reihenfolge bleibt')
  assert.deepEqual(bloecke.map(b => b.nr), [1, 2, 3])
  assert.equal(bloecke[0].text, 'nur ein kurzer Text')
  assert.equal(bloecke[1].text, '', 'Folgeblöcke ohne Text bekommen einen leeren Text, keinen erfundenen')
})

test('Text und Bilder zusammen: die Blockzahl richtet sich nach dem, was mehr braucht', () => {
  const text = Array.from({ length: 6 }, (_, i) => `${i + 1}.1 Pos\n${'z'.repeat(80)}`).join('\n')
  const bloecke = teileInBloecke(text, ['a.jpg', 'b.jpg'], 100, 6)
  assert.ok(bloecke.length >= 6)
  assert.deepEqual(bloecke[0].bilder, ['a.jpg', 'b.jpg'])
  assert.deepEqual(bloecke[1].bilder, [])
  assert.equal(teileInBloecke('', [], 8000, 6).length, 0)
})

test('blockInfos beschreibt jeden Block, ohne den ganzen Text zu schicken', () => {
  const infos = blockInfos([
    { nr: 1, text: 'Zeile eins\nZeile zwei', bilder: ['a.jpg'] },
    { nr: 2, text: '', bilder: [] },
  ])
  assert.deepEqual(infos, [
    { nr: 1, vorschau: 'Zeile eins Zeile zwei', zeichen: 21, bilder: 1 },
    { nr: 2, vorschau: '', zeichen: 0, bilder: 0 },
  ])
  const lang = blockInfos([{ nr: 1, text: 'w'.repeat(300), bilder: [] }])[0]
  assert.equal(lang.vorschau.length, 123, '120 Zeichen plus " …"')
  assert.equal(lang.zeichen, 300)
})

test('Die Ablehnung nennt den Plan, der Blöcke freischaltet — wörtlich wie in der Spec', () => {
  assert.deepEqual(bloeckeAblehnung(), {
    error: 'Große Projekte in Blöcken sind ab dem Pro-Plan möglich.',
    minPlan: 'pro',
  })
})
