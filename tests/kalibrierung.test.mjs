import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  REFERENZ, BAENDER, referenzPreis, berechneFaktoren, deckele,
} from '../src/lib/kalibrierung.ts'

const SAETZE = {
  Besprechung: 65, Planung: 85, Konstruktion: 75, Arbeitsvorbereitung: 75,
  Produktion: 65, Warenhandling: 65, Zuschnitt: 72, Bekantung: 100, CNC: 120,
  'Oberfläche': 72, Zusammenbau: 65, Verpacken: 65, Azubi: 52, Montage: 65, Lieferung: 65,
}
const AUFSCHLAG = 0.30

test('Die Referenzkalkulation ergibt einen plausiblen Gesamtpreis', () => {
  const r = referenzPreis(SAETZE, AUFSCHLAG)
  assert.ok(r.gesamt > 1900 && r.gesamt < 2600, `Gesamt war ${r.gesamt}`)
  assert.ok(Math.abs(r.material - 409.5 * 1.3) < 1)
  assert.ok(r.werkstatt > r.montage)
})

test('Die Summe der Bloecke ist der Gesamtpreis', () => {
  const r = referenzPreis(SAETZE, AUFSCHLAG)
  assert.ok(Math.abs((r.material + r.fixsockel + r.werkstatt + r.montage) - r.gesamt) < 0.01)
})

test('Wer die Bandmitte trifft, bekommt Faktor 1,0', () => {
  const r = referenzPreis(SAETZE, AUFSCHLAG)
  const f = berechneFaktoren(
    { grund: `test:${r.gesamt}`, lack: 'unbekannt', massiv: 'unbekannt', montage: 'unbekannt' },
    SAETZE, AUFSCHLAG)
  assert.ok(Math.abs(f.werkstatt - 1.0) < 0.02, `Faktor war ${f.werkstatt}`)
})

test('Ein guenstigerer Betrieb bekommt einen Faktor unter 1', () => {
  const f = berechneFaktoren(
    { grund: 'b2', lack: 'unbekannt', massiv: 'unbekannt', montage: 'unbekannt' },
    SAETZE, AUFSCHLAG)
  assert.ok(f.werkstatt < 1.0, `Faktor war ${f.werkstatt}`)
})

test('"weiss ich nicht" laesst Oberflaeche und Massivholz auf genau 1,0', () => {
  const f = berechneFaktoren(
    { grund: 'b3', lack: 'unbekannt', massiv: 'unbekannt', montage: 'unbekannt' },
    SAETZE, AUFSCHLAG)
  assert.equal(f.oberflaeche, 1.0)
  assert.equal(f.massivholz, 1.0)
})

test('Ohne Montage-Antwort erbt die Montage die Geschwindigkeit des Betriebs', () => {
  const f = berechneFaktoren(
    { grund: 'b3', lack: '', massiv: '', montage: 'unbekannt' }, SAETZE, AUFSCHLAG)
  assert.equal(f.montage, f.werkstatt)
})

test('Eine eigene Montage-Antwort ueberschreibt das Erbe', () => {
  const f = berechneFaktoren(
    { grund: 'b3', lack: '', massiv: '', montage: 'b4' }, SAETZE, AUFSCHLAG)
  assert.notEqual(f.montage, f.werkstatt)
  assert.ok(f.montage > 1)
})

test('Benachbarte Baender springen nicht mehr als 0,4', () => {
  const reihe = ['b1', 'b2', 'b3', 'b4', 'b5']
    .map(b => berechneFaktoren({ grund: b, lack: '', massiv: '', montage: '' }, SAETZE, AUFSCHLAG).werkstatt)
  for (let i = 1; i < reihe.length; i++) {
    assert.ok(reihe[i] - reihe[i - 1] <= 0.4,
      `Sprung von ${reihe[i - 1]} auf ${reihe[i]} ist zu hart`)
  }
})

test('"mache ich nicht" laesst den Faktor ebenfalls auf 1,0', () => {
  const f = berechneFaktoren(
    { grund: 'b3', lack: 'nicht', massiv: 'nicht', montage: 'nicht' },
    SAETZE, AUFSCHLAG)
  assert.equal(f.oberflaeche, 1.0)
  assert.equal(f.massivholz, 1.0)
})

