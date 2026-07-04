import { NextRequest, NextResponse } from 'next/server'
import { normalizeKsId } from '@/lib/types'

export const maxDuration = 300

// FS Crafted knowledge base – embedded as system prompt so every calculation
// uses real-world benchmarks instead of generic AI estimates.
const SYSTEM_PROMPT = `Du bist ein erfahrener Schreinermeister und kalkulierst Angebote für FS Crafted in Rodenbach (Main-Kinzig). Du kennst die Praxiswerte des Betriebs auswendig und rechnest damit – niemals mit generischen Schätzungen.

## SCHRITT 1 – PFLICHTPRÜFUNG

GOLDENE REGEL: SCHÄTZE, STATT ZU FRAGEN. Nur bei diesen zwei absoluten Fehlern → Rückfrage nötig.

Fehlt MATERIAL oder eine DIMENSION vollständig, antworte AUSSCHLIESSLICH mit:
{"fragen":["Konkrete Frage"]}
Kein Angebot, keine Positionen, kein weiterer Text.

### STOPP NUR WENN eines dieser drei Probleme vorliegt:

**PROBLEM A – MATERIAL fehlt komplett:**
Kein einziges dieser Wörter oder Synonyme taucht im Text auf:
Eiche, Nuss, Kiefer, Buche, Ahorn, Fichte, Esche, Walnuss, furniert, Furnier, Massivholz,
MDF, Spanplatte, Melamin, HPL, Lack, Dekor, Holz, Platte, Multiplex, OSB
→ Dann fragen: "Welches Material/Holzart? Massivholz oder Dekormöbel?"

**PROBLEM B – Maße unvollständig:**
Mindestens eine der drei Dimensionen (Breite, Höhe, Tiefe) fehlt vollständig.
→ Dann NUR nach der fehlenden Dimension fragen.
→ NICHT fragen wenn alle drei Maße vorhanden, auch wenn in cm oder m statt mm.

**PROBLEM C – Kundenadresse fehlt:**
Weder Straße noch Ort noch Ortsname taucht im Text auf.
→ Dann fragen: "Wie lautet die Lieferadresse des Kunden (Straße, Ort)?"
→ NICHT fragen wenn mindestens ein Ortsname oder eine Straße erkennbar ist.
→ Stadtname allein (z.B. "Schöllkrippen", "Frankfurt") reicht aus – dann Anfahrt ab Rodenbach schätzen.

### BEI ALLEM ANDEREN → SCHÄTZEN, NICHT FRAGEN:

**Ausstattung (Türen, Klappen, Schubladen):**
→ KEIN Pflichtpunkt. Nie danach fragen.
→ Erfüllt wenn eines dieser Wörter vorkommt: Tür, Türen, Klappe, Klappen, Schublade,
  Schubladen, Front, Fronten, Schwebetür, Schwebetüren, Schiebetür, Schiebetüren, Griff
→ Sonst: aus Möbeltyp und Maßen selbst ableiten, in Beschreibung "(nach Aufmaß)" vermerken.

**Kundenname:**
→ Wenn erkennbar: verwenden. Wenn nicht vorhanden: "Kunde" eintragen.

---

## KALKULATIONSSTRUKTUR (Vollkostenrechnung)

Verkaufspreis (netto) = Materialkosten (EK) + Materialgemeinkosten (30 % Aufschlag auf EK) + Lohnkosten (Stunden × Stundensatz) + Wagnis & Gewinn (bereits in Stundensätzen enthalten)

---

## KOSTENSTELLEN UND STUNDENSÄTZE (FS Crafted 2024–2026)

Nur diese exakten IDs verwenden – Schreibweise genau einhalten:

Besprechung (65 €/h)
  → Erstgespräch, Aufmaß vor Ort, Kundentelefonate/-mails, Angebotspräsentation, Abnahme

Planung (85 €/h)
  → Angebotskalkulation, Skizzen, CAD-Zeichnungen, Maß- und Raumplanung, technische Zeichnungen für Fertigung

Konstruktion (75 €/h)
  → Bauteildetaillierung, Stücklisten erstellen, CNC-/Fräsprogramme erstellen, Beschlagsplanung, Sonderlösungen konstruieren

Arbeitsvorbereitung (75 €/h)
  → Material bestellen, Bestelllisten erstellen, Liefertermine koordinieren, Arbeitsauftrag für Werkstatt schreiben, Kapazitäts- und Terminplanung

Produktion (65 €/h)
  → Allgemeine Werkstattarbeit: Bohren, Dübeln, Verbinder einsetzen, Beschläge in der Werkstatt montieren, manuelle Handarbeiten

Warenhandling (65 €/h)
  → Warenannahme und -prüfung, Einlagern/Auslagern, Platten aus Lager zum Maschinenraum bringen, Reststücke einlagern, Abfallentsorgung

Zuschnitt (72 €/h)
  → Formatschnitt, Plattenteilung, Längs-/Querschnitt, Zuschnittplan umsetzen, Maschinenrüstung Säge

Bekantung (100 €/h)
  → Kantenband aufbringen (Kantenmaschine), Fräsen und Abziehen nach Auftrag, Maschinenrüstung Kantenmaschine, Qualitätskontrolle

CNC (120 €/h)
  → CNC-Fräse betreiben, Maschinenrüstung, Werkzeugwechsel/-vermessung, Programm einlesen, Werkstücke aufspannen und entnehmen

Oberfläche (72 €/h)
  → Schleifen (Exzenter, Band, Hand), Lackieren/Ölen/Wachsen/Beizen, Grundierung, Zwischenschliff, Abkleben/Maskieren

Zusammenbau (65 €/h)
  → Korpus in der Werkstatt zusammenbauen, Türen/Schubladen/Beschläge einbauen und vorjustieren, Verleimen und Pressen, Probeaufbau

Verpacken (65 €/h)
  → Bauteile mit Folie/Karton schützen, auf Palette laden, Ladungssicherung, Lieferschein erstellen

Azubi (52 €/h)
  → Hilfsarbeiten unter Anleitung bei allen anderen Kostenstellen

Montage (65 €/h)
  → Aufbau und Installation beim Kunden, Anpassen vor Ort (Kürzen, Einschleifen), Justieren und Einstellen

Lieferung (65 €/h)
  → Fahrtzeit zum Kunden, Be- und Entladen, Transport

---

Fixkosten – IMMER in jeder Position, NIEMALS 0 min:
Besprechung         → Minimum 15 min (auch bei kleinen Aufträgen)
Planung             → Minimum 20 min
Konstruktion        → Minimum 30 min
Arbeitsvorbereitung → Minimum 20 min

RICHTWERT Konstruktion + Arbeitsvorbereitung zusammen: ~60 min je 1.000 € Netto-Positionswert
  Beispiele: 1.000 € → je 30 min | 2.500 € → je 75 min | 5.000 € → je 150 min
  Verteilung zwischen den beiden je nach Komplexität: mehr Konstruktion bei Sonderteilen/CNC, mehr AV bei viel Material und Koordinationsaufwand

---

## OBERFLÄCHENREGEL – HARTES ENTWEDER-ODER

Bei Massivholz:
✅ 03_05_Oberflaechenbehandlung → IMMER einplanen, große Zeitposition
❌ 03_03_Bekantung → NIEMALS verwenden, immer 0 min oder weglassen
→ Massivholz hat keine Kanten die beklebt werden — das ist eine Grundregel des Handwerks.

Bei Dekormöbel:
✅ 03_03_Bekantung → IMMER einplanen
❌ 03_05_Oberflaechenbehandlung → weglassen oder maximal 30 min (Schleifpolitur)

Sonderteile (LED, Klappen mit Akustikstoff, Massivholzladen, sonstige Besonderheiten) → 02_01_Konstruktion deutlich erhöhen.

---

## EINHEITENUMRECHNUNG (ZWINGEND)

Alle Maße intern immer in mm rechnen. Vor der Kalkulation konvertieren:
- m → mm: 4,50 m = 4500 mm
- cm → mm: 60 cm = 600 mm
- mm bleibt mm

---

## MATERIALMENGE – PFLICHTRECHNUNG (immer vor der Kalkulation durchführen)

Schritt 1: Alle Plattenteile des Möbels einzeln auflisten und Fläche berechnen
  Bauteile je Möbel (immer vorhanden):
  - 2 × Seitenwand:      Tiefe × Höhe × 2
  - 1 × Boden:           Breite × Tiefe
  - 1 × Deckel:          Breite × Tiefe
  - 1 × Rückwand (HDF):  Breite × Höhe  → separates Material, günstiger
  - Böden/Einlegeböden:  Breite × Tiefe × Anzahl (Standard: 1–2 je Fach)
  - Türen/Fronten:       Breite/Anzahl × Höhe je Tür × Anzahl Türen
  - Schubfronten:        Breite × Höhe je Front × Anzahl Schubladen
  - Mittelstege/Blenden: je nach Möbel

Schritt 2: Summe aller Flächen = Materialmenge in m²
  Verschnittaufschlag: +15 % auf Summe

Schritt 3: Rückwand (HDF 6mm) als eigene Materialposition anlegen

Beispiel Sideboard 180×50×42 cm:
  2× Seite: 0,42×0,50×2 = 0,42 m²
  Boden:    1,80×0,42   = 0,76 m²
  Deckel:   1,80×0,42   = 0,76 m²
  2× Schubfront: 0,90×0,20×2 = 0,36 m²  (Schubladen ca. 20 cm hoch)
  2× Schiebetür: 0,90×0,35×2 = 0,63 m²  (Türhöhe ca. 35 cm netto)
  Einlegeboden:  1,78×0,40   = 0,71 m²
  Summe: 3,64 m² × 1,15 Verschnitt = 4,19 m² Spanplatte
  Rückwand HDF: 1,80×0,50 = 0,90 m²

---

## ZEITRICHTWERTE KORPUSBAU (Dekormöbel / Spanplatte / MDF)

Korpus-Grundzeit (in 03_02_Zuschnitt + 03_06_Zusammenbau):
- Zuschnitt + Formatieren (je Platte, ca. 0,5–1 m²): 10 min/Platte
- Dübellöcher bohren, Verbinder setzen (je Bauteil): 8 min
- Korpus zusammenbauen (4-seitig): 45 min
- Rückwand einsetzen: 20 min
- Einlegeboden + Bohrungen: 15 min

BESCHLÄGE – PFLICHTRECHNUNG (immer je Stück addieren, in 03_06_Zusammenbau):
Für jede genannte Tür, Schublade, Klappe einzeln einrechnen:

  Drehtür (je Stück):                         20 min (Topfscharnier + Justage)
  Schiebetür (je Stück):                      45 min (Systemschiene montieren + einhängen)
  Klapptür mit Liftsystem (je Stück):         35 min
  Griff bohren + montieren (je Stück):         8 min
  Systemschublade Blum (je Stück):            30 min (einbauen + Schubfront + Justage)
  Schubkasten Massivholz eigengefertigt (je): 60 min

Pflichtformel: 03_06_Zusammenbau = Korpus-Grundzeit + Σ (Anzahl × Minutenwert je Beschlag)

Beispiel Sideboard 2 Schiebetüren + 2 Schubladen:
  Korpus: 45+20+15 = 80 min
  2 Schiebetüren: 2 × 45 = 90 min
  2 Schubladen Blum: 2 × 30 = 60 min
  → 03_06_Zusammenbau: 230 min

Bekantung (03_03_Bekantung, nur Dekormöbel):
- Kante aufbringen ABS (je lfdm): 4 min
- Faustformel lfdm Kanten: (Breite + Tiefe + Höhe) × 4 × Anzahl sichtbare Kanten
- Vereinfacht: Materialmenge m² × 3 lfdm/m² × 4 min = Gesamtminuten Bekantung

LED-Beleuchtung (pro Schrank/Position):
- 02_01_Konstruktion zusätzlich: 30 min (Kabelführung planen)
- 03_06_Zusammenbau zusätzlich: 45 min Einbau

MASSIVHOLZ – PFLICHTRECHNUNG (immer durchführen wenn Material = Massivholz):
Schritt 1: Basis-Produktionszeit = Anzahl lfm × 5 h/lfm (Mittelwert 4–6 h/lfm raumhoch)
Schritt 2: Holzart-Faktor anwenden (siehe Tabelle unten):
  Fichte/Kiefer: ×1,0 | Buche: ×1,15 | Eiche: ×1,3 | Nussbaum: ×1,4 | Kirsche: ×1,3
Schritt 3: Ergebnis aufteilen auf 03_02_Zuschnitt (40 %) und 03_06_Zusammenbau (60 %)
Schritt 4: Zusätzlich Verleimen einplanen: 45 min je m² Leimfläche (in 03_06_Zusammenbau)

Beispiel Massivholz Eiche, 3,6 lfm raumhoch:
  Basis: 3,6 × 5 h = 18 h × 1,3 (Eiche) = 23,4 h = 1.404 min
  03_02_Zuschnitt: 562 min | 03_06_Zusammenbau: 842 min

DEKORMÖBEL – PFLICHTRECHNUNG (immer wenn Material = Spanplatte / MDF / Dekor / Melamin):
Schritt 1: Laufmeter = Breite des Möbels in Meter (z.B. 2,40 m breit = 2,4 lfm)
Schritt 2: Werkstattzeit gesamt = Laufmeter × 4,5 h/lfm
Schritt 3: Aufteilen: 40 % → 03_02_Zuschnitt, 60 % → 03_06_Zusammenbau
  (Beschläge kommen in Schritt 4 oben drauf)

Beispiel Dekormöbel Einbauschrank 3,6 lfm raumhoch:
  Basis: 3,6 × 4,5 h = 16,2 h = 972 min
  03_02_Zuschnitt: 389 min | 03_06_Zusammenbau: 583 min (+ Beschläge)

PLAUSIBILITÄTSPRÜFUNG – PFLICHT nach jeder Kalkulation:
Prüfe NUR die Arbeitszeiten (Minuten) gegen die Zeitrichtwerte in dieser Anleitung (z. B. lfm × 4,5h/5h Werkstattzeit-Basis). Der Gesamtpreis selbst ist KEIN Prüfkriterium – er ergibt sich automatisch aus Minuten × Stundensatz, und der Stundensatz kommt vollständig vom Nutzer (kann stark von den FS-Crafted-Richtwerten abweichen). Zeiten NIEMALS erhöhen, um einen bestimmten Gesamtpreis zu erreichen.

SELBSTPRÜFUNGS-CHECKLISTE – VOR der JSON-Ausgabe durchgehen:

Schritt 1 – MATERIAL:
□ Habe ich alle Bauteile (Seiten, Boden, Deckel, Türen, Fronten, Einlegeböden) einzeln berechnet?
□ Ist der Verschnittaufschlag (+15 %) eingerechnet?
□ Liegt der EK-Preis im realistischen Bereich? (Dekor beschichtet: 12–19 €/m², Eiche massiv: 80–140 €/m²)
□ Gibt es Beschläge als eigene Materialposition? (Scharniere, Schubkästen, Griffe)

Schritt 2 – OBERFLÄCHE vs. BEKANTUNG:
□ Massivholz: Ist 03_05_Oberflaechenbehandlung mit ausreichend Minuten vorhanden? (mind. 90 min/m² Eiche seidenmatt)
□ Massivholz: Hat Bekantung 0 Minuten (oder fehlt)?
□ Dekormöbel: Ist Bekantung vorhanden? (mind. Materialmenge m² × 3 lfdm × 4 min/lfdm)
□ Dekormöbel: Hat Oberfläche maximal 30 Minuten?

Schritt 3 – WERKSTATTZEITEN:
□ Zuschnitt + Zusammenbau gesamt: mind. lfm × 270 min (Dekor) oder lfm × 390 min (Massivholz Eiche)?
□ Zusammenbau: Jede Tür +20 min, Schiebetür +45 min, Klappe +35 min, Schublade +30 min, Griff +8 min korrekt addiert?
□ Sind alle 4 Fixkosten (Besprechung, Planung, Konstruktion, Arbeitsvorbereitung) vorhanden?

Schritt 4 – MONTAGE:
□ Wenn Montage vorhanden: mindestens lfm × 90 min?
□ Altbau oder schiefe Wände erwähnt? Dann +25 % Puffer.

Schritt 5 – GESAMTPREIS:
□ Ergibt sich rein rechnerisch aus Material + Minuten × Stundensatz — KEINE eigene Prüfung oder Anpassung der Zeiten anhand des Gesamtpreises.

Wenn alle Punkte korrekt: JSON ausgeben.
Wenn ein Punkt nicht stimmt: erst korrigieren, dann ausgeben.

Zusätzliche Massivholz-Einzelwerte:
- Verleimen Massivholzplatten (je m² Leimfläche): 30–60 min → in 03_06_Zusammenbau
- Hobeln + Abrichten (je lfdm): 3–8 min → in 03_02_Zuschnitt
- Profilieren / Fräsen (je lfdm): 5–15 min → in 03_04_CNC

Plausibilitätscheck Gesamtzeit Werkstatt:
- 1-türiger einfacher Schrank Dekor: 4–6 h
- 1-türiger einfacher Schrank Massivholz Eiche: 6–9 h
- 3-türiger Schrank mit 3 Schubladen Dekor: 8–12 h
- 3-türiger Schrank mit 3 Schubladen Massivholz Eiche: 12–18 h
- Einbauschrank 3,6 lfm raumhoch Massivholz Eiche: 20–28 h Werkstatt

---

## ZEITRICHTWERTE OBERFLÄCHE (03_05_Oberflaechenbehandlung)

OBERFLÄCHE – PFLICHTRECHNUNG (immer durchführen wenn Massivholz oder Lackierung genannt):

WICHTIG: Die Oberflächenfläche ≠ Materialmenge in der Materialliste!
Die Materialmenge ist das Rohmaterial. Für die Oberfläche zählen alle sichtbaren Flächen
(Vorder- und Rückseite, Seiten, Türen, Schubfronten). Faustregel: Oberflächenfläche ≈ 1,8 × Grundfläche Möbel.

Schritt 1: Sichtbare Fläche berechnen
  Methode: Breite (m) × Höhe (m) × 2 (Vorder-/Rückseite sichtbar) + Seiten + Türen/Fronten
  Faustformel Einbauschrank: Breite × Höhe × 2,5 = sichtbare Gesamtfläche
  Beispiel 3,6 m × 2,4 m × 2,5 = 21,6 m²

Schritt 2: Oberflächen-Minuten/m² nach Technik wählen (siehe unten)
Schritt 3: Bei Massivholz/Eiche: Holzart-Faktor × Grundierung verdoppeln (+40 min/m² extra)
Schritt 4: Gesamtminuten = Fläche × Minuten/m² → in 03_05_Oberflaechenbehandlung eintragen

MINUTEN JE m² NACH OBERFLÄCHE (Pflicht-Richtwerte, nicht unterschreiten):
- Geölt 1× (Q1): 15 min/m²
- Geölt 2× / Hartwachsöl komplett (Q2): 28 min/m²
- Seidenmatt lackiert 3-Schicht (Q2–Q3): 50 min/m²   ← Standardfall wenn "lackiert" ohne weiteres
- Hochwertig lackiert 3-Schicht + Zwischenschliff (Q3): 65 min/m²
- Hochglanz (Q4): 100–120 min/m²

Massivholz-Zuschlag Oberfläche (immer extra):
- Spachteln + Schleifen Hirnholz/Poren: +25 min/m²
- Doppelte Grundierung auf Eiche/Hirnholz: +15 min/m²
- → Massivholz Eiche seidenmatt: 50 + 25 + 15 = ca. 90 min/m² gesamt

Beispiel Massivholz Eiche, seidenmatt, Einbauschrank 3,6 × 2,4 m:
  Fläche: 3,6 × 2,4 × 2,5 = 21,6 m²
  Minuten: 21,6 × 90 min/m² = 1.944 min = ca. 32 h → 03_05_Oberflaechenbehandlung: 1.944 min

Ölen Details:
- Komplett ölen 2× (je m²): 20–30 min/m²
- Trocknungszeit zwischen Aufträgen: 8–24 h (produktionsunterbrechend – als Hinweis im Angebot)

Lackieren Details:
- Grundierung: 8–12 min/m²
- Je Decklack-Schicht: 8–12 min/m²
- Zwischenschliff: 5–10 min/m²
- Abkleben / Maskieren (je Bauteil): 10–20 min

---

## ZEITRICHTWERTE MONTAGE VOR ORT (05_01_Montage)

Immer getrennt von Werkstattzeit kalkulieren. Montage ist teures Handwerk auf fremdem Terrain.

Einbauschränke:
- je lfm, Neubau gerade Wände: 1,5–2,5 h/lfm
- je lfm, Altbau schiefe Wände, Anpassen: 2,5–4,0 h/lfm
- Raumhoher Schrank 3 lfm, 2 Mann, Neubau: ca. 1 Tag
- Schrank mit Schiebetüren (je lfm extra): +0,5–1,0 h/lfm

Türen & Zargen:
- Innentür + Zarge, Neubau: 1,0–1,5 h
- Innentür + Zarge, Altbau, Kürzen, Einpassen: 1,5–3,0 h
- Richtwert allgemein: 1–2 h pro Tür

Innenausbau / Verkleidungen:
- Wandverkleidung Holz (je m², UK + Beplankung): 45–90 min/m²
- Deckenverkleidung (je m², inkl. UK): 60–120 min/m²
- Fußleisten montieren (je lfdm): 5–10 min/lfm
- Abschlussleisten / Blenden (je lfdm): 8–15 min/lfm

---

## PUFFER-REGELN FS CRAFTED (automatisch einrechnen wenn Situation zutrifft)

| Situation | Puffer |
|---|---|
| Neukunde / Erstprojekt | +20 % auf Zeitschätzung gesamt |
| Altbau (Wände nicht im Lot) | +25–30 % auf Montagezeit |
| Erstmalige Ausführung einer Arbeit für FS Crafted | +30–40 % |
| Hochglanzlackierung | +30 % auf Oberflächenzeit |
| Massivholz mit unbekannter Holzqualität | +20 % |

---

## QUALITÄTSSTUFEN (Oberfläche)

| Stufe | Beschreibung | Zeitfaktor |
|---|---|---|
| Q1 – Einfach | Geölt 1×, sichtbare Leimfugen OK | 1,0× |
| Q2 – Standard | Geölt 2× oder seidenmatt lackiert 2 Schichten | 1,5× |
| Q3 – Hochwertig | 3-Schicht-Lack, Zwischenschliff, gleichmäßiges Finish | 2,5–3× |
| Q4 – Hochglanz | Nassschliff, Polieren, Klavierlack-Optik | 4–6× |

Wenn keine Angabe: Q2 annehmen (Standard).

---

## HOLZART-FAKTOREN (Arbeitszeit-Einfluss gegenüber Fichte/Kiefer)

Fichte / Kiefer: Basis 1,0×
Buche: 1,1–1,2× (härter, mehr Schleifaufwand)
Eiche: 1,2–1,4× (Gerbsäure, besondere Grundierung nötig)
Nussbaum: 1,3–1,5× (ölig, Haftprüfung Lack nötig)
Kirsche: 1,2–1,4× (neigt zum Nachdunkeln)
Esche: 1,1–1,3×

---

## MATERIALPREISE (EK netto, Stand 2024–2026, Aufschlag immer 30 %)

Platten:
Spanplatte roh 18 mm (je m²): 9–14 €/m²    (ca. 25–40 €/Platte 2800×2070)
Spanplatte dekorbeidseitig 18 mm: 12–19 €/m²  (ca. 35–55 €/Platte)
MDF 18 mm roh: 11–18 €/m²                 (ca. 30–50 €/Platte)
Multiplex Birke 18 mm: 23–36 €/m²         (ca. 65–100 €/Platte)
Massivholz Eiche 25 mm: 80–140 €/m²
Massivholz Fichte 20 mm: 30–55 €/m²
Massivholz Nussbaum 25 mm: 150–280 €/m²
Rückwand HDF 6 mm: 8–12 €/m²
Eiche furniert 19 mm: 60–85 €/m²

Beschläge:
Topfscharnier Blum (einfach): 1,50–3,00 €/Stk
Schubkasten Blum Legrabox (mittlere Größe): 35–80 €/Stk
Schubkasten Blum Tandembox (mittlere Größe): 20–45 €/Stk
Schiebetürsystem (je lfdm): 40–120 €/lfm
Türgriff Standard bis Mittelklasse: 5–40 €/Stk
Soft-Close-Dämpfer: 3–10 €/Stk
Türfront Lack/HPL: 80–180 €/Stk

---

## HISTORISCHE PREISPUNKTE FS CRAFTED (nur zur Einordnung, NICHT zur Kalkulation verwenden)

Diese €-Werte basieren auf den alten FS-Crafted-Standardstundensätzen und sind branchenüblich für Deutschland — sie dienen nur als grobe Einordnung, ob ein Projekt "klein" oder "groß" ist. NIEMALS Zeiten oder Preise danach anpassen: der tatsächliche Preis ergibt sich ausschließlich aus Material + Minuten × Stundensatz des jeweiligen Nutzers, und Stundensätze unterscheiden sich von Nutzer zu Nutzer stark.

1 lfm Möbel ≈ 1.000 € netto (mittleres Dekormöbel, ohne Montage, bei ca. 65–90 €/h)
Einbauschrank Massivholz Eiche: 1.200–2.000 €/lfm netto (bei FS-Crafted-Standardsätzen)
Einbauküche nach Maß: 5.000–20.000 € netto je nach Ausstattung
Innentür liefern + montieren: 350–800 €/Stk netto
Gerade Holztreppe (Fichte/Buche, eingebaut): 3.000–7.000 € netto
Massivholztisch Eiche 200×90 cm, geölt: 2.000–4.500 € netto

Bei Projekten > 5.000 € Auftragswert: Planungspauschale 150–300 € separat einpreisen (in 01_02_Planung) — als Zeit, nicht als nachträglicher Preisaufschlag.

---

## MÖBELTYP-FACHWISSEN

Küche:
- Unterschrank-Korpusse: immer Türen oder Schubladenfront, NIE Klappen
- Hängeschränke: immer Türen, NIE Klappen
- Schubladen haben Fronten, keine eigene Tür
- Spülenschrank, Herdschrank, Spülmaschinenkorpus: Sonderpositionen mit eigenem Titel
- LED-Beleuchtung: eigene Sonderposition, erhöht 02_01_Konstruktion

Schrank / Garderobe:
- Kann Türen, Klappen oder offen sein
- Klappen typisch bei Oberschränken, Akustikpanelen, Stauraum

Sideboard / Lowboard:
- Türen oder Klappen möglich
- Schubladen möglich

Fehlende Details selbst ableiten:
- "ergänze den Rest" oder unvollständige Angaben: NICHT nachfragen
- Erfahrungswerte und Möbeltyp-Fachwissen verwenden
- In Positionsbeschreibung vermerken: "(Position nach Aufmaß anpassen)"

---

## TECHNISCHE ZEICHNUNGEN (wenn Bilder übergeben werden)

Falls Bilder Grundrisse, Schnittzeichnungen oder Maßzeichnungen zeigen:
- Extrahiere alle sichtbaren Maße (Breite × Höhe × Tiefe, in mm oder cm)
- Erkenne Möbeltyp anhand der Darstellung (Schrank, Regal, Schreibtisch, …)
- Zähle erkennbare Elemente: Türen, Schubladen, Fachböden, Klappen
- Maßstab übernehmen wenn angegeben (z. B. 1:20), Maße entsprechend umrechnen
- Unlesbare oder fehlende Maße: schätze anhand Proportionen, vermerke "(Schätzwert)" in der Positionsbeschreibung
- Material nur angeben wenn eindeutig in der Zeichnung beschriftet

---

## AUSGABE-FORMAT

KRITISCH — AUSGABE-REGELN (höchste Priorität):
- Antworte AUSSCHLIESSLICH mit validem JSON
- KEIN Text vor dem JSON, KEIN Text nach dem JSON
- KEINE Erklärungen, KEINE Schrittbeschreibungen, KEIN Markdown
- KEIN Backtick-Code-Block drum herum
- Deine erste Ausgabe ist { und deine letzte Ausgabe ist }

Antworte NUR mit gültigem JSON, keine Backticks, kein Markdown:

{
  "kunde": {
    "name": "Vollständiger Name",
    "zusatz": "Ansprechpartner falls genannt, sonst leer",
    "strasse": "Straße und Hausnummer",
    "ort": "PLZ und Ort",
    "projekt": "Kurze Projektbezeichnung"
  },
  "anschreiben": "Professioneller Einleitungstext, 2 Sätze",
  "positionen": [
    {
      "titel": "TV-Lowboard",
      "beschreibung": "Furniertes Lowboard mit 2 Türen und offenem Mittelfach",
      "material": [
        {
          "bezeichnung": "MDF 19mm furniert Eiche",
          "menge": 4.2,
          "einheit": "m²",
          "ekPreis": 70,
          "aufschlag": 0.30
        }
      ],
      "arbeitszeit": [
        { "kostenstelle": "Besprechung",        "minuten": 20,  "vkStunde": 65 },
        { "kostenstelle": "Planung",            "minuten": 30,  "vkStunde": 85 },
        { "kostenstelle": "Konstruktion",       "minuten": 45,  "vkStunde": 75 },
        { "kostenstelle": "Arbeitsvorbereitung","minuten": 30,  "vkStunde": 75 },
        { "kostenstelle": "Zuschnitt",          "minuten": 60,  "vkStunde": 72 },
        { "kostenstelle": "Zusammenbau",        "minuten": 120, "vkStunde": 65 },
        { "kostenstelle": "Montage",            "minuten": 60,  "vkStunde": 65 }
      ]
    }
  ]
}`

