# Betriebskalibrierung neu — Referenzmöbel als vollständige Projekte

Stand: 2026-09-17 (Entwurf zur Abnahme durch Fabian). Grundlage: Analyse
`.superpowers/sdd/2026-09-16-preisfaktor-wuensche-bloecke/kalibrierung-analyse.md` und
die 18 echten Rechenläufe (`/tmp/lvtest/referenz-laeufe.json`).

## 1. Warum

Die Seite „Mein Betrieb“ entscheidet, ob CraftFlow für einen Betrieb richtig rechnet.
Heute stehen dort fünf kurze Referenztexte, ein Ankerpreis und Antwortspannen. Drei
Dinge stimmen nicht:

1. **Die Referenztexte sind zu knapp.** Sie sagen nicht, was enthalten ist (E-Geräte,
   Spüle, Armatur), wie weit geliefert wird, welche Beschläge, welche Oberfläche. Zwei
   Betriebe lesen zwei verschiedene Küchen und geben zwei verschiedene Preise — die
   Kalibrierung misst dann Auslegung, nicht Tempo. Beweis: Mit dem heutigen Text ohne
   Kunde/Adresse stellt CraftFlow selbst Rückfragen statt zu rechnen (Rechenlauf 16.09.).
2. **Die Preisspannen entstehen aus einer Formel, nicht aus einer Kalkulation.** Der
   Nutzer sieht 9.784 €, aber nicht, wie sie sich zusammensetzen. Und die Formel hat einen
   Fehler: Bei der Küche liegt „Fronten Eiche massiv“ (8.100–11.000 €) unter „Dekor“
   (8.600–11.500 €), weil die Massiv-Rechnung Korpusse, Beschläge und Arbeitsplatte
   verliert.
3. **Der Referenzpreis kommt heute aus der Faustregel** („1 lfm ≈ 1.000 €“, 10.000 € für
   die Küche) und ist damit die Vorgabe für alle Spannen. Fabian (17.09.): „Die Faustregel
   soll als Kontrolle dienen, nicht als Kalkulationsvorgabe.“ Richtig ist die umgekehrte
   Richtung: Der Referenzpreis entsteht **von unten** aus Stückliste, Zeitrichtwerten und
   Stundensätzen; die Faustregel prüft danach nur, ob das Ergebnis im plausiblen Rahmen liegt.

## 2. Grundsätze

- **Ein Referenzmöbel ist ein vollständiges Projekt.** Der Text ist so geschrieben, wie
  ein Kunde sein Projekt in CraftFlow beschreiben sollte — er dient zugleich als
  Musterbeschreibung („so beschreibst du ein Projekt, dann rechnet CraftFlow gut“).
- **Der Referenzpreis ist eine sichtbare Kalkulation**, keine Zahl: Positionen,
  Materialliste mit EK und Aufschlag, Stunden je Kostenstelle mit den Sätzen des
  Betriebs, Summen. Der Nutzer kann sie als Projekt öffnen und verändern.
- **Die Antwortspannen werden aus genau dieser Kalkulation abgeleitet** — und die
  Varianten (Lack, Massiv, Altbau) sind eigene, sichtbare Kalkulationen derselben
  Referenz, nicht Formelableitungen.
- **Die Faustregeln (CLAUDE.md Abschnitt 6.1) sind eine Kontrolle, keine Vorgabe.** Neben
  der Referenzkalkulation steht: „Faustregel für so ein Möbel: 1.800–2.600 € — deine
  Kalkulation liegt im Rahmen.“ Weicht sie stark ab, erscheint ein Hinweis mit dem
  wahrscheinlichen Grund (Materialansatz, Stundensatz, Zeitrichtwert); die Zahl wird nie
  angepasst.
- **„Nicht enthalten“ nennt nur, was ein Kunde vom Schreiner erwarten könnte** und trotzdem
  nicht im Preis ist (Fabian, 17.09.: Malerarbeiten haben dort nichts verloren).
- **Ausgangszustand und Umfang stehen in jedem Text:** Neubau/Altbau, Entfernung,
  was enthalten ist, was nicht.

## 3. Die fünf Referenzmöbel — neue Texte (Entwurf, von Fabian zu prüfen)

Muster je Text: Kunde und Ort · Möbelart und Maße · Material · Ausstattung und
Beschläge · Oberfläche · Montage und Lieferung · nicht enthalten.