test('Eine unbeantwortete Frage erzeugt keinen Faktor', () => {
  const f = berechneFaktoren({ grund: '', lack: '', massiv: '', montage: '' }, SAETZE, AUFSCHLAG)
  assert.deepEqual(f, { werkstatt: 1, oberflaeche: 1, massivholz: 1, montage: 1 })
})

test('Die Deckelung haelt in beide Richtungen', () => {
  assert.equal(deckele(0.1), 0.6)
  assert.equal(deckele(9), 1.4)
  assert.equal(deckele(0.83), 0.83)
})

test('Auch ein extremes Band sprengt die Deckelung nicht', () => {
  const f = berechneFaktoren(
    { grund: 'b1', lack: 'b5', massiv: 'b5', montage: 'b5' },
    SAETZE, AUFSCHLAG)
  for (const [name, wert] of Object.entries(f)) {
    assert.ok(wert >= 0.6 && wert <= 1.4, `${name} ausserhalb der Deckelung: ${wert}`)
  }
})

test('Die Lackfrage wirkt nur auf die Oberflaeche', () => {
  // 'b5' statt 'b3': Das mittlere Band ergibt seit dem 2026-09-07 genau 1,0 und
  // waere von "weiss ich nicht" nicht zu unterscheiden — der Test wuerde nichts pruefen.
  const a = berechneFaktoren({ grund: 'b3', lack: 'b5', massiv: 'unbekannt', montage: 'unbekannt' }, SAETZE, AUFSCHLAG)
  const b = berechneFaktoren({ grund: 'b3', lack: 'unbekannt', massiv: 'unbekannt', montage: 'unbekannt' }, SAETZE, AUFSCHLAG)
  assert.notEqual(a.oberflaeche, b.oberflaeche)
  assert.equal(a.werkstatt, b.werkstatt)
  assert.equal(a.montage, b.montage)
})

test('Die Baender sind aufsteigend', () => {
  for (const frage of ['grund', 'massiv', 'lack', 'montage']) {
    const werte = BAENDER[frage].filter(b => typeof b.mitte === 'number').map(b => b.mitte)
    for (let i = 1; i < werte.length; i++) {
      assert.ok(werte[i] > werte[i - 1], `${frage} nicht aufsteigend bei ${werte[i]}`)
    }
  }
})

test('Die Referenz nennt alle vier Bloecke', () => {
  assert.ok(REFERENZ.materialEk > 0)
  assert.ok(REFERENZ.fixsockel.length > 0)
  assert.ok(REFERENZ.werkstatt.length > 0)
  assert.ok(REFERENZ.montage.length > 0)
})

test('Hoehere Stundensaetze machen den Referenzpreis teurer', () => {
  const teuer = Object.fromEntries(Object.entries(SAETZE).map(([k, v]) => [k, v * 1.5]))
  assert.ok(referenzPreis(teuer, AUFSCHLAG).gesamt > referenzPreis(SAETZE, AUFSCHLAG).gesamt)
})

import { abzuschaltendeKostenstellen } from '../src/lib/kalibrierung.ts'

test('Ohne CNC wird die CNC-Kostenstelle abgeschaltet', () => {
  const aus = abzuschaltendeKostenstellen({ maschinen: ['formatsaege'], montage_selbst: 'immer' })
  assert.ok(aus.includes('CNC'))
})

test('Mit CNC bleibt sie an', () => {
  const aus = abzuschaltendeKostenstellen({ maschinen: ['cnc', 'kantenanleim'], montage_selbst: 'immer' })
  assert.equal(aus.includes('CNC'), false)
  assert.equal(aus.includes('Bekantung'), false)
})

test('Ohne Kantenanleimmaschine wandert die Bekantung zur Handarbeit', () => {
  assert.ok(abzuschaltendeKostenstellen({ maschinen: ['cnc'] }).includes('Bekantung'))
})

test('Wer nicht montiert, bekommt keine Montagezeile — Lieferung bleibt', () => {
  const aus = abzuschaltendeKostenstellen({ maschinen: ['cnc','kantenanleim'], montage_selbst: 'nie' })
  assert.ok(aus.includes('Montage'))
  assert.equal(aus.includes('Lieferung'), false)
})