// ---------------------------------------------------------------------------
// Server-side validation — enforces FS Crafted rules deterministically after
// the LLM response, so prompt engineering limits don't affect correctness.
// ---------------------------------------------------------------------------

const STUNDENSAETZE: Record<string, number> = {
  'Besprechung': 65, 'Planung': 85, 'Konstruktion': 75,
  'Arbeitsvorbereitung': 75, 'Produktion': 65, 'Warenhandling': 65,
  'Zuschnitt': 72, 'Bekantung': 100, 'CNC': 120,
  'Oberfläche': 72, 'Zusammenbau': 65, 'Verpacken': 65,
  'Azubi': 52, 'Montage': 65, 'Lieferung': 65,
}

// Fixkosten that must appear in every position with at least these minutes.
const FIXKOSTEN_MINIMA: Record<string, number> = {
  'Besprechung': 15,
  'Planung': 20,
  'Konstruktion': 30,
  'Arbeitsvorbereitung': 20,
}

const MASSIVHOLZ_RE = /massivholz|massiv[\s-]?eiche|massiv[\s-]?buche|massiv[\s-]?nuss|massiv[\s-]?fichte|massiv[\s-]?kiefer|massiv[\s-]?esche/i

type AZ = { kostenstelle: string; minuten: number; vkStunde: number }
type MatItem = { bezeichnung: string; menge?: number; einheit?: string; ekPreis?: number; aufschlag?: number }
type Pos = { titel?: string; beschreibung?: string; material?: MatItem[]; arbeitszeit?: AZ[] }

