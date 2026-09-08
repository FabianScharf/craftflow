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

### Erledigt am 2026-09-07: die enge Spanne bei materialschweren Referenzen

**Der Befund war richtig, die Diagnose zunächst falsch.** Die engen Bänder waren kein
Problem der Bänder, sondern der **Frage**: Wir fragten nach dem *Gesamtpreis* und
rechneten daraus die Zeit zurück. Wo Material über die Hälfte des Preises ausmacht,
sagt der Gesamtpreis fast nichts über das Tempo aus — zwei gleich schnelle Schreiner
liegen allein durch Einkauf und Aufschlag hunderte Euro auseinander, und die haben wir
komplett der Zeit angelastet.

| Referenz | Material | was ±40 % Zeit am Preis bewegen |
|---|---|---|
| Einbauschrank | 24 % | ±27 % |
| Massivholztisch | 34 % | ±22 % |
| Einbauküche | 45 % | ±19 % |
| **Innentüren** | **56 %** | **±16 %** |
| **Treppe** | **55 %** | **±15 %** |

**Die Lösung:** Bei diesen Referenzen wird gefragt, was tatsächlich seine Arbeit ist.

| | vorher | nachher |
|---|---|---|
| Innentüren | „Was nimmst du für die fünf Türen?" 2.500–3.200 € | „Was nimmst du fürs Einpassen einer Tür, wenn der Kunde Tür und Zarge stellt?" **180–320 € je Tür** |
| Treppe | „Was nimmst du für so eine Treppe?" 4.400–5.550 € | „Was berechnest du für Einbau und Anpassung, wenn die Rohtreppe gestellt wird?" **1.650–2.800 €** |