test('Wer manchmal montiert, behaelt die Montage', () => {
  const aus = abzuschaltendeKostenstellen({ maschinen: ['cnc','kantenanleim'], montage_selbst: 'manchmal' })
  assert.equal(aus.includes('Montage'), false)
})

test('Die Formatkreissaege schaltet nichts ab — Zuschnitt faellt immer an', () => {
  const aus = abzuschaltendeKostenstellen({ maschinen: [], montage_selbst: 'immer' })
  assert.equal(aus.includes('Zuschnitt'), false)
})

test('Die Lackierkabine schaltet die Oberflaeche NICHT ab — Oelen braucht keine', () => {
  const aus = abzuschaltendeKostenstellen({ maschinen: [], montage_selbst: 'immer' })
  assert.equal(aus.includes('Oberfläche'), false)
})

test('Ohne Kalibrierung wird nichts abgeschaltet', () => {
  assert.deepEqual(abzuschaltendeKostenstellen(null), [])
  assert.deepEqual(abzuschaltendeKostenstellen(undefined), [])
})

import { lackBlockFuer, LACK_BEZEICHNUNG } from '../src/lib/kalibrierung.ts'

test('Mit Lackierkabine gibt es keinen Zusatzblock', () => {
  assert.equal(lackBlockFuer({ maschinen: ['cnc', 'lackierkabine'] }), '')
})

test('Ohne Lackierkabine entsteht ein Block', () => {
  const b = lackBlockFuer({ maschinen: ['cnc'] })
  assert.match(b, /KEINE LACKIERKABINE/)
  assert.match(b, /KEINE Zeit auf der Kostenstelle "Oberfläche"/)
})

test('Der Block verbietet ausdrücklich das Schätzen', () => {
  const b = lackBlockFuer({ maschinen: [] })
  assert.match(b, /NICHT schaetzen/)
  assert.match(b, /ekPreis auf 0/)
})

test('Ölen und Wachsen bleiben ausdrücklich Eigenleistung', () => {
  assert.match(lackBlockFuer({ maschinen: [] }), /Oelen, Wachsen und Schleifen macht er weiterhin selbst/)
})

test('Die Bezeichnung sagt dem Nutzer, was zu tun ist', () => {
  assert.match(LACK_BEZEICHNUNG, /Quadratmeterpreis eintragen/)
  assert.ok(lackBlockFuer({ maschinen: [] }).includes(LACK_BEZEICHNUNG))
})

test('Ohne Kalibrierung kein Block', () => {
  assert.equal(lackBlockFuer(null), '')
  assert.equal(lackBlockFuer({}), '')
})

// ── Referenzmoebel je Schwerpunkt (2026-09-07) ──────────────────────────────

import { REFERENZEN, referenzFuer, RANDHINWEIS, RANDBAENDER } from '../src/lib/kalibrierung.ts'

const FELD = { grund: 'werkstatt', lack: 'oberflaeche', massiv: 'massivholz', montage: 'montage' }
const LEER = { grund: '', lack: '', massiv: '', montage: '' }

test('Jedes Band trifft seinen Zielfaktor — bei JEDER Referenz und JEDER Frage', () => {
  const ziel = [0.60, 0.80, 1.00, 1.20, 1.40]
  for (const r of Object.values(REFERENZEN)) {
    for (const frage of r.fragenliste) {
      const echte = frage.baender.filter(b => b.mitte !== null)
      assert.equal(echte.length, 5, `${r.name}/${frage.schluessel}: ${echte.length} Baender`)
      echte.forEach((b, i) => {
        const f = berechneFaktoren({ ...LEER, [frage.schluessel]: b.schluessel }, SAETZE, AUFSCHLAG, r)
        const wert = f[FELD[frage.schluessel]]
        assert.ok(Math.abs(wert - ziel[i]) <= 0.03,
          `${r.name}/${frage.schluessel}, Band "${b.text}": ${wert} statt ${ziel[i]}`)
      })
    }
  }
})