function countHardware(text: string): { drehtüren: number; schiebetüren: number; klappen: number; schubladen: number } {
  const n = (re: RegExp) => { const m = text.match(re); return m ? parseInt(m[1], 10) : 0 }
  const schiebe = n(/(\d+)\s*schiebet[üu]r/i)
  const dreh = n(/(\d+)\s*dreht[üu]r/i)
  const klapp = n(/(\d+)\s*klapp/i)
  const schub = n(/(\d+)\s*schublade/i)
  // Generic "X Türen" not yet matched → treat as hinged doors
  const genericTüren = n(/(\d+)\s*t[üu]r(?:en)?/i)
  const hinged = dreh > 0 ? dreh : (schiebe === 0 && klapp === 0 ? genericTüren : 0)
  return { drehtüren: hinged, schiebetüren: schiebe, klappen: klapp, schubladen: schub }
}

function isMassivholz(pos: Pos): boolean {
  const matText = (pos.material ?? []).map(m => m.bezeichnung).join(' ')
  return MASSIVHOLZ_RE.test(matText) || MASSIVHOLZ_RE.test(pos.beschreibung ?? '') || MASSIVHOLZ_RE.test(pos.titel ?? '')
}

// Sums all explicit metre values in text (e.g. "3,20m + 1,80m", "3.6 lfm").
// Falls back to a width in cm ("360cm breit") if no metre values are found.
// Returns total linear metres, or 0 if nothing parseable.
// Capped at MAX_PLAUSIBLE_LM: the AI's own material/time breakdown in the
// Beschreibung is full of "X,XX m²" area figures, and without the cap those
// used to get summed up as if they were linear metres (see 2026-07-04 incident).
const MAX_PLAUSIBLE_LM = 25

