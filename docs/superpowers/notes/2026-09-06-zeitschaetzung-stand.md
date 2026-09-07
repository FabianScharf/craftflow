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

**Gegenprobe mit Fabians Faustregel** (korrigiert am 2026-09-07: seine ~2.000 € für
2 lfm gelten **ohne** Montage):

| | |
|---|---|
| CraftFlow nach dem Fix | 2.315 € |
| davon Montage + Lieferung | − 336 € |
| **ohne Montage** | **1.979 €** |
| **Fabians Faustregel** | **~2.000 €** |

Ein Prozent Abweichung. Die Basis stimmt damit; was bleibt, ist die Spreizung zwischen
Betrieben — genau die Aufgabe der Kalibrierung.

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

## Erledigt am 2026-09-07: Prüfung über die Stückliste

Fabian hat den empfohlenen Weg gewählt. Möbel **ohne** Laufmeter bekommen ihre
Obergrenze jetzt aus der Stückliste: Plattenfläche plus gezählte Beschläge.

**Die Formel ist nicht geraten, sondern an zwei wirklich gemessenen Kalkulationen
geeicht** (beide nach dem Laufmeter-Fix):

| Möbel | gemessen | Formel | Abweichung |
|---|---|---|---|
| Referenzschrank 16,1 m², 4 Drehtüren, 2 Schubkästen, 8 Einlegeböden | 695 min | 739 min | 6 % |
| Rollcontainer 1,64 m², 3 Schubkästen | 216 min | 234 min | 8 % |

Beide Abweichungen sind als Test festgeschrieben (`tests/stueckliste.test.mjs`).
Kippt die Formel bei einer späteren Änderung, fällt es sofort auf.

Die Zeitanteile stammen aus Fabians eigenen Richtwerten: Korpus 30–60 min, Rückwand
15–25 min, Systemschublade 20–35 min plus Front 10–20 min, Drehtür 15–25 min,
Einlegeboden 10–20 min. Dazu Rüstzeit am Sägewerk und Flächenanteile.

**Das Band ist bewusst weit** — der Deckel liegt bei der doppelten Erwartung. Diese
Schätzung ist gröber als die Laufmeter-Rechnung, sie kennt weder Massivholz noch
Sonderausstattung. Sie soll Ausreißer um Faktor zwei abfangen, nicht feinsteuern.

## Inzwischen ebenfalls erledigt (2026-09-07)

- **Abgeschaltete Kostenstellen löschen die Arbeit nicht mehr.** Sie wandert zur
  Handarbeit, mit Zeitzuschlag 1,6 — `src/lib/handarbeit.ts`, in `analyze` **und**
  `optimize`.
- **`optimize` war das Schlupfloch** und hat jetzt die Zeitfaktoren der Kalibrierung
  sowie das Umbuchen. Eine eigene Laufmeter-Prüfung hat es weiterhin nicht.

## Noch nicht angefasst

- Die Vermischung von Netto- und Bruttozeit (Kammersatz auf produktive Stunden,
  Schätzung auf Bruttozeit). Größenordnung 25–30 % auf der Lohnseite. Die Messung von
  1.979 € gegen Fabians ~2.000 € spricht dafür, dass es in der Praxis aufgeht — sauber
  getrennt ist es trotzdem nicht.
- **Die Untergrenze selbst ist ungeprüft.** Sie hat den Schaden angerichtet, weil ihre
  Eingangsgröße falsch war. Ob lm × 4,5 h als Untergrenze überhaupt sinnvoll ist — oder
  ob sie weg sollte, jetzt wo es eine Obergrenze gibt — ist offen.
- `optimize` kennt die Laufmeter nicht und prüft deshalb keine Zeiten. Wer dort
  Änderungen machen lässt, umgeht Unter- und Obergrenze weiterhin.

## Nachtrag 2026-09-07: Referenzmöbel nach Schwerpunkt

Ein Treppenbauer hat sich bisher an einem Flurschrank kalibriert. Jetzt richtet sich
das Referenzmöbel nach dem, was der Betrieb baut.

| Schwerpunkt | Referenz | Preis (Standardsätze) | Fabians Faustregel |
|---|---|---|---|
| Küchen | Einbauküche L-Form | 10.073 € | 5.000–20.000 € |
| Treppen | Treppe Buche massiv | 4.975 € | 3.000–7.000 € |
| Türen | 5 Innentüren mit Zargen | 2.855 € | 5 × 350–800 € |
| Einbauschränke | Einbauschrank Flur (**gemessen**) | 2.245 € | ~2.000 € ohne Montage |
| Solitärmöbel | Massivholztisch Eiche | 3.069 € | 2.000–4.500 € |

Jede Referenz liegt in der Spanne, die Fabian selbst nennt — als Test festgeschrieben.
Bei Mehrfachauswahl gewinnt die Küche: das aufwendigste und aussagekräftigste Stück.

### Drei Fehler, die dabei gefunden wurden

