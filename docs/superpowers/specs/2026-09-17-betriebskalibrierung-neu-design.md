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
3. **Der Referenzpreis der Küche (10.000 € netto)** kommt aus der Faustregel „1 lfm ≈
   1.000 €“ — für eine Schreinerküche mit 12 Korpussen vermutlich zu niedrig. Alle
   Spannen hängen an dieser einen Zahl.

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
> Erdgeschoss. Nicht enthalten: Elektrik, Beleuchtung, Malerarbeiten.

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
> Ausbau alter Zargen, Putz- und Malerarbeiten.

### 3.4 Treppe
> Kunde: Familie Muster, Musterstraße 12, 63517 Rodenbach (20 km Anfahrt).
> Geradläufige Treppe, Buche massiv, 13 Steigungen (Geschosshöhe 2,73 m), 90 cm
> laufbreit, mit Setzstufen, Wangen 40 mm, Stufen 40 mm, Geländer mit Füllstäben und
> Handlauf rund 42 mm, Oberfläche geölt. Rohtreppe zugekauft (fertig geölt vom
> Hersteller), Neubau, Treppenloch fertig, Rohbetonauflager. Anlieferung, Einbau,
> Anpassung an Wand und Decke, Montage des Geländers. Nicht enthalten: Podest,
> Bodenbelag im Umfeld, Malerarbeiten.

### 3.5 Massivholztisch
> Kunde: Familie Muster, Musterstraße 12, 63517 Rodenbach (20 km Anfahrt).
> Esstisch Eiche massiv, 200 × 90 cm, Platte 40 mm durchgehend verleimt, Kanten
> gerade, Wangengestell Eiche massiv 60 mm mit Metall-Zarge unter der Platte,
> Oberfläche Hartwachsöl zweimal, alle Seiten. Lieferung ins Erdgeschoss, Gestell und
> Platte werden vor Ort verschraubt (30 Minuten). Nicht enthalten: Stühle, Bank.

## 4. Die Referenzkalkulation auf der Seite

Unter dem Referenztext ein aufklappbarer Kasten **„So rechnet CraftFlow dieses
Möbel“** mit denselben Blöcken wie in der Kalkulation: Positionen (Titel, Menge),
Material (Bezeichnung, Menge, EK, Aufschlag, Preis), Arbeitszeit je Kostenstelle
(Minuten, Satz, Betrag), Zwischensummen Material / Arbeit / Fixkosten, Netto. Mit den
Sätzen und dem Aufschlag des Betriebs gerechnet; Änderungen an den Sätzen wirken
sofort. Knopf **„Als Projekt öffnen“** legt eine Kopie als neues Projekt an.

Die Kalkulation stammt aus einer **festen, gepflegten Positionsliste je Referenz**
(kein KI-Aufruf beim Anzeigen): Material und Minuten sind Fabians geprüfte Zahlen.
Damit ist die Referenz stabil und nachvollziehbar. Die 18 KI-Rechenläufe vom 16./17.09.
dienen als Gegenprobe, was CraftFlow ohne Kalibrierung aus den Texten macht.

## 5. Fragen und Spannen

- Grundfrage, Lack, Massiv, Altbau-Montage bleiben. Jede Variante ist eine eigene
  sichtbare Kalkulation (gleiche Positionsliste, geänderte Zeilen), die Spannen werden
  wie heute rückwärts aus den Zielfaktoren gebildet — aber aus dieser Kalkulation.
- **Massiv:** Grundmaterial bleibt, dazu Massivholz nur für die getauschten Bauteile
  (Küche: Fronten; Schrank: alles), längere Werkstattzeit und Ölen statt Bekantung.
- **Türen:** Grundtext ist Altbau — die Montagefrage fragt dann nicht „im Altbau“
  noch einmal, sondern „mit Ausbau der alten Zargen und Wandausbesserung“ (echter Mehraufwand).
- **Treppe/Tisch:** Ausgangszustand steht im Text (Neubau / Erdgeschoss), die
  Montagefrage beschreibt eine klar schwerere Situation.
- **Lackierkabine:** Erklärsatz unter der Maschinenfrage: „Ohne Lackierkabine setzt
  CraftFlow lackierte Flächen als Zukauf an (Quadratmeterpreis von dir), nicht als
  eigene Arbeitszeit.“
- **Schwerpunkte ohne eigenes Referenzmöbel** (Bad, Böden, Verkleidung, Ladenbau,
  Außen, Reparatur): Hinweis „Kalibriert am Einbauschrank — er steht deiner Arbeit am
  nächsten.“

## 6. Offene Entscheidungen für Fabian

1. Referenzpreise netto je Möbel (vor allem Küche) — deine Zahl als Meister.
2. Die Texte oben: fachlich richtig? Fehlt etwas, was ein Kunde fragen würde?
3. Referenzkalkulation: feste Positionsliste (empfohlen) oder KI-Lauf?