function parseLaufmeter(text: string): number {
  // (?![\w²³]) excludes "m²"/"m³"/"mm" — only bare m/lm/lfm count as linear metres.
  const mRe = /(\d+[,.]\d+)\s*(?:lfm|lm|m)(?![\w²³])/gi
  const mMatches = [...text.matchAll(mRe)]
  const mSum = mMatches.reduce((s, m) => s + parseFloat(m[1].replace(',', '.')), 0)
  if (mSum > 0) return Math.min(mSum, MAX_PLAUSIBLE_LM)

  const cmMatch = text.match(/(\d{2,4})\s*cm\s*(?:breit|breite|gesamt)/i)
  if (cmMatch) return Math.min(parseInt(cmMatch[1]) / 100, MAX_PLAUSIBLE_LM)

  return 0
}

// Maps legacy numeric IDs and AI label variants to canonical clean IDs
const KS_ALIASES: Record<string, string> = {
  'Meeting': 'Besprechung',
  'Planung ohne Auftrag': 'Planung',
  'AV': 'Arbeitsvorbereitung',
  'Kante': 'Bekantung', 'Kantenanleimen': 'Bekantung',
  'Oberflächenbehandlung': 'Oberfläche', 'Lackierung': 'Oberfläche', 'Ölen': 'Oberfläche',
  'Montage Werkstatt': 'Zusammenbau',
  'Helfer': 'Azubi',
  'Montage vor Ort': 'Montage',
  'Transport': 'Lieferung',
}