### 3.1 Einbauschrank (die gemessene Referenz)
> Kunde: Familie Muster, Musterstraße 12, 63517 Rodenbach (20 km Anfahrt).
> Einbauschrank für den Flur, 2,00 m breit × 2,40 m hoch × 0,60 m tief, raumhoch
> zwischen zwei geraden Wänden, Neubau. Korpus und Fronten Egger Dekorspanplatte
> 19 mm weiß (U999), alle Sichtkanten ABS 1 mm. Vier Drehtüren mit Blum-Topfscharnieren
> (Clip top, gedämpft), zwei Schubkästen auf Blum-Systemauszügen (Vollauszug,
> gedämpft), eine Kleiderstange, je Fach zwei Einlegeböden auf Bodenträgern, Sockel
> 100 mm, Rückwand 8 mm. Griffe: Kunde stellt keine — verdeckte Griffleiste gefräst
> entfällt, Standardgriffe Edelstahl 128 mm. Lieferung und Montage beim Kunden,
> Erdgeschoss. Nicht enthalten: Innenbeleuchtung und Elektroanschluss.

### 3.2 Einbauküche
> Kunde: Familie Muster, Musterstraße 12, 63517 Rodenbach (20 km Anfahrt).
> Einbauküche in L-Form, 3,60 m × 2,20 m, Neubau, gerade Wände, Anschlüsse liegen.
> Korpusse Dekorspanplatte 19 mm weiß, Rückwände 8 mm. Fronten Dekorspanplatte
> 19 mm weiß matt, Kanten ABS 1 mm. Acht Unterschränke (davon drei mit je drei
> Auszügen Blum Legrabox, fünf mit Drehtür und Einlegeboden), ein Spülenunterschrank
> 900 mm, vier Oberschränke 900 mm hoch mit Drehtüren, Blum-Topfscharniere gedämpft.
> Arbeitsplatte Schichtstoff 38 mm mit Ausschnitten für Spüle und Kochfeld,
> Wandabschlussleiste, Sockelblende 100 mm, Griffe Edelstahl 160 mm. Lieferung und
> Montage inklusive Ausrichten und Anschluss der Arbeitsplatte, Erdgeschoss.
> **Nicht enthalten: Elektrogeräte, Spüle und Armatur, Elektro- und Wasseranschluss,
> Fliesenspiegel/Nischenrückwand.**

### 3.3 Innentüren
> Kunde: Familie Muster, Musterstraße 12, 63517 Rodenbach (20 km Anfahrt).
> Fünf Innentüren mit Umfassungszargen im Altbau (Wände nicht überall im Lot, alte
> Zargen sind ausgebaut). Türblätter Röhrenspan, weiß beschichtet (CPL), Standardmaß
> 860 × 1.985 mm, Zargen weiß beschichtet für Wandstärke 120–140 mm, Bänder V 3420,
> Buntbartschloss, Drückergarnitur Edelstahl. Liefern, Zargen einpassen und kürzen,
> Türen einhängen und einstellen, Erdgeschoss und erster Stock. Nicht enthalten:
> Ausbau der alten Zargen (in der Altbau-Frage unten gesondert).

### 3.4 Treppe
> Kunde: Familie Muster, Musterstraße 12, 63517 Rodenbach (20 km Anfahrt).
> Geradläufige Treppe, Buche massiv, 13 Steigungen (Geschosshöhe 2,73 m), 90 cm
> laufbreit, mit Setzstufen, Wangen 40 mm, Stufen 40 mm, Geländer mit Füllstäben und
> Handlauf rund 42 mm, Oberfläche geölt. Rohtreppe zugekauft (fertig geölt vom
> Hersteller), Neubau, Treppenloch fertig, Rohbetonauflager. Anlieferung, Einbau,
> Anpassung an Wand und Decke, Montage des Geländers. Nicht enthalten: Podest und
> Treppenbelag im Umfeld.

### 3.5 Massivholztisch
> Kunde: Familie Muster, Musterstraße 12, 63517 Rodenbach (20 km Anfahrt).
> Esstisch Eiche massiv, 200 × 90 cm, Platte 40 mm durchgehend verleimt, Kanten
> gerade, Wangengestell Eiche massiv 60 mm mit Metall-Zarge unter der Platte,
> Oberfläche Hartwachsöl zweimal, alle Seiten. Lieferung ins Erdgeschoss, Gestell und
> Platte werden vor Ort verschraubt (30 Minuten). Nicht enthalten: Stühle, Bank.