**1. Das mittlere Band ergab Faktor 0,60–0,74 statt 1,0.** Wer genau das nahm, was
CraftFlow rechnet, bekam trotzdem bis zu 26 % gekürzte Zeiten. Erbe aus der Zeit, als
Fabians Faustregel noch falsch gelesen war (1.200–2.000 € **mit** Montage statt
~2.000 € **ohne**).

**2. Zentrierte Prozentsätze kollabieren.** Verschiebt man die alten Anteile so, dass
das mittlere Band den Referenzpreis trifft, fallen die unteren zwei Bänder auf
denselben Deckelwert (0,60 / 0,60): Material und Fixsockel wiegen bei Küche, Türen
und Treppe viel schwerer als beim Flurschrank. **Ein** Prozentsatz kann nicht für alle
Referenzen passen.

Die Bänder werden deshalb **rückwärts aus den Zielfaktoren** gerechnet — die
Umkehrung der Faktorformel:

```
Bandpreis(f) = Material + Fixsockel + f × (Werkstatt + Montage)
mit f = 0,6 · 0,8 · 1,0 · 1,2 · 1,4
```

Ergebnis: Jedes Band trifft seinen Zielfaktor auf zwei Stellen, das mittlere ergibt
1,0, die offenen Randbänder landen genau auf den Deckeln. Für jede Referenz und jede
Frage geprüft.

**3. Lack-, Massivholz- und Montagefrage hatten feste Skalen.** Ein Küchenbauer konnte
bei der Montagefrage nie über Faktor 0,71 kommen: Seine Altbau-Erwartung liegt bei
3,7 Tagen, die Auswahl endete bei „länger" = 1.250 min. Die Frage war für ihn kaputt.
Alle vier Skalen kommen jetzt vom Referenzmöbel.

### Weitere Korrekturen

- **Lack- und Massivholzzahlen aus der Sichtfläche.** Kennwerte aus CLAUDE.md:
  40 min/m² Lackaufbau, 4 €/m² Lackmaterial, 110 €/m² Eiche massiv, 20 min/m² ölen.
  **Gegenprobe:** Auf den gemessenen Schrank (16,1 m²) angewandt ergeben sie
  644 / 64 / 1.771 / 322 gegen gemessene 600 / 60 / 1.770 / 300 — das Material trifft
  auf 1 €. Als Test festgeschrieben.
- **Oberflächenzeit in den generierten Referenzen.** Einer geölten Treppe und einem
  Massivholztisch fehlte sie vorher ganz.
- **Treppe und Tisch stellen keine Massivholzfrage** — sie *sind* massiv. Eine
  Scheinfrage, deren Antwort nichts hergibt. Der Faktor bleibt dort auf 1,0; die
  Grundfrage misst die Massivholzarbeit bereits mit.
- **Kein Band heißt mehr wie sein Nachbar.** Bei den Innentüren entstand sonst
  „2,5 Tage – 2,5 Tage", weil vier Grenzen bei 1,4 / 1,8 / 2,2 / 2,6 Tagen auf halbe
  Tage gerundet zusammenfielen. Bei Bedarf weicht die Skala auf Stunden aus.

### Live gemessen auf der dev-Preview

| Referenz | Band 1 | Band 3 (Mitte) | Band 5 |
|---|---|---|---|
| Küche | 0,64 | **1,06** | 1,40 |
| Treppe | 0,62 | **1,04** | 1,40 |
| Türen | 0,61 | **1,02** | 1,40 |
| Schrank | 0,65 | **1,08** | 1,40 |

Die 2–8 % über 1,0 sind gewollt: Die Bänder sind mit den Kammer-Standardsätzen
beziffert, gerechnet wird mit den Sätzen des Nutzers. Bei der Treppe blieb der
Massivholzfaktor über alle Bänder auf genau 1,0 — die Frage wird dort nicht gestellt.

### Bekannte Grenze — für Fabian zu entscheiden

Bei materialschweren Referenzen sind die Euro-Bänder **eng**: Bei den Innentüren
umfasst die ganze Auswahl 2.500–3.200 €, bei der Massivholzfrage sogar nur
4.450–4.950 €. Das ist arithmetisch richtig — wenn Material 55 % des Preises ist und
der Deckel ±40 % auf die *Zeit* erlaubt, sind das nur ±11 % auf den *Preis*. Fabians
eigene Faustregel spannt aber 1.750–4.000 €. Wer außerhalb liegt, landet auf dem
Deckel 0,6 oder 1,4.

Zwei Wege, falls das in der Praxis stört: Deckel für materialschwere Referenzen
weiten, oder die Differenz auch auf den Materialaufschlag wirken lassen (dann wäre
der Faktor nicht mehr rein zeitbezogen). Beides ist eine fachliche Entscheidung, keine
technische.

**Ebenfalls offen:** Alte Bandschlüssel aus der Datenbank („1200-1600", „ein-tag")
gibt es nicht mehr. Sie ergeben Faktor 1,0 statt eines Fehlers — als Test
festgeschrieben. Bestehende Nutzer behalten ihre gespeicherten Faktoren, bis sie in
„Mein Betrieb" neu speichern; dann müssen sie die Fragen einmal neu anklicken.