test('Das mittlere Band ergibt genau 1,0 — der Fehler vom 2026-09-07', () => {
  // Vorher ergab es 0,60 bis 0,74: Wer nahm, was CraftFlow rechnet, bekam trotzdem
  // gekuerzte Zeiten.
  for (const r of Object.values(REFERENZEN)) {
    const f = berechneFaktoren({ ...LEER, grund: 'b3' }, SAETZE, AUFSCHLAG, r)
    assert.ok(Math.abs(f.werkstatt - 1.0) <= 0.03, `${r.name}: ${f.werkstatt}`)
  }
})

test('Keine zwei Baender einer Frage heissen gleich', () => {
  // Bei den Innentueren entstand sonst "2,5 Tage – 2,5 Tage".
  for (const r of Object.values(REFERENZEN)) {
    for (const frage of r.fragenliste) {
      const texte = frage.baender.map(b => b.text)
      assert.equal(new Set(texte).size, texte.length,
        `${r.name}/${frage.schluessel}: ${texte.join(' | ')}`)
    }
  }
})

test('Treppe und Tisch stellen keine Massivholzfrage — sie sind schon massiv', () => {
  for (const k of ['treppen', 'solitaer']) {
    const fragen = REFERENZEN[k].fragenliste.map(f => f.schluessel)
    assert.ok(!fragen.includes('massiv'), `${k} fragt trotzdem nach Massivholz`)
    assert.ok(fragen.includes('grund') && fragen.includes('montage'))
  }
  // Eine nicht gestellte Frage laesst ihren Faktor auf genau 1,0.
  const f = berechneFaktoren({ ...LEER, grund: 'b3', massiv: 'b5' }, SAETZE, AUFSCHLAG, REFERENZEN.treppen)
  assert.equal(f.massivholz, 1.0)
})

test('Die Flaechen-Kennwerte treffen den gemessenen Einbauschrank', () => {
  // 16,1 m2 Plattenflaeche, gemessen am 2026-09-07. Die Kennwerte 40 min/m2,
  // 4 EUR/m2, 110 EUR/m2 und 20 min/m2 stammen aus CLAUDE.md — sie muessen die
  // gemessenen Werte des Referenzschranks reproduzieren, sonst sind sie geraten.
  const m2 = 16.1
  const nah = (formel, gemessen, name) =>
    assert.ok(Math.abs(formel - gemessen) / gemessen <= 0.10,
      `${name}: Formel ${formel} gegen gemessen ${gemessen}`)
  nah(m2 * 40, REFERENZ.lackMinuten, 'Lackminuten')
  nah(m2 * 4, REFERENZ.lackMaterialEk, 'Lackmaterial')
  nah(m2 * 110, REFERENZ.massivMaterialEk, 'Massivholzmaterial')
  nah(m2 * 20, REFERENZ.massivOberflaecheMinuten, 'Oelminuten')
})

test('Der Schwerpunkt waehlt das Referenzmoebel, Kueche hat Vorrang', () => {
  assert.equal(referenzFuer(['kuechen']).name, 'Einbauküche')
  assert.equal(referenzFuer(['treppen']).name, 'Treppe')
  assert.equal(referenzFuer(['tueren']).name, 'Innentüren')
  assert.equal(referenzFuer(['einbau']).name, 'Einbauschrank')
  assert.equal(referenzFuer(['solitaer']).name, 'Massivholztisch')
  // Mehrfachauswahl: die Kueche ist das aussagekraeftigste Stueck.
  assert.equal(referenzFuer(['einbau', 'kuechen', 'solitaer']).name, 'Einbauküche')
  // Schwerpunkte ohne eigenes Moebel und keine Angabe bleiben beim Schrank.
  assert.equal(referenzFuer(['baeder', 'boeden']).name, 'Einbauschrank')
  assert.equal(referenzFuer(null).name, 'Einbauschrank')
  assert.equal(referenzFuer([]).name, 'Einbauschrank')
})