## 4. Fünf Referenzprojekte — mit den Varianten als Alternativpositionen

Fabian (17.09.): „Insgesamt soll es fünf Projekte geben, in die man reinschauen kann. Die
Alternativen mit Massivholz, Lack etc. werden als Alternativpositionen mit dem kalkulierten
Preis abgebildet.“

Jedes Referenzmöbel ist ein **vollständiges CraftFlow-Projekt** (Kunde, Kopfdaten,
Positionen, Materiallisten, Arbeitszeiten je Kostenstelle, Summen), genau so, wie es in der
Kalkulation eines echten Angebots aussieht. Die Varianten der Fragen sind darin
**Alternativpositionen** — das vorhandene Konzept der App (Häkchen „Alternativposition“,
zählt nicht zur Summe, steht mit eigenem Preis im Angebot):

| Referenzprojekt | Grundposition(en) | Alternativpositionen (je mit kalkuliertem Preis) |
|---|---|---|
| Einbauschrank Flur | Einbauschrank Dekor weiß, Lieferung und Montage Neubau | Alternative: alle Flächen weiß lackiert seidenmatt · Alternative: komplett Eiche massiv, geölt · Alternative: Montage im Altbau (Wände nicht im Lot, Dielenboden, 2. Stock ohne Aufzug) |
| Einbauküche | Unterschränke, Oberschränke, Spülenschrank, Arbeitsplatte, Lieferung und Montage Neubau | Alternative: Fronten weiß lackiert seidenmatt · Alternative: Fronten Eiche massiv, geölt · Alternative: Montage im Altbau |
| Innentüren | 5 Türen mit Zargen, liefern und einpassen (Altbau) | Alternative: Türen von uns weiß lackiert statt CPL · Alternative: Türen Eiche massiv, geölt · Alternative: mit Ausbau der alten Zargen und Wandausbesserung |
| Treppe | Rohtreppe Buche zugekauft, Einbau und Anpassung Neubau | Alternative: weiß lackiert seidenmatt statt geölt · Alternative: Einbau im Altbau (schiefe Wände, Podest anpassen, enges Treppenhaus) |
| Massivholztisch | Tisch Eiche massiv geölt, Lieferung Erdgeschoss | Alternative: weiß lackiert seidenmatt · Alternative: Lieferung 2. Stock ohne Aufzug, Gestell vor Ort montiert |

**Wie das auf der Seite „Mein Betrieb“ aussieht:**
- Unter „Was baust du?“ erscheint das passende Referenzprojekt als aufklappbare Kalkulation:
  Positionen mit Material (Bezeichnung, Menge, EK, Aufschlag) und Arbeitszeit (Kostenstelle,
  Minuten, Satz), Zwischensummen, Netto — mit den Sätzen und Aufschlägen des Betriebs.
  Alternativpositionen stehen darunter, so gekennzeichnet wie in jedem Angebot.
- Knopf **„Als Projekt öffnen“**: legt eine Kopie als eigenes Projekt an (Titel „Referenz:
  Einbauküche“), damit der Betrieb darin Material, Zeiten und Preise verändern und
  vergleichen kann. Die Referenz selbst bleibt unverändert.
- **Die Fragen** stehen direkt unter der jeweiligen Position: Die Grundfrage unter der
  Grundposition („CraftFlow rechnet 2.245 € — was nimmst du?“), die Lackfrage unter der
  Lack-Alternative („CraftFlow rechnet + 798 € — was kommt bei dir dazu?“), die Massivfrage
  unter der Massiv-Alternative, die Montagefrage unter der Altbau-Alternative (als Dauer).
  Die fünf Antwortspannen werden wie heute rückwärts aus den Zielfaktoren 0,6 … 1,4
  gebildet — aber aus dem kalkulierten Preis **dieser** Position, nicht aus einer Formel.
- Die **Faustregel** (CLAUDE.md 6.1) steht als Kontrollzeile neben der Summe: „Faustregel
  1.800–2.600 € — liegt im Rahmen.“ Weicht die Kalkulation stark ab, ein Hinweis, keine
  Korrektur.