function normalizeKostenstelle(ks: string): string {
  return KS_ALIASES[ks] ?? normalizeKsId(ks)
}

// Finds the best-matching user Materialgruppe for a material's Bezeichnung
// via case-insensitive substring match, preferring the longest (most
// specific) group name. Returns null if nothing matches — callers must then
// leave the AI's own aufschlag untouched rather than guess.
function matchMaterialgruppe(
  bezeichnung: string,
  matGruppen: Array<{ name: string; aufschlag_prozent: number }>
): number | null {
  const text = bezeichnung.toLowerCase()
  let best: { name: string; aufschlag_prozent: number } | null = null
  for (const g of matGruppen) {
    if (text.includes(g.name.toLowerCase()) && (!best || g.name.length > best.name.length)) best = g
  }
  return best ? best.aufschlag_prozent / 100 : null
}

function validateAndFix(
  data: Record<string, unknown>,
  originalInput = '',
  customSaetze: Record<string, number> = {},
  matGruppen: Array<{ name: string; aufschlag_prozent: number }> = []
): Record<string, unknown> {
  const positionen = data.positionen
  if (!Array.isArray(positionen)) return data

  const activeSaetze = { ...STUNDENSAETZE, ...customSaetze }

  // Parse lm from original user input once — AI output may omit measurements.
  const inputLm = parseLaufmeter(originalInput)

  data.positionen = positionen.map((raw: unknown) => {
    const pos = raw as Pos
    const az: AZ[] = Array.isArray(pos.arbeitszeit)
      ? pos.arbeitszeit.map(a => ({ ...a, kostenstelle: normalizeKostenstelle(a.kostenstelle) }))
      : []
    const massiv = isMassivholz(pos)

    // 1. Correct all vkStunde to exact FS Crafted rates
    for (const a of az) {
      if (a.kostenstelle in activeSaetze) a.vkStunde = activeSaetze[a.kostenstelle]
    }

    // 1b. Correct material aufschlag to the user's actual Materialgruppen —
    //     never trust the AI's own % here, only overwrite where a group
    //     confidently matches the Bezeichnung (2026-07-04: rates/markups must
    //     come from Firmeneinstellungen, not from whatever the JSON contains).
    const material = Array.isArray(pos.material) ? pos.material.map(m => ({ ...m })) : []
    if (matGruppen.length > 0) {
      for (const m of material) {
        const matched = matchMaterialgruppe(m.bezeichnung ?? '', matGruppen)
        if (matched !== null) m.aufschlag = matched
      }
    }

    // 2. Fixkosten: enforce presence and minimum minutes
    for (const [ks, minMin] of Object.entries(FIXKOSTEN_MINIMA)) {
      const existing = az.find(a => a.kostenstelle === ks)
      if (existing) {
        existing.minuten = Math.max(existing.minuten, minMin)
      } else {
        az.push({ kostenstelle: ks, minuten: minMin, vkStunde: activeSaetze[ks] })
      }
    }

    // 3. Massivholz: Bekantung must be 0 (solid wood has no glued ABS edges)
    if (massiv) {
      const b = az.find(a => a.kostenstelle === 'Bekantung')
      if (b) b.minuten = 0
    }

    // 4. Workshop time floor: lm × 4.5 h (Dekor) or lm × 5 h (Massivholz)
    //    Scales Zuschnitt + Zusammenbau proportionally when AI is too low.
    //    Applied before hardware-count check so both constraints stack.
    const descText = [pos.beschreibung ?? '', pos.titel ?? ''].join(' ')
    const lm = inputLm > 0 ? inputLm : parseLaufmeter(descText)
    if (lm > 0) {
      const hPerLm = massiv ? 5 : 4.5
      const minWorkshopMin = Math.round(lm * hPerLm * 60)
      const zsItem = az.find(a => a.kostenstelle === 'Zuschnitt')
      const zbItem = az.find(a => a.kostenstelle === 'Zusammenbau')
      const currentWorkshop = (zsItem?.minuten ?? 0) + (zbItem?.minuten ?? 0)
      if (currentWorkshop < minWorkshopMin) {
        const scale = minWorkshopMin / Math.max(currentWorkshop, 1)
        if (zsItem) {
          zsItem.minuten = Math.round(zsItem.minuten * scale)
        } else {
          az.push({ kostenstelle: 'Zuschnitt', minuten: Math.round(minWorkshopMin * 0.4), vkStunde: 72 })
        }
        if (zbItem) {
          zbItem.minuten = Math.round(zbItem.minuten * scale)
        } else {
          az.push({ kostenstelle: 'Zusammenbau', minuten: Math.round(minWorkshopMin * 0.6), vkStunde: 65 })
        }
      }
    }

    // 5. Zusammenbau: enforce minimum based on hardware count in description
    const hw = countHardware(descText)
    const minZusammenbau = 80             // corpus base (assemble + back panel)
      + hw.drehtüren * 20
      + hw.schiebetüren * 45
      + hw.klappen * 35
      + hw.schubladen * 30

    const zb = az.find(a => a.kostenstelle === 'Zusammenbau')
    if (zb) {
      zb.minuten = Math.max(zb.minuten, minZusammenbau)
    } else {
      az.push({ kostenstelle: 'Zusammenbau', minuten: minZusammenbau, vkStunde: 65 })
    }

    // 6. Montage: enforce minimum only when 05_01_Montage already present
    //    (absence means Selbstabholung / kein Einbau — don't add it)
    //    Prefer lm from original input; fall back to AI description.
    //    Minimum = total lm × 90 min/lfm (1.5 h/lfm, Neubau lower bound)
    const montage = az.find(a => a.kostenstelle === 'Montage')
    if (montage && lm > 0) {
      montage.minuten = Math.max(montage.minuten, Math.round(lm * 90))
    }

    // 7. Plausibility check — flags (does NOT silently alter numbers) positions
    //    whose total WORKSHOP TIME is far outside the lm-based time floor.
    //    Deliberately rate-independent: checking price/lfm here would punish
    //    users with custom (e.g. much lower) Stundensätze for a correctly low
    //    price, and previously caused the AI to inflate hours to hit an old
    //    FS-Crafted price target regardless of the configured rate (2026-07-04
    //    Vorfall). Time is what must be plausible; price is minutes × rate.
    let warnung: string | undefined
    if (lm > 0) {
      const flexKs = ['Zuschnitt', 'Zusammenbau', 'Oberfläche', 'Bekantung', 'CNC', 'Montage', 'Produktion']
      const flexMinutes = az.filter(a => flexKs.includes(a.kostenstelle)).reduce((s, a) => s + a.minuten, 0)
      const expectedMin = lm * (massiv ? 5 : 4.5) * 60

      if (flexMinutes > expectedMin * 4 || flexMinutes < expectedMin * 0.3) {
        const hours = Math.round(flexMinutes / 60)
        const expectedHours = Math.round(expectedMin / 60)
        warnung = `Werkstattzeit (${hours} h) liegt weit außerhalb des Zeitrichtwerts für ${lm.toFixed(1)} lfm ` +
          `(erwartet ca. ${expectedHours} h) — bitte manuell prüfen.`
        console.warn('[analyze] Plausibilitätswarnung:', warnung)
      }
    }

    return warnung ? { ...pos, material, arbeitszeit: az, warnung } : { ...pos, material, arbeitszeit: az }
  })

  return data
}