test('Die Referenzpreise treffen Fabians Faustregeln', () => {
  // CLAUDE.md, Abschnitt 6.1. Die Referenz muss in der Bandbreite liegen, die Fabian
  // selbst nennt — sonst kalibrieren wir gegen eine erfundene Zahl.
  const spanne = {
    einbauschrank: [1800, 2600],   // ~2.000 ohne Montage, hier MIT Montage
    kueche: [5000, 20000],         // Einbaukueche nach Mass
    tueren: [1750, 4000],          // 5 x 350-800 EUR/Stk.
    treppen: [3000, 7000],         // gerade Holztreppe eingebaut
    solitaer: [2000, 4500],        // Massivholztisch Eiche 200x90 geoelt
  }
  for (const [k, [min, max]] of Object.entries(spanne)) {
    const p = referenzPreis(SAETZE, AUFSCHLAG, REFERENZEN[k]).gesamt
    assert.ok(p >= min && p <= max, `${REFERENZEN[k].name}: ${p.toFixed(0)} EUR nicht in ${min}-${max}`)
  }
})

test('Ein unbekannter Bandschluessel ergibt Faktor 1,0, nicht NaN', () => {
  // Alte, in der Datenbank gespeicherte Schluessel ("1200-1600", "ein-tag") gibt es
  // nach der Umstellung nicht mehr. Sie muessen neutral ausgehen, nicht kaputt.
  const f = berechneFaktoren(
    { grund: '1200-1600', lack: '700-1100', massiv: 'ueber-6000', montage: 'ein-tag' },
    SAETZE, AUFSCHLAG)
  assert.deepEqual(f, { werkstatt: 1, oberflaeche: 1, massivholz: 1, montage: 1 })
})

// ── Fragen ohne Material (2026-09-07) ───────────────────────────────────────

const wert = (posten, faktor = 1) =>
  posten.reduce((s, p) => s + (p.minuten * faktor / 60) * (SAETZE[p.kostenstelle] ?? 65), 0)

test('Wo Material den Preis dominiert, wird ohne Material gefragt', () => {
  // DIE REGEL: Uebersteigt der Materialwert die Haelfte dessen, wonach gefragt wird,
  // sagt der Gesamtpreis fast nichts ueber das Tempo des Betriebs aus — zwei gleich
  // schnelle Schreiner liegen allein durch Einkauf und Aufschlag hunderte Euro
  // auseinander, und die wuerden wir komplett der Zeit anlasten.
  //
  // Dieser Test faellt, sobald jemand eine Referenz aendert und die Frage nicht
  // mitzieht. Genau das war der Fehler bei den Innentueren.
  for (const r of Object.values(REFERENZEN)) {
    const fix = wert(r.fixsockel), mont = wert(r.montage)
    for (const frage of r.fragenliste) {
      let material = 0, ganz = 0
      if (frage.schluessel === 'grund') {
        material = r.materialEk * 1.3
        ganz = material + fix + wert(r.werkstatt) + mont
      } else if (frage.schluessel === 'massiv') {
        material = r.massivMaterialEk * 1.3
        ganz = material + fix + mont + wert(r.werkstatt, r.massivWerkstattFaktor)
          + (r.massivOberflaecheMinuten / 60) * SAETZE['Oberfläche']
      } else continue

      const anteil = material / ganz
      const ohne = (r.ohneMaterial ?? []).includes(frage.schluessel)
      if (anteil > 0.5) {
        assert.ok(ohne,
          `${r.name}/${frage.schluessel}: Material ist ${(anteil * 100).toFixed(0)} % — ` +
          `die Frage muss ohne Material gestellt werden`)
      }
      // Und umgekehrt: Wer ohne Material fragt, muss es auch im Text sagen.
      if (ohne) {
        assert.ok(/ohne|selbst stellt|zahlt der Kunde/i.test(frage.text + ' ' + frage.hinweis),
          `${r.name}/${frage.schluessel}: rechnet ohne Material, sagt es aber nicht`)
      }
    }
  }
})

