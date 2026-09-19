// Realistisches Leistungsverzeichnis (Innenausbau) als mehrseitiges PDF — Testmaterial für Teil C.
import { PDFDocument, StandardFonts } from 'pdf-lib'
import { writeFileSync } from 'node:fs'
const pos = []
const gruppen = [
  ['1', 'Einbauschränke Flur und Schlafzimmer', [
    ['Einbauschrank Flur, raumhoch, 2.400 x 2.650 x 600 mm, Korpus Spanplatte weiß 19 mm, 4 Drehtüren, Fronten MDF lackiert seidenmatt RAL 9016, Sockel 100 mm, 2 Kleiderstangen, 6 Einlegeböden', 1, 'Stk'],
    ['Einbauschrank Schlafzimmer, Nische 3.200 x 2.500 x 650 mm, Schiebetüren 3-flügelig, Korpus Dekor Eiche, Fronten Glas satiniert mit Alurahmen, Innenausstattung 2 Schubladenblöcke à 4 Schubladen Blum Legrabox', 1, 'Stk'],
    ['Ankleide Dachschräge, Sonderanfertigung mit Schrägenanpassung, 4.100 mm Länge, offene Regalfächer, Kleiderstange 2.000 mm, Dekor Weiß', 1, 'Stk'],
    ['LED-Beleuchtung in Schrankfächern, Profile mit Sensor, 24 V, inkl. Trafo und Verkabelung', 3, 'Stk'],
  ]],
  ['2', 'Küche', [
    ['Küchenzeile Unterschränke, 4.800 mm, Korpus Spanplatte 19 mm anthrazit, Fronten Massivholz Eiche geölt, Blum Tandembox Schubladen, Soft-Close', 1, 'psch'],
    ['Hängeschränke 4.800 mm, Höhe 900 mm, Türen mit Aventos-Klappen, Fronten Eiche massiv geölt', 1, 'psch'],
    ['Arbeitsplatte Eiche massiv 40 mm, 4.800 x 650 mm, geölt, Ausschnitt Spüle und Kochfeld', 1, 'Stk'],
    ['Nischenrückwand HPL 6 mm, 4.800 x 550 mm, Dekor Beton hell', 1, 'Stk'],
    ['Hochschrank Kühl-Gefrier-Kombination, 600 x 2.200 mm, Gerätetür Front Eiche', 1, 'Stk'],
    ['Apothekerauszug 300 mm, 2 Körbe, Vollauszug', 1, 'Stk'],
    ['Griffe Edelstahl gebürstet 320 mm', 24, 'Stk'],
  ]],
  ['3', 'Innentüren und Zargen', [
    ['Innentür Röhrenspan, 860 x 1.985 mm, Weißlack, Umfassungszarge 120 mm, Bänder V 3420, Schloss BB, liefern und montieren (Altbau, Anpassung nötig)', 6, 'Stk'],
    ['Innentür Vollspan schallgedämmt, 985 x 2.110 mm, Dekor Eiche, Zarge Eiche furniert, Bodendichtung', 2, 'Stk'],
    ['Schiebetür in der Wand laufend, Kassette 1.000 x 2.100 mm, Türblatt Weißlack, Griffmuschel', 1, 'Stk'],
    ['Türdrücker Edelstahl, Rosette rund, inkl. Montage', 9, 'Stk'],
  ]],
  ['4', 'Wand- und Deckenverkleidung Wohnzimmer', [
    ['Wandverkleidung Akustikpaneele Eiche Lamellen auf Filz schwarz, 12,5 m², Unterkonstruktion Lattung, Montage', 12.5, 'm²'],
    ['Deckenverkleidung Fichte weiß lasiert, Nut und Feder, 28 m², UK 40/60, Montage', 28, 'm²'],
    ['Fußleisten Eiche massiv 60 x 15 mm, geölt, inkl. Gehrungen', 42, 'lfm'],
  ]],
  ['5', 'Treppe und Geländer', [
    ['Geradläufige Treppe Buche massiv, 14 Steigungen, Wangen 40 mm, Stufen 40 mm, geölt, liefern und montieren', 1, 'Stk'],
    ['Holzgeländer mit Füllstäben Buche, 4,2 lfm, Handlauf rund 42 mm', 4.2, 'lfm'],
    ['Handlauf Wandseite Buche, 4,0 lfm, mit Edelstahlhaltern', 4, 'lfm'],
  ]],
  ['6', 'Badmöbel und Sonstiges', [
    ['Waschtischunterschrank 1.200 x 500 x 480 mm, 2 Schubladen, Front Eiche geölt feuchtraumgeeignet, Aufsatzbecken-Ausschnitt', 1, 'Stk'],
    ['Spiegelschrank 1.200 x 700 x 150 mm, 3 Türen, LED-Beleuchtung, Steckdose innen', 1, 'Stk'],
    ['Sideboard Wohnzimmer 2.400 x 450 x 600 mm, Eiche massiv geölt, 4 Klappen, wandhängend', 1, 'Stk'],
    ['Schreibtisch Homeoffice 1.800 x 800 mm, Platte Eiche massiv 30 mm, Kabelkanal, Gestell Stahl schwarz', 1, 'Stk'],
    ['Regalwand Bücherregal 3.000 x 2.400 x 350 mm, Dekor Weiß, offene Fächer, 2 Schubladen unten', 1, 'Stk'],
    ['Garderobenbank mit Stauraum 1.200 x 400 x 450 mm, Eiche massiv, Sitzkissen bauseits', 1, 'Stk'],
    ['Fensterbank Eiche massiv 25 mm, 1.400 x 250 mm, geölt, einpassen', 5, 'Stk'],
    ['Reparatur Bestandsschrank: 2 Türen neu einhängen, Scharniere tauschen', 1, 'psch'],
    ['Anfahrt und Montage pauschal, Baustelle 63450 Hanau, 2 Monteure', 1, 'psch'],
  ]],
]
const pdf = await PDFDocument.create()
const font = await pdf.embedFont(StandardFonts.Helvetica); const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
let page = pdf.addPage([595, 842]), y = 800, seite = 1
const zeile = (t, f = font, size = 10) => { if (y < 60) { page = pdf.addPage([595, 842]); y = 800; seite++ }; page.drawText(t, { x: 50, y, size, font: f }); y -= size + 5 }
const umbruch = (t, max = 88) => { const w = t.split(' '); const z = []; let cur = ''; for (const x of w) { if ((cur + ' ' + x).trim().length > max) { z.push(cur.trim()); cur = x } else cur += ' ' + x } if (cur.trim()) z.push(cur.trim()); return z }
zeile('Leistungsverzeichnis — Innenausbau Wohnhaus Familie Musterbeispiel', bold, 14); zeile('Bauvorhaben: Musterstraße 12, 63450 Hanau · Auftraggeber: Beispiel Bau GmbH · Stand 15.09.2026', font, 9); y -= 10
zeile('Alle Positionen liefern und montieren, sofern nicht anders angegeben. Preise netto zzgl. MwSt.', font, 9); y -= 8
let n = 0
for (const [g, gt, items] of gruppen) { y -= 6; zeile(`Titel ${g}  ${gt}`, bold, 12); y -= 2; items.forEach((it, i) => { n++; const nr = `${g}.${String(i + 1).padStart(2, '0')}`; zeile(`Pos. ${nr}   ${it[1]} ${it[2]}`, bold, 10); for (const l of umbruch(it[0])) zeile('        ' + l); y -= 4 }) }
zeile(`Summe Positionen: ${n} · Angebotsabgabe bis 30.09.2026`, bold, 10)
writeFileSync('/tmp/lvtest/leistungsverzeichnis.pdf', await pdf.save())
console.log('PDF geschrieben:', n, 'Positionen,', pdf.getPageCount(), 'Seiten')
