# Zeitschätzung geraderücken — Arbeitsstand

**Stand:** Nacht auf 2026-09-07 · **Branch:** `dev` · **`main`:** unberührt

Vorgezogen vor die Betriebskalibrierung
(`docs/superpowers/specs/2026-09-06-betriebskalibrierung-design.md`), auf Fabians
Entscheidung: Der Fehler trifft alle Nutzer gleichermaßen, auch die, die nie ein
Onboarding ausfüllen.

## Das Ergebnis zuerst

Referenzschrank: Einbauschrank Flur, 2,00 × 2,40 × 0,60 m, Egger Dekor weiß,
4 Drehtüren, 2 Schubkästen, Kleiderstange, Sockel, Montage im Neubau.

| | vorher | nachher |
|---|---|---|
| Zuschnitt + Zusammenbau | 1.350 min | **695 min** |
| Montage | 450 min | **240 min** |
| Gesamtstunden | 36,3 h | **24,7 h** |
| **Netto** | **3.042 €** | **2.315 €** |

Fabians Faustregel für 2 lfm Einbauschrank inklusive Montage: 1.200–2.000 €. Der Rest
des Abstands ist Sache der Betriebskalibrierung — das ist genau die Spreizung zwischen
Betrieben, für die sie gedacht ist.

## Die Ursache — und eine widerlegte Zwischendiagnose

**Erste, falsche Vermutung:** „Die KI überschreitet ihre eigene Pflichtrechnung um das
Doppelte." Das sah zwingend aus: Der Prompt schreibt 2 lfm × 4,5 h = 540 min plus
Beschläge ≈ 690 min vor, gerechnet wurden 1.350.

**Was den Verdacht kippte:** Zwei unabhängige Läufe am selben Schrank ergaben
Zuschnitt + Zusammenbau von **exakt 1.350 min** — einmal als 420 + 930, einmal als
429 + 921. Auf die Minute dieselbe Summe bei zwei verschiedenen Aufteilungen. Ein
Sprachmodell trifft dieselbe Summe nicht zweimal zufällig. Also kam sie nicht von der
KI, sondern aus dem Code.

**Die wirkliche Ursache:** `parseLaufmeter` sammelte jede Zahl mit Meter-Einheit und
addierte sie:

```
"2,00 m breit x 2,40 m hoch x 0,60 m tief"  →  2,00 + 2,40 + 0,60 = 5,00 lfm
```

Aus 5 statt 2 Laufmetern baut `analyze` eine **Mindest-Werkstattzeit** von
lm × 4,5 h = 1.350 min und **skaliert Zuschnitt und Zusammenbau darauf hoch**
(`analyze/route.ts`, Schritt 4). Der Motor hat die Zahlen der KI aufgeblasen, nicht
umgekehrt.

Betroffen ist damit **jede** Beschreibung, die Breite, Höhe und Tiefe in Metern nennt
— also der Normalfall. Das ist die Ursache der „utopischen Preise", über die Fabians
Testkunden abgesprungen sind.

Verwandter Vorfall 2026-07-04: Damals wurden m²-Angaben als Meter gezählt, Preise bis
zum Sechsfachen. Dieselbe Familie von Fehlern, dieselbe Funktion.

## Was gebaut ist

| Was | Wo |
|---|---|
| `parseLaufmeter` neu, mit Tests — **die eigentliche Reparatur** | `src/lib/laufmeter.ts` |
| Obergrenzen in der Pflichtrechnung („VERBINDLICH, keine Untergrenze") | Prompt in `analyze/route.ts` |
| Checkliste nennt **Bänder** statt nur Mindestwerte | ebenda |
| `kappeZeiten()` — Sicherheitsnetz, deckelt anteilig | `src/lib/zeitpruefung.ts` |
| Montage raus aus dem Zähler der Plausibilitätsprüfung, Schwelle 4× → 2× | `analyze/route.ts` |

**Die neue Laufmeter-Erkennung**, in dieser Reihenfolge:
1. Explizite Breitenangabe („2,00 m breit", „240 cm breit") schlägt alles.
2. Maßkette „2000 × 2400 × 600 mm" → erste Zahl ist die Breite. Ohne diese Regel
   bliebe von der Millimeter-Schreibweise nur die **Tiefe** übrig.
3. Sonst weiter summieren — mehrere Schränke nebeneinander sind ein echter Fall
   („Schrank 2,40 m und Sideboard 1,80 m") — aber Höhe und Tiefe überspringen.

**Die Deckelung hat bei der Nachmessung gar nicht gegriffen** (695 < 810, 240 < 300).
Sie musste nicht: Die KI lag von sich aus richtig, sobald die Laufmeter stimmten. Sie
bleibt als Sicherheitsnetz und für den Fall, dass ein Modellwechsel die Zeiten
verschiebt.

Verifikation: 115 Tests grün, `npx tsc --noEmit` sauber. Die vier eslint-Meldungen in
`analyze/route.ts` sind Bestand (`prefer-const` auf einer Destrukturierung, die nicht
angefasst wurde).

## OFFEN — die Frage an Fabian

**Möbel ohne Laufmeter werden weiterhin nicht geprüft.** Ein Rollcontainer, ein Tisch,
ein Sideboard haben keine sinnvollen Laufmeter; `lm` ist dort 0, weder Untergrenze
noch Deckelung greifen. Der Rollcontainer vom Vortag lief mit 8,8 h durch.

Eine Faustformel dafür wurde bewusst **nicht** im Alleingang erfunden:

1. **Nach Stückliste** *(Empfehlung)*. Fabians Zeitrichtwerte sind pro Stück
   formuliert — Korpus 30–60 min, Systemschubkasten 20–35 min, Drehtür 15–25 min —
   und der Prompt rechnet bereits so. Gibt die KI die Stückzahlen zusätzlich als
   Zahlenfelder aus, kann die Engine die Erwartung daraus bilden, für **jedes** Möbel.
   `countHardware()` in `analyze` tut das heute schon aus dem Text; sauberer wären
   Zahlenfelder. Könnte den Laufmeter-Weg langfristig ablösen statt ergänzen.
2. **Nach Plattenfläche.** Schnell gebaut, ignoriert aber die Ausstattung — drei
   Schubladen einzubauen ist echte Zeit, die in keiner Plattenfläche steckt.
3. **Vorerst nur warnen** und Fälle sammeln.

## Noch nicht angefasst

- `analyze/route.ts` löscht die Arbeit abgeschalteter Kostenstellen weiterhin
  **ersatzlos**, statt sie zur Handarbeit umzubuchen. Steht im Kalibrierungs-Entwurf,
  Abschnitt 6.
- Die Vermischung von Netto- und Bruttozeit (Kammersatz auf produktive Stunden,
  Schätzung auf Bruttozeit). Größenordnung 25–30 % auf der Lohnseite.
- `optimize` hat **gar keine** Zeitprüfung und kennt die Laufmeter nicht. Wer im Chat
  Änderungen machen lässt, umgeht Untergrenze und Deckelung.
- **Die Untergrenze selbst ist ungeprüft.** Sie hat den Schaden angerichtet, weil ihre
  Eingangsgröße falsch war. Ob lm × 4,5 h als Untergrenze überhaupt sinnvoll ist —
  oder ob sie ganz weg sollte, jetzt wo es eine Obergrenze gibt — ist offen.