**Woher die Zahlen kommen:** aus einer festen, gepflegten Positionsliste je Referenz
(kein KI-Aufruf beim Anzeigen), **von unten** aufgebaut:

1. **Stückliste → Material-EK:** Platten nach m² (Korpus, Fronten, Rückwand), Kanten nach
   lfm, Beschläge nach Stück (Scharniere, Auszüge, Griffe), Arbeitsplatte nach lfm — mit
   den Richtpreisen aus CLAUDE.md Abschnitt 7, plus Kleinmaterial-Pauschale. Der Aufschlag
   kommt aus den Warenaufschlägen des Betriebs.
2. **Zeitrichtwerte → Minuten je Kostenstelle:** Zuschnitt je Platte, Kante je lfm,
   Korpus je Stück, Schubkasten und Tür je Stück, Oberfläche je m² (CLAUDE.md Abschnitte
   3–4), Montage je lfm bzw. je Stück (Abschnitt 5), Fixsockel Besprechung/Planung/
   Konstruktion/Arbeitsvorbereitung wie beim gemessenen Einbauschrank.
3. **Alternativen** ändern nur die betroffenen Zeilen: Lack = Oberfläche (min/m²) + Lackmaterial
   statt Kante/Dekor; Massiv = Massivholz statt Platte **nur für die getauschten Bauteile**
   (Küche: Fronten; Schrank: alles) + längere Werkstattzeit + Ölen statt Bekantung; Altbau =
   Montage × Erschwernis (Abschnitt 5, Puffer-Regeln 8.2).
4. **Stundensätze und Aufschlag des Betriebs** machen daraus den Preis.

Der Einbauschrank ist die gemessene Vorlage (Ist-Zahlen aus dem Betrieb). Küche, Türen,
Treppe und Tisch werden nach demselben Muster aufgebaut und von Fabian gegengelesen — er
prüft Stückliste, Zeiten und Ergebnis, statt einen Zielpreis vorzugeben.

**Technisch:** Die fünf Projekte liegen als Daten im Code (`src/lib/referenzprojekte.ts`,
importfrei, getestet): je Referenz Kunde, Kopf, Positionen im Format `Angebotsposition`
(inkl. `alternativ: true` für die Varianten). Die Seite rechnet sie mit `calcAngebotspos`
und den Sätzen des Betriebs; die Bänder entstehen aus `skala()` wie heute. Die
KI-Referenzläufe vom 16./17.09. bleiben als Gegenprobe im Protokoll.

## 5. Fragen und Spannen

- Grundfrage, Lack, Massiv, Altbau-Montage bleiben — jetzt je Position sichtbar (siehe 4).
- **Türen:** Grundtext ist Altbau — die Montage-Alternative heißt „mit Ausbau der alten
  Zargen und Wandausbesserung“ (echter Mehraufwand statt doppeltem Altbau).
- **Treppe/Tisch:** Ausgangszustand steht im Text (Neubau / Erdgeschoss), die Alternative
  beschreibt eine klar schwerere Situation.
- **Lackierkabine:** Erklärsatz unter der Maschinenfrage: „Ohne Lackierkabine setzt
  CraftFlow lackierte Flächen als Zukauf an (Quadratmeterpreis von dir), nicht als
  eigene Arbeitszeit.“ Die Lack-Alternative der Referenz zeigt dann den Zukaufpreis.
- **Schwerpunkte ohne eigenes Referenzmöbel** (Bad, Böden, Verkleidung, Ladenbau,
  Außen, Reparatur): Hinweis „Kalibriert am Einbauschrank — er steht deiner Arbeit am
  nächsten.“

## 6. Offene Entscheidungen für Fabian

1. ~~Referenzpreise netto je Möbel~~ → entfällt (Fabian, 17.09.): Der Preis entsteht aus
   der Stückliste. Stattdessen liest Fabian die fünf aufgebauten Kalkulationen gegen
   (Stückliste vollständig? Zeitrichtwerte passend? Ergebnis plausibel?).
2. Die Texte oben: fachlich richtig? Fehlt etwas, was ein Kunde fragen würde?
3. ~~Referenzkalkulation: feste Positionsliste oder KI-Lauf?~~ → entschieden (17.09.): fünf feste Referenzprojekte mit Alternativpositionen, kein KI-Lauf.
