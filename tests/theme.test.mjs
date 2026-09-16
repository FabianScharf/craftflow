import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  normalisiereHex, istHell, kontrast, leitePaletteAb, akzentTon, ton, PALETTE_DUNKEL,
} from '../src/lib/theme.ts'

// Kundenrueckmeldung vom 2026-09-15 (Tischlerei ueber Instagram): "wenn man einen
// weissen Hintergrund hat, ist die Schrift kaum noch lesbar" und "der Rotton ging
// leicht ins Lila". Diese Tests halten beides fest.

test('Farbcode: Raute fehlt, Kleinbuchstaben, Leerzeichen, Kurzform — alles wird bereinigt', () => {
  assert.equal(normalisiereHex('#C8102E'), '#C8102E')
  assert.equal(normalisiereHex('c8102e'), '#C8102E')
  assert.equal(normalisiereHex('  #c8102e '), '#C8102E')
  assert.equal(normalisiereHex('#F00'), '#FF0000')
  assert.equal(normalisiereHex('abc'), '#AABBCC')
})

test('Farbcode: Unsinn wird als ungueltig gemeldet, nicht still verschluckt', () => {
  assert.equal(normalisiereHex(''), null)
  assert.equal(normalisiereHex(null), null)
  assert.equal(normalisiereHex(undefined), null)
  assert.equal(normalisiereHex('#C8102'), null)
  assert.equal(normalisiereHex('#GG0000'), null)
  assert.equal(normalisiereHex('rot'), null)
  assert.equal(normalisiereHex('#C8102EFF'), null)
})

test('Hell oder dunkel: Weiss ist hell, Schwarz und ein dunkles Rot sind dunkel', () => {
  assert.equal(istHell('#FFFFFF'), true)
  assert.equal(istHell('#F5F2EE'), true)
  assert.equal(istHell('#0D0D0D'), false)
  assert.equal(istHell('#C8102E'), false)
  assert.equal(istHell('#FFD700'), true)
})

test('Dunkle Primaerfarbe: die Palette ist exakt die heutige — nichts aendert sich fuer Bestandsnutzer', () => {
  const p = leitePaletteAb('#0D0D0D', '#C8885A')
  assert.equal(p.primary, '#0D0D0D')
  assert.equal(p.accent, '#C8885A')
  assert.equal(p.text, PALETTE_DUNKEL.text)
  assert.equal(p.textMid, PALETTE_DUNKEL.textMid)
  assert.equal(p.surface1, PALETTE_DUNKEL.surface1)
  assert.equal(p.surface2, PALETTE_DUNKEL.surface2)
  assert.equal(p.border, PALETTE_DUNKEL.border)
  assert.equal(p.darkbg, PALETTE_DUNKEL.darkbg)
})

test('Weisse Primaerfarbe: Schrift wird dunkel, Flaechen werden hellgrau, alles bleibt lesbar', () => {
  const p = leitePaletteAb('#FFFFFF', '#C8102E')
  assert.ok(kontrast(p.text, p.primary) >= 7, 'Haupttext auf Hintergrund: ' + kontrast(p.text, p.primary))
  assert.ok(kontrast(p.textMid, p.primary) >= 4.5, 'Nebentext auf Hintergrund: ' + kontrast(p.textMid, p.primary))
  assert.ok(kontrast(p.text, p.surface1) >= 7, 'Haupttext auf Kaesten')
  assert.ok(kontrast(p.text, p.surface2) >= 7, 'Haupttext auf Eingabefeldern')
  assert.notEqual(p.surface1, p.primary, 'Kaesten muessen sich vom Hintergrund abheben')
  assert.ok(istHell(p.surface1) && istHell(p.surface2), 'Flaechen bleiben hell')
})

test('Beliebige Primaerfarben: Haupttext erreicht immer mindestens Kontrast 4,5', () => {
  for (const farbe of ['#FFFFFF', '#000000', '#808080', '#C8102E', '#FFD700', '#1F3A5F', '#E8E0D5', '#2E7D32', '#F8F8F8', '#444444']) {
    const p = leitePaletteAb(farbe, '#C8885A')
    assert.ok(kontrast(p.text, p.primary) >= 4.5, `${farbe}: Text ${p.text} auf ${p.primary} = ${kontrast(p.text, p.primary)}`)
    assert.ok(kontrast(p.text, p.surface2) >= 4.5, `${farbe}: Text auf Eingabefeld ${p.surface2}`)
  }
})

test('Ungueltige Primaerfarbe faellt auf die dunkle Standardpalette zurueck', () => {
  const p = leitePaletteAb('kaputt', 'auch kaputt')
  assert.equal(p.primary, PALETTE_DUNKEL.primary)
  assert.equal(p.accent, PALETTE_DUNKEL.accent)
})

test('Akzent-Toenung: gueltiges CSS statt Hex-Anhang an eine Variable', () => {
  // Frueher: `${C.copper}55` → "var(--c-accent, #C8885A)55" → ungueltig, Toenung fiel weg.
  const t = akzentTon('55')
  assert.match(t, /^color-mix\(in srgb, var\(--c-accent, #C8885A\) 33%, transparent\)$/)
  assert.equal(akzentTon('FF'), 'color-mix(in srgb, var(--c-accent, #C8885A) 100%, transparent)')
  assert.equal(akzentTon('0A'), 'color-mix(in srgb, var(--c-accent, #C8885A) 4%, transparent)')
})

test('Statusfarben: auf hellem Grund dunkel genug, auf dunklem Grund hell genug (Kontrast >= 4,5)', () => {
  for (const grund of ['#FFFFFF', '#F5F2EE', '#0D0D0D', '#1F3A5F']) {
    const p = leitePaletteAb(grund, '#C8885A')
    for (const f of ['ok', 'err', 'warn']) {
      assert.ok(kontrast(p[f], p.primary) >= 4.5, `${grund} ${f} ${p[f]}: ${kontrast(p[f], p.primary)}`)
    }
  }
})

test('ton(): beliebige Farbe mit Transparenz als color-mix', () => {
  assert.equal(ton('var(--c-ok, #5ABE6A)', '22'), 'color-mix(in srgb, var(--c-ok, #5ABE6A) 13%, transparent)')
})

test('Dunkle Primaerfarbe, die nicht Schwarz ist: Kaesten, Rahmen und Nebentext tragen ihren Ton', () => {
  // Fabian, 16.09.: Auf #955050 standen pechschwarze Kaesten — die festen Grautoene passten nur zu Schwarz.
  const p = leitePaletteAb('#955050', '#F6EEEF')
  const kanal = (hex, i) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16)
  for (const k of ['surface1', 'surface2', 'border', 'darkbg', 'textMid']) {
    assert.notEqual(p[k], PALETTE_DUNKEL[k], `${k} darf nicht das Standardgrau sein`)
    assert.ok(kanal(p[k], 0) > kanal(p[k], 1), `${k} bleibt rot getoent`)
  }
  assert.ok(kontrast(p.text, p.surface1) >= 4.5, 'Haupttext auf Kaesten lesbar')
  assert.ok(kontrast(p.textMid, p.primary) >= 3, 'Nebentext auf dem Grund erkennbar')
})