test('Ohne Material gefragt heisst auch ohne Material gerechnet', () => {
  // Die Bandmitte MUSS zur Formel passen. Stuende in der Frage der Bruttopreis und
  // in der Rechnung der Nettopreis, waere jeder Faktor falsch.
  const r = REFERENZEN.tueren
  const f = berechneFaktoren({ ...LEER, grund: 'b3' }, SAETZE, AUFSCHLAG, r)
  assert.ok(Math.abs(f.werkstatt - 1.0) <= 0.03, `Faktor war ${f.werkstatt}`)
  // Die Bandmitte liegt unter dem Gesamtpreis — genau um den Materialwert.
  const band = r.baender.grund.find(b => b.schluessel === 'b3')
  const gesamt = referenzPreis(SAETZE, AUFSCHLAG, r).gesamt
  assert.ok(band.mitte < gesamt * 0.6,
    `Bandmitte ${band.mitte} enthaelt offenbar noch das Material (Gesamt ${gesamt.toFixed(0)})`)
})

test('Die Tuerfrage deckt die echte Marktbreite ab', () => {
  // 350-800 EUR je Tuer liefern und montieren (CLAUDE.md 6.1), davon rund die
  // Haelfte Material -> die Arbeit liegt real bei etwa 150-400 EUR je Tuer. Die
  // Baender muessen diese Spanne treffen, sonst landen die meisten auf dem Deckel.
  const r = REFERENZEN.tueren
  const jeTuer = r.baender.grund
    .filter(b => b.mitte !== null).map(b => b.mitte / (r.teiler.grund ?? 1))
  assert.ok(jeTuer[0] <= 175, `unterstes Band ${jeTuer[0].toFixed(0)} EUR je Tuer ist zu hoch`)
  assert.ok(jeTuer[4] >= 330, `oberstes Band ${jeTuer[4].toFixed(0)} EUR je Tuer ist zu niedrig`)
})

test('Der Randhinweis haengt an genau den Baendern, die auf dem Deckel liegen', () => {
  const r = REFERENZEN.einbauschrank
  for (const schluessel of RANDBAENDER) {
    const f = berechneFaktoren({ ...LEER, grund: schluessel }, SAETZE, AUFSCHLAG, r)
    assert.ok(f.werkstatt === 0.6 || f.werkstatt === 1.4,
      `${schluessel} liegt bei ${f.werkstatt}, nicht auf dem Deckel`)
  }
  // Das mittlere Band darf den Hinweis NICHT bekommen.
  assert.ok(!RANDBAENDER.includes('b3'))
  assert.ok(RANDHINWEIS.length > 40)
})

test('Eine Referenz fragt entweder alles je Stück oder nichts', () => {
  // Gemischt gefragt — zwei Fragen je Tuer, zwei fuer fuenf Tueren — laedt zum
  // Verlesen ein, und ein verlesener Preis ist ein falscher Faktor. Genau so sah es
  // beim ersten Wurf am 2026-09-07 aus.
  for (const r of Object.values(REFERENZEN)) {
    const teiler = r.fragenliste.map(f => r.teiler?.[f.schluessel] ?? 1)
    assert.equal(new Set(teiler).size, 1,
      `${r.name}: gemischte Teiler ${JSON.stringify(teiler)}`)
  }
})

test('Jede Referenz hat ihren eigenen Preis — keine zwei gleich', () => {
  // VON FABIAN GEFUNDEN AM 2026-09-07: In "Mein Betrieb" stand ueber JEDEM
  // Referenzmoebel derselbe Ankerpreis (2.134 EUR) — der des Einbauschranks. Der
  // Text folgte den Klicks, der Preis kam vom GESPEICHERTEN Schwerpunkt. Zwei
  // Quellen fuer dieselbe Aussage.
  //
  // Der Bau ist jetzt so, dass beides aus demselben ref kommt. Dieser Test faellt,
  // sobald zwei Referenzen ununterscheidbar werden — dann waere die Anzeige
  // wieder nicht zu pruefen.
  const preise = Object.values(REFERENZEN)
    .map(r => Math.round(referenzPreis(SAETZE, AUFSCHLAG, r).gesamt))
  assert.equal(new Set(preise).size, preise.length,
    `Doppelte Referenzpreise: ${preise.join(', ')}`)
  // Und sie liegen weit auseinander, nicht nur zufaellig ein Euro.
  const sortiert = [...preise].sort((a, b) => a - b)
  assert.ok(sortiert[sortiert.length - 1] / sortiert[0] > 3,
    `Spanne zu eng: ${sortiert.join(', ')}`)
})