Das ist die echte Marktbreite — und ein Schreiner bietet Türen ohnehin so an
(„Montage 180 €/Tür"). Der Deckel 0,6–1,4 bleibt, wofür er gedacht war: eine
Notbremse, keine tägliche Grenze. Die Zeitfaktoren messen danach wirklich nur Zeit.

**Verworfene Alternativen und warum:**

- *Deckel weiten (0,4–1,6).* Billig, aber dehnt nur. Faktor 0,4 behauptet, er schneide
  eine Platte in 40 % der normalen Zeit zu. Verzerrt außerdem die Grundlage, auf der
  die **Lernschleife** aus gewonnenen Angeboten weiterlernt. Hätte bei den Türen
  ohnehin nicht bis 1.750 € gereicht.
- *Die Differenz auch aufs Material wirken lassen.* Fachlich die richtigste Diagnose,
  aber der **Materialaufschlag ist schon eine Einstellung**. Ein zweites,
  unsichtbares Stellrad darauf gäbe zwei Wahrheiten. Und Materialpreise still zu
  verändern ist gefährlicher als Zeiten — der Nutzer sieht die EK-Preise aus seiner
  eigenen Liste in der Position stehen.

**Zwei Regeln sind als Test festgeschrieben**, damit das nicht zurückfällt:

1. Übersteigt der Materialwert die Hälfte dessen, wonach gefragt wird, **muss** die
   Frage ohne Material gestellt werden — und der Fragetext muss das auch sagen. Genau
   diese Kopplung fehlte.
2. Eine Referenz fragt **entweder alles je Stück oder nichts**. Im ersten Wurf waren
   zwei Türenfragen je Tür und zwei für alle fünf; wer sich da verliest, bekommt einen
   falschen Faktor.

**Zusätzlich gebaut:**

- **Randhinweis.** Wer das unterste oder oberste Band wählt, bekommt einen Satz dazu:
  Das ist der Deckel; liegst du noch weiter weg, sind es die Stundensätze oder der
  Materialaufschlag, nicht die Geschwindigkeit — beides Einstellungen. Genau daran
  sind Testkunden abgesprungen: Sie sahen einen Preis, den sie nicht erklären konnten.
- **Ankerpreis in „Mein Betrieb".** Was CraftFlow für das Referenzmöbel mit *seinen*
  Sätzen rechnet (Türen: 247 € je Tür für die Arbeit). Ohne diese Zahl antwortet er
  ins Blaue.

Live auf dev geprüft: Faktoren 0,6 / 1,0 / 1,4 über alle Referenzen, Anker und
Hinweise erscheinen, bei der Treppe bleibt der Massivholzfaktor auf 1,0.

### Noch offen

**Alte Bandschlüssel aus der Datenbank** („1200-1600", „ein-tag") gibt es nicht mehr.
Sie ergeben Faktor 1,0 statt eines Fehlers — als Test festgeschrieben. Bestehende
Nutzer behalten ihre gespeicherten Faktoren, bis sie in „Mein Betrieb" neu speichern;
dann müssen sie die Fragen einmal neu anklicken.

**Die Einbauküche liegt mit 45 % Materialanteil im Graubereich.** Sie bleibt bei der
Gesamtpreisfrage (±19 % Hebel reicht), aber das ist eine Setzung, keine Messung.

---

# Vollständiger Check am 2026-09-07

Fabians Fragen: Werden die Faktoren sauber in neuen Projekten angewendet? Funktionieren
Bauweise-Regeln und Materialpreise **zusätzlich**? Und werden zukünftige Projekte
wirklich genauer?

## Kurzantwort

Alle drei Schichten wirken — und zwar gleichzeitig. Auf dem Weg dorthin sind aber
**sieben Fehler** aufgefallen, davon vier still: Sie haben nie einen Fehler gemeldet,
sondern einfach nichts getan.

## 1. Wirken die Faktoren? — Ja, live gemessen

Zweimal dieselbe Beschreibung analysiert (Einbauschrank Flur, 2,00 × 2,40 × 0,60 m),
einmal ohne Kalibrierung, einmal mit Faktor **0,86**:

| Kostenstelle | ohne | mit | Verhältnis |
|---|---|---|---|
| Zuschnitt | 216 | 186 | 0,861 |
| Zusammenbau | 479 | 412 | 0,860 |
| Montage | 240 | 206 | 0,858 |
| Verpacken | 30 | 26 | 0,867 |
| Konstruktion *(Sockel)* | 60 | 60 | 1,00 |
| Arbeitsvorbereitung *(Sockel)* | 45 | 45 | 1,00 |
| **Summe** | **1.391 min** | **1.193 min** | |

Vier Kostenstellen landen exakt auf dem Faktor, der Sockel bleibt unberührt. Die
übrigen Zeilen (Besprechung, Warenhandling, Produktion, Lieferung) schwanken zwischen
den Läufen — das ist Streuung der KI, nicht der Faktor: Es sind zwei unabhängige
Modellantworten. Nur wo die KI dieselbe Ausgangszahl lieferte, ist das Verhältnis
aussagekräftig.

## 2. Wirken Bauweise-Regeln und Materialpreise zusätzlich? — Ja

Im Testkonto liegen zwei Regeln und zwei fixierte Preise. In **beiden** Läufen:

| Quelle | Erwartet | Im Ergebnis |
|---|---|---|
| Regel „Rückwände aus Spanplatte 8 mm" | 8 mm statt HDF 6 mm | „Spanplatte 8 mm … (Rückwand, Betriebsstandard)" |
| Regel „5 % Kleinmaterial" | 5 % der Materialkosten | 374,94 € × 5 % = **18,75 €** — auf den Cent |
| Preisliste „Blum Movento Softclose-Auszug" | 26,27 €/Stk | **26,27 €** in beiden Läufen |

Lauf B hatte alle drei Schichten gleichzeitig aktiv. Sie stören sich nicht.

## 3. Die sieben Fehler

**Von Fabian gefunden — der Ankerpreis gehörte zu einem anderen Möbel.** In „Mein
Betrieb" stand über *jedem* Referenzmöbel derselbe Preis (2.134 €), nämlich der des
Einbauschranks. Der Text folgte den Klicks, der Preis kam vom *gespeicherten*
Schwerpunkt aus der Route. Zwei Quellen für dieselbe Aussage. Jetzt rechnet die
Oberfläche Text und Preis aus demselben `ref`.

**Azubistunden und eigene Kostenstellen bekamen gar keinen Faktor.** Beide Module
zählten die sieben Werkstattstellen einzeln auf; alles außerhalb blieb unangetastet.
Wer viel über den Azubi oder „Polieren von Hand" laufen lässt, wurde still nicht
kalibriert. Die Logik ist umgedreht: Benannt wird jetzt, was **nicht** skaliert — der
Fixsockel. Bei frei benennbaren Kostenstellen ist eine Aufzählung, die vollständig
sein muss, prinzipiell nicht zu halten.

**Dieselbe Lücke in der Lernschleife.** Sie hat Azubi und eigene Kostenstellen auch
nicht beobachtet. Der Nutzer hätte Zeiten korrigiert, die nie gelernt werden. Ein Test
koppelt die beiden Module jetzt aneinander.

**Die Lernschleife konnte aus Handkorrekturen gar nicht lernen.** Version 1 entstand
nur über den Optimieren-Chat. Ohne Version 1 überspringt die Schleife das Projekt
kommentarlos — wer die Zeiten von Hand in der Tabelle korrigiert, lieferte also
nichts. Jetzt wird die Erstfassung der KI direkt nach der Analyse festgehalten.

**Nach einer erneuten Analyse fiel ein Angebot aus der Schleife.** Positionen wurden
allein über die `id` gepaart, und die ist `Date.now() + i`, clientseitig vergeben.
Ausweichweg jetzt: gleiche Anzahl Positionen **und** gleicher Titel an derselben
Stelle — beides zusammen, damit nie zwei verschiedene Möbel verglichen werden.

**In `analyze` hing die Preisliste im try-Block der Bauweise-Regeln.** Ein Fehler beim
Laden der Regeln ließ stillschweigend auch die fixierten Einkaufspreise verschwinden.
In `optimize` war es von Anfang an getrennt.

**Projekte ließen sich überhaupt nicht löschen.** `DELETE /api/projects/[id]` räumt
zuerst die Angebotsversionen weg und scheiterte mit *„permission denied for table
offer_versions"*. Der Rolle `authenticated` fehlte das DELETE-Recht auf dieser Tabelle
— steht so schon in CLAUDE.md, war bei `offer_versions` nie passiert. Behoben mit
`docs/sql/2026-09-07-offer-versions-loeschrecht.sql`, am 2026-09-07 ausgeführt.

> **Korrektur:** Ich hatte das Löschen zuvor als funktionierend gemeldet. Ich hatte
> nur die Route und den Knopf geprüft, nie einen echten Löschvorgang. Er wäre bei
> jedem Versuch gescheitert.

## 4. Lernschleife end-to-end geprüft

Drei gewonnene Angebote angelegt, bei denen die Zeiten **von Hand** korrigiert wurden
(20 % länger als die KI schätzte), ohne Optimieren-Chat:

```
Werkstatt:  1,00 → 1,09   aus 3 gewonnenen Angeboten
Oberfläche: 1,00 → 1,10
Montage:    1,00 → 1,02
```

Die Werkstattsumme lag bei 660 statt 600 Minuten — die 60 Azubi-Minuten zählen jetzt
mit. Vorschau (GET) ändert nichts, Übernahme (POST) speichert. Die Dämpfung greift:
Aus einem Verhältnis von 1,18 wird ein Faktor von 1,09, nicht 1,18. Prüfprojekte
danach gelöscht, Kalibrierung des Testkontos zurückgesetzt.

---

# PDF-Gestaltung nach Constantins Rückmeldung (2026-09-08)

Constantin Ludewigt (Tischlerei Lilie) hat am 2026-08-26 dreizehn Punkte gemeldet.
Alle im Code nachgeprüft und gegen `craftflow-app/docs/reference/angebot_referenz.pdf`
gehalten.

## Die Einteilung, nach der entschieden wurde

Fabian am 2026-09-08: *„Was er nicht gut findet, mag ein anderer. Daher sind mir
individuelle Anpassungen in den Einstellungen extrem wichtig."* Richtig — mit einer
Grenze. Der Test dafür:

> **Würde irgendjemand die andere Variante freiwillig wählen?**
> Ja → Einstellung. Nein → Fehler, und der wird behoben, nicht zur Wahl gestellt.

Macht man einen Fehler zur Einstellung, gibt man dem Nutzer die Verantwortung dafür.
Er sucht dann in zwanzig Schaltern nach dem einen, der das Doppelte wegnimmt.

## Fehler — ohne Schalter behoben

| Was | Belegt durch |
|---|---|
| Positionsüberschrift stand **zweimal** | `<strong>{titel}</strong>` war hart in Gruppen- UND Detailzeile |
| Absätze verschwanden | 6 von 8 Textfeldern wandelten Zeilenumbrüche nicht um |
| Logo lief über den Rand | `height:80px; width:auto` ohne `max-width` |
| Blöcke brachen mitten durch | Unterschriftslinien standen allein auf Seite 2 |

## Der schwerste Fund kam nebenbei

**Die Stückzahl aus der KI-Antwort wurde in der Oberfläche verworfen.** Das
Positionsobjekt wird dort Feld für Feld neu gebaut, und `stueckzahl` stand nicht in
der Liste. Die KI lieferte sie korrekt, die Serienstaffel war gebaut und getestet —
aber **wer „100 Spinde" kalkulierte, bekam den Preis für ein Stück.**

Aufgefallen erst, weil für die Alternativpositionen dieselbe Stelle angefasst wurde.
Mein früherer Test hatte die *API-Antwort* geprüft, nicht was die Oberfläche daraus
macht. Genau die Lücke, die im Memory unter „Erst ausgeführt, dann gemeldet" steht.

Die Umwandlung liegt jetzt in `src/lib/kiantwort.ts` und ist getestet — nicht Feld für
Feld, sondern auf **Vollständigkeit**. Der Test fand sofort einen zweiten Fehler: Die
ids kollidierten (Position 1 und Materialzeile 1 trugen dieselbe).

## Neu und einstellbar

- **Schriftart.** Gemessen: Auf Vercel ist genau **eine** Schrift installiert. Vier
  Familien ins PDF geschickt — eingebettet wurde einmal `OpenSans-Regular`. Die
  CI-Schrift stand also nie im PDF, ein Serif war unmöglich. Vier Schriften liegen
  jetzt unter `public/fonts` (alle SIL OFL).
  **Und der Weg dorthin war ein zweiter Messgang wert:** Per `@font-face` über eine
  Adresse kam die Schrift trotzdem nicht an. Schriften sind CORS-pflichtig,
  `page.setContent()` gibt der Seite eine leere Herkunft, und `/public` sendet keine
  CORS-Kopfzeilen — der Browser verwarf sie stillschweigend. Dazu liegen
  Vorschau-Bereitstellungen hinter der Vercel-Anmeldung. Die PDF-Route backt die
  Datei jetzt als `data:`-Adresse ein. **Nachgemessen: `PTSerif-Regular` und
  `PTSerif-Bold` sind im PDF.**
- **Menge und Einheitspreis** als Spalten — das Referenzangebot hat sie, CraftFlow
  nicht. Abschaltbar, weil manche Betriebe bewusst nur Endsummen ausweisen.
- **Anrede** mit `{anrede}` und `{nachname}`; der Kunde bekommt beide Felder.
  „Sehr geehrter Herr Ludewigt" war vorher nicht baubar.
- **Alternativposition** — Preis in Klammern, nicht in der Summe, wie im
  Referenzangebot. Dokumentsummen laufen dafür über `nettoSumme()`.
- **Positionen umsortieren** mit Pfeilen statt Ziehen: Ein Angebot wird oft am Handy
  angefasst, dort ist Ziehen unzuverlässig.
- **Die KI darf Positionen hinzufügen.** Im Optimieren-Prompt stand nie, dass sie das
  darf — deshalb hat es niemand geschafft.
- **Lebende Vorschau neben den Einstellungen.** Constantin hat kein einziges der
  zwanzig Bedienelemente gefunden. Die Vorschau zeigt bei jedem Klick sofort die
  Wirkung — und löst nebenbei seinen Wunsch, Fehler in der Druckansicht zu sehen.

## Zwei Widersprüche in der Wissensbasis

1. Die Checkliste in `CLAUDE.md` sagt „Positionstabelle: Pos | Bezeichnung | Gesamt".
   Das Referenzangebot hat **fünf** Spalten. Jetzt einstellbar — die Checkliste
   gehört angepasst.
2. CraftFlow setzt einen **Unterschriftsblock** unter das Angebot, den es im
   Referenz-PDF nicht gibt. Er ist aber längst abschaltbar (`pdf_zeige_unterschrift`).

## Was Constantin schon hatte und nicht fand

Materialpreise (Händlerpreise), Meine Bauweise (Standardausführungen), eigenes
Briefpapier, „+ Position hinzufügen", Anrede-Vorlage. **Sein wichtigster Wunsch —
eine Bibliothek für Händlerpreise und Standardausführungen — war vollständig gebaut.**

## Nachtrag 2026-09-08, zweiter Durchgang

**Spaltenreihenfolge** an das Referenzangebot angeglichen: Pos · Menge · Bezeichnung ·
Einheitspreis · Gesamt. Ich hatte die neuen Spalten vor „Gesamt" eingehängt, ohne
nachzusehen.

**17 Schriften statt 4**, als Auswahlliste nach Serifenlos/Serif gruppiert, mit
Schriftprobe. Darunter **Arimo** und **Tinos** — metrisch identisch zu Arial und Times
New Roman, also gleiche Zeichenbreiten und gleicher Umbruch. Für „wir nutzen Arial"
ist das der richtige Ersatz, nicht nur etwas Ähnliches.

**Vorschau** mit Vollbild (A4 auf 92 %) zum Korrekturlesen.

**Eigene Textbausteine** — neue Tabelle, eigener Einstellungsbereich, Auswahl je
Angebot, sechs Praxis-Vorschläge zum Anklicken.

### Auf Fabians Frage nach Buchhaltung und Dokumente: drei tote Felder

Feld für Feld geprüft. Dokumente: alle fünf wirken. Buchhaltung: fast alle. Aber:

| Feld | Befund |
|---|---|
| `mwst_satz` | **19 % standen FEST im Code.** Für einen Kleinunternehmer nach § 19 UStG war das Dokument formal falsch — es wies Umsatzsteuer aus, die er nicht berechnen darf |
| `steuernummer` | wurde abgefragt und **nie gedruckt**. § 14 UStG verlangt Steuernummer ODER USt-IdNr. |
| `angebot_gueltig_tage` | Gültigkeit stand **fest auf 30 Tagen** |

Alle drei behoben, Kleinunternehmer als Schalter mit dem vorgeschriebenen Hinweis.

### Und ein Fehler, den ich beim Live-Test in meiner eigenen Arbeit fand

Kleinunternehmer, Gültigkeit und Textbausteine wirkten im Angebot, **nicht aber in der
Vorschau**. Beide Seiten bauten die PDF-Optionen getrennt zusammen — ich habe es
vergessen, im selben Zug, in dem ich die Vorschau gebaut habe. Jetzt eine Zuordnung in
`src/lib/pdfoptionen.ts` für beide.

**Das ist die dritte Doppelung derselben Art in dieser Woche** (Faktorlisten,
Ankerpreis, jetzt die PDF-Optionen). Wo zwei Stellen dieselbe Wahrheit herstellen,
laufen sie auseinander — nicht vielleicht, sondern verlässlich.