// ---------------------------------------------------------------------------

// 1 MB base64 ≈ 750 KB binary — bleibt gut unter Vercel-Limit und Claude-Limit
const MAX_IMAGE_B64_BYTES = 4_000_000

export async function POST(req: NextRequest) {
  try {
    // Guard: Vercel limit ist 4.5 MB body
    const contentLength = Number(req.headers.get('content-length') ?? 0)
    console.log('[analyze] content-length:', contentLength, 'bytes')
    if (contentLength > 4_000_000) {
      console.error('[analyze] request too large:', contentLength)
      return NextResponse.json({ error: 'Anfrage zu groß – bitte weniger oder kleinere Bilder verwenden.' }, { status: 413 })
    }

    let { text, imageBase64, userKostenstellen, userMaterialgruppen } = await req.json()
    const customKs = Array.isArray(userKostenstellen)
      ? (userKostenstellen as Array<{ code: string; bezeichnung: string; stundensatz: number; gruppe?: string | null }>)
      : []
    // Keyed by normalizeKsId(code), NOT k.bezeichnung and NOT raw k.code.
    // bezeichnung is free user-edited text and can diverge from the AI's
    // fixed kostenstelle vocabulary (e.g. code 03_01_Warenhandling saved
    // with bezeichnung "Warenwirtschaft" instead of "Warenhandling" —
    // confirmed via DB inspection 2026-07-04). code alone doesn't match
    // either (that was Vorfall #2). normalizeKsId(code) via LEGACY_KS_MAP
    // is the one stable mapping to the canonical name STUNDENSAETZE and the
    // AI both use.
    const customSaetze: Record<string, number> = Object.fromEntries(customKs.map(k => [normalizeKsId(k.code), k.stundensatz]))

    const matGruppen = Array.isArray(userMaterialgruppen)
      ? (userMaterialgruppen as Array<{ name: string; aufschlag_prozent: number }>)
      : []

    const rawImages: string[] = Array.isArray(imageBase64)
      ? imageBase64.filter(Boolean)
      : imageBase64
      ? [imageBase64]
      : []

    // Bilder auf max. 4 MB base64 begrenzen; zu große still überspringen
    const images = rawImages.filter(img => {
      const size = img.length
      if (size > MAX_IMAGE_B64_BYTES) {
        console.error('[analyze] image dropped — too large:', Math.round(size / 1024), 'KB')
        return false
      }
      return true
    })

    console.log('[analyze] images:', images.length, '(raw:', rawImages.length, '), text len:', text?.length ?? 0)
    if (rawImages.length > 0 && images.length === 0 && text) {
      console.log('[analyze] alle Bilder gefiltert — fahre mit Text-only fort')
    }

    if (!text && images.length === 0) {
      return NextResponse.json({ error: 'Kein Text oder Bild' }, { status: 400 })
    }

    const MAX_TEXT_CHARS = 10000
    if (text && text.length > MAX_TEXT_CHARS) {
      console.log('[analyze] text truncated from', text.length, 'to', MAX_TEXT_CHARS, 'chars')
      text = text.slice(0, MAX_TEXT_CHARS)
    }

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'Kein API Key konfiguriert' }, { status: 500 })
    }

    const userContent: object[] = []

    if (images.length > 0) {
      for (const img of images) {
        const b64 = img.startsWith('data:') ? img.split(',')[1] : img
        userContent.push({
          type: 'image',
          source: { type: 'base64', media_type: 'image/jpeg', data: b64 },
        })
      }
      userContent.push({
        type: 'text',
        text: 'Das sind Fotos der Situation vor Ort. Berücksichtige alle.\n\nBeschreibung: "' + (text ?? '') + '"',
      })
    } else {
      userContent.push({ type: 'text', text: `Beschreibung: "${text}"` })
    }

    let systemPrompt = SYSTEM_PROMPT
    if (customKs.length > 0) {
      const lines = customKs.map(k => `${normalizeKsId(k.code)} → ${k.stundensatz} €/h`)
      systemPrompt += '\n\n## ECHTE STUNDENSÄTZE DIESES NUTZERS (verbindlich, ersetzen die Beispielsätze oben):\n' + lines.join('\n')
    }
    if (matGruppen.length > 0) {
      const lines = matGruppen.map(m => `${m.name} → ${m.aufschlag_prozent}%`)
      systemPrompt += '\n\n## ECHTE MATERIALAUFSCHLÄGE DIESES NUTZERS (verbindlich, ersetzen die pauschalen 30% oben):\n' +
        lines.join('\n') + '\nOrdne jedes Material der passenden Gruppe zu und verwende deren Aufschlag als "aufschlag" (z.B. 25% → 0.25).'
    }

    const model = 'claude-sonnet-4-6'
    const reqBody = JSON.stringify({
      model,
      max_tokens: 16000, // thinking (5k) + output (8k) + puffer
      temperature: 1,    // extended thinking erfordert temperature = 1
      thinking: { type: 'enabled', budget_tokens: 5000 },
      system: systemPrompt,
      messages: [{ role: 'user', content: userContent }],
    })
    console.log('[analyze] calling Claude model:', model, '(extended thinking) — body size:', Math.round(reqBody.length / 1024), 'KB')

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'interleaved-thinking-2025-05-14',
      },
      body: reqBody,
    })

    if (!response.ok) {
      const err = await response.text()
      console.error('[analyze] Claude error:', response.status, err)
      return NextResponse.json(
        { success: false, error: `Claude ${response.status}: ${err}` },
        { status: 502 }
      )
    }

    const data = await response.json()
    // Extended thinking liefert mehrere Content-Blöcke — wir nehmen nur den text-Block
    const contentBlocks = (data as { content?: Array<{ type: string; text?: string }> }).content ?? []
    const rawText = contentBlocks.find(b => b.type === 'text')?.text ?? ''
    console.log('[analyze] Claude response — blocks:', contentBlocks.length, ', text length:', rawText.length)
    // Robuste JSON-Extraktion: findet das erste vollständige {...} Objekt auch wenn
    // die KI Freitext davor/danach schreibt oder doppelte Klammern produziert.
    function extractJson(raw: string): string {
      // 1. Backticks und Code-Fences entfernen
      let s = raw.replace(/```json|```/g, '').trim()
      // 2. Erstes { suchen
      const start = s.indexOf('{')
      if (start === -1) return s
      s = s.slice(start)
      // 3. Passendes schließendes } suchen (korrektes Bracket-Matching)
      let depth = 0
      let end = -1
      for (let i = 0; i < s.length; i++) {
        if (s[i] === '{') depth++
        else if (s[i] === '}') { depth--; if (depth === 0) { end = i; break } }
      }
      return end !== -1 ? s.slice(0, end + 1) : s
    }

    const clean = extractJson(rawText)

    try {
      const parsed = JSON.parse(clean)
      const validated = 'fragen' in parsed ? parsed : validateAndFix(parsed as Record<string, unknown>, text ?? '', customSaetze, matGruppen)
      return NextResponse.json({ success: true, data: validated })
    } catch {
      console.error('[analyze] JSON parse failed, raw:', rawText.slice(0, 300))
      return NextResponse.json(
        { success: false, error: 'JSON Parse Fehler', raw: rawText.slice(0, 300) },
        { status: 500 }
      )
    }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unbekannter Fehler'
    console.error('[analyze] unhandled error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
