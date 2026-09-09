import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {
  assistentWissen, EINSTELLUNGSBEREICHE, PFLICHTTHEMEN,
} from '../src/lib/assistentwissen.ts'

// Fabian am 2026-09-08: "Weiß der Assistent immer über alle Funktionen Bescheid?
// Auch jede Neuerung?"
//
// Von selbst nicht — sein Wissen ist geschriebener Text. Am 2026-09-08 kannte er von
// den Neuerungen der Woche KEINE EINZIGE. Diese Tests sind die Vorkehrung dagegen:
// Wer etwas ergänzt und den Assistenten vergisst, bekommt einen roten Test statt
// eines falsch beratenen Nutzers.

test('Der Assistent kennt jeden Bereich der Einstellungen', () => {
  const wissen = assistentWissen()
  for (const b of EINSTELLUNGSBEREICHE) {
    assert.ok(wissen.includes(b.label), `Bereich "${b.label}" fehlt im Wissen`)
  }
})

test('Die Bereichsliste stimmt mit der Einstellungsseite überein', () => {
  // DER EIGENTLICHE WÄCHTER: Liest die echte Navigation aus der Oberfläche und
  // vergleicht. Wer einen Bereich ergänzt, ohne den Assistenten zu erweitern,
  // faellt hier auf.
  const quelle = fs.readFileSync('src/app/settings/page.tsx', 'utf8')
  const navBlock = quelle.slice(
    quelle.indexOf('const navItems'),
    quelle.indexOf('const groups = groupKostenstellen'),
  )
  const ids = [...navBlock.matchAll(/\{\s*id:\s*'([a-z]+)'/g)].map(m => m[1])
  assert.ok(ids.length > 8, `nur ${ids.length} Bereiche gefunden — Auslesen kaputt?`)

  const bekannt = new Set(EINSTELLUNGSBEREICHE.map(b => b.id))
  for (const id of ids) {
    // "admin" ist nur fuer Fabian sichtbar und gehoert nicht in die Nutzerhilfe.
    if (id === 'admin') continue
    assert.ok(bekannt.has(id),
      `Der Einstellungsbereich "${id}" ist dem Assistenten unbekannt. ` +
      `Ergaenze ihn in EINSTELLUNGSBEREICHE (src/lib/assistentwissen.ts).`)
  }
})

test('Jedes Pflichtthema kommt im Wissen vor', () => {
  // Ohne Ruecksicht auf Gross- und Kleinschreibung: Im Wissen stehen manche
  // Stichworte in Versalien ("GRUPPE:"), das ist Gestaltung, kein Unterschied.
  const wissen = assistentWissen().toLowerCase()
  for (const thema of PFLICHTTHEMEN) {
    assert.ok(wissen.includes(thema.toLowerCase()), `Thema "${thema}" fehlt im Wissen`)
  }
})

test('Ohne echte Stundensätze nennt der Assistent keine Zahlen', () => {
  // ER TAT ES: "Besprechung (65 €/h)" stand als Tatsache im Text — die
  // Standardwerte, nicht die des Betriebs. Wer 85 eingestellt hatte, bekam 65
  // genannt. Eine erfundene Zahl ist schlimmer als keine.
  const ohne = assistentWissen()
  assert.ok(!/\(\d+ €\/h\)/.test(ohne), 'Es stehen Stundensätze im Wissen, obwohl keine übergeben wurden')
  assert.ok(ohne.includes('Nenne KEINE Stundensätze'), 'Der Hinweis fehlt, keine Sätze zu nennen')
})

test('Mit echten Sätzen nennt er genau diese', () => {
  const mit = assistentWissen({ saetze: { Besprechung: 85, Montage: 78 } })
  assert.ok(mit.includes('Besprechung (85 €/h)'))
  assert.ok(mit.includes('Montage (78 €/h)'))
  // Was nicht eingestellt ist, bekommt keine Zahl.
  assert.ok(mit.includes('→ CNC:'), 'CNC ohne Satz muss ohne Zahl dastehen')
  assert.ok(!mit.includes('CNC (120 €/h)'))
})

test('Der Assistent behauptet keine Kundenfelder, die es nicht gibt', () => {
  // ER TAT ES: Er beschrieb "Telefon, E-Mail des Kunden" und "interne Notizen" —
  // alle drei gibt es im Kundendatensatz nicht.
  const wissen = assistentWissen()
  const kundenteil = wissen.slice(wissen.indexOf('Reiter KUNDE'), wissen.indexOf('Reiter KALKULATION'))
  for (const erfunden of ['Telefon', 'interne Notizen', 'Interne Notizen']) {
    assert.ok(!kundenteil.includes(erfunden),
      `"${erfunden}" steht im Kundenteil, existiert aber nicht`)
  }
})

test('Das Wissen enthält kein Markdown — der Assistent soll keines ausgeben', () => {
  const wissen = assistentWissen()
  // Ueberschriften mit ## sind Struktur fuer das Modell und erlaubt. Gesucht wird
  // echte Auszeichnung — ein Paar Sternchen um Text, ein Codeabschnitt.
  //
  // Die Anweisung "Kein Markdown (keine **, keine ##, keine Backticks)" darf die
  // Zeichen selbst nennen; sie zeichnet nichts aus. Ein stumpfes includes('**')
  // ist deshalb der falsche Test — er schlug genau darauf an.
  const fett = wissen.match(/\*\*[^*\n]+\*\*/)
  assert.equal(fett, null, `Fettschrift im Wissen: ${fett?.[0]}`)
  const code = wissen.match(/`[^`\n]+`/)
  assert.equal(code, null, `Codeabschnitt im Wissen: ${code?.[0]}`)
})

test('Die genannte Anzahl der Kalibrierungsfragen stimmt mit der echten überein', async () => {
  // GENAU HIER IST ER SCHON EINMAL VERALTET: Im Wissen stand "neun Fragen". Das
  // stimmte für Einbauschrank, Küche und Türen — für Treppen und Solitärmöbel gibt
  // es aber nur drei Unterschiedsfragen, also acht. Eine feste Zahl im Text veraltet
  // stumm, sobald jemand eine Frage ergänzt oder streicht.
  //
  // Dieser Test rechnet die Spanne aus den echten Daten aus und vergleicht sie mit
  // dem, was im Wissen steht. Wer eine Frage ändert, bekommt einen roten Test.
  const { REFERENZEN, BETRIEBSFRAGEN } = await import('../src/lib/kalibrierung.ts')

  // Feste Fragen + die eine Preisfrage zum Referenzmöbel + die Unterschiedsfragen.
  const fest = Object.keys(BETRIEBSFRAGEN).length
  const gesamt = Object.values(REFERENZEN).map(r => fest + 1 + Object.keys(r.fragen ?? {}).length)
  const min = Math.min(...gesamt), max = Math.max(...gesamt)

  const WORT = ['null', 'eine', 'zwei', 'drei', 'vier', 'fünf', 'sechs', 'sieben',
    'acht', 'neun', 'zehn', 'elf', 'zwölf']
  assert.ok(max < WORT.length, `${max} Fragen — die Wortliste im Test reicht nicht mehr`)

  const wissen = assistentWissen().toLowerCase()
  const erwartet = min === max ? WORT[min] : `${WORT[min]} bis ${WORT[max]}`
  assert.ok(wissen.includes(erwartet),
    `Das Wissen nennt nicht "${erwartet} Fragen". Echte Spanne: ${min}–${max}. ` +
    `Bitte src/lib/assistentwissen.ts anpassen.`)

  // Und keine andere Zahl daneben, die der Nutzer für die richtige halten könnte.
  for (let n = 1; n < WORT.length; n++) {
    if (n >= min && n <= max) continue
    assert.ok(!wissen.includes(`${WORT[n]} fragen`),
      `Das Wissen nennt "${WORT[n]} Fragen" — es sind aber ${min}–${max}`)
  }
})
