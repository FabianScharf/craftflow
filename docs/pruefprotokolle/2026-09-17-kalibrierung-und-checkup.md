# Prüfprotokoll 17.09.2026 — Betriebskalibrierung, Einstellungs-Extreme, Gesamt-Checkup

Auftrag (Fabian, 16.09. abends): „Kostenstellen extrem verändern, den Preisfaktor extrem
verändern, die Zeitfaktoren extrem verändern. Teste die Referenzprojekte mit diesen
Werten und prüfe, ob die Ergebnisse logisch und korrekt sind. Anschließend ein vollständiger
Checkup aller Funktionen. Es dürfen keine einfachen Fehler mehr in der App sein.“

Alle Läufe auf der dev-Vorschau (`craftflow-git-dev-…vercel.app`) mit dem Testkonto
test@fscrafted.de (Testphase = Enterprise). Skripte unter `.tmp-cu/` (nicht im Repo),
Rohdaten unter `/tmp/lvtest/*.json`, Screenshots unter `/tmp/cfshots/check-*.png`.

## 1. Methode

### 1.1 Grundlinie: die fünf Referenzmöbel durch CraftFlow
Jede Referenz aus `src/lib/kalibrierung.ts` (`REFERENZEN`) wurde mit Kundenzeile
(„Familie Muster, Musterstraße 12, 63517 Rodenbach“) als echtes Projekt an `POST /api/analyze`
geschickt — Grundtext sowie die Varianten Lack, Massiv und Altbau-Montage als
*umgeschriebener* Text (nicht als „Abweichung“, sonst legt die KI Alternativpositionen an).
Einstellungen des Testkontos beim Lauf: Standard-Stundensätze der Handwerkskammer
(identisch mit `STANDARDSAETZE`), Materialaufschlag 30 %, Zeitfaktor Werkstatt **1,08**
(alte Antwort des Testkontos), übrige Zeitfaktoren 1,0, Preisfaktor **1,04**. Beide
Abweichungen werden in der Auswertung herausgerechnet (Werkstattminuten ÷ 1,08, Netto ÷ 1,04).

**Erster Befund vor jeder Zahl:** Ohne Kundenzeile stellt CraftFlow bei 16 von 17 Texten
Rückfragen („Wie lautet die Lieferadresse?“) und rechnet nicht. Die heutigen Referenztexte
sind also keine vollständigen Projektbeschreibungen.

### 1.2 Extreme Einstellungen — live am Einbauschrank
Sieben Läufe (`basis`, Stundensätze ×0,5 und ×2, Preisfaktor 0,5 und 3,0, alle Zeitfaktoren
0,5 und 3,0). Vor jedem Lauf sichert das Skript den Ist-Zustand, setzt die Variante über die
Einstellungs-Schnittstellen, rechnet, stellt alles wieder her und prüft, dass Ist = Vorher.

### 1.3 Extreme Einstellungen — alle Möbel, deterministisch
Stundensätze, Zeitfaktoren und Preisfaktor wirken erst NACH der KI (`validateAndFix` →
`wendeFaktorenAn` → `calcAngebotspos`). Deshalb werden alle 17 Grundlinien-Kalkulationen mit
denselben reinen Funktionen (`src/lib/zeitfaktoren.ts`, `src/lib/types.ts`) nachgerechnet.
Die Live-Läufe aus 1.2 sind die Gegenprobe, dass die Nachrechnung dem Server entspricht.

### 1.4 Erwartungen (vorab festgelegt)
| Variante | Erwartung |
|---|---|
| Stundensätze ×2 | Arbeitskosten ×2, Material unverändert, Stunden unverändert |
| Stundensätze ×0,5 | Arbeitskosten ×0,5, Material unverändert |
| Preisfaktor 3,0 / 0,5 | Netto ×3 / ×0,5, Stunden und Material unverändert |
| Zeitfaktoren alle 3,0 | Zuschnitt/Bekantung/Zusammenbau/…, Oberfläche, Montage/Lieferung ×3; Besprechung/Planung/Konstruktion/Arbeitsvorbereitung **unverändert** |
| Zeitfaktoren alle 0,5 | dito ×0,5 |
| nur Montage 0,5 | nur Montage + Lieferung halbiert |
| nur Werkstatt 3,0 | nur Werkstatt-Kostenstellen verdreifacht |

### 1.5 Gesamt-Checkup
Drei unabhängige Code-Prüfungen (Plan-Sperren, Farben/Lesbarkeit, Schnittstellen und
Fehlerbehandlung) plus ein automatisierter Rundgang über alle 17 Einstellungsbereiche und die
App-Bildschirme (Start, Projekte, Kunde/Kalkulation/Angebot, Hilfe) in zwei Farbwelten
(dunkel #0D0D0D/#C8885A, hell #FFFFFF/#813732) mit Erfassung von Konsolenfehlern,
Seitenfehlern, fehlgeschlagenen Anfragen und „undefined/NaN“ im Seitentext.

## 2. Ergebnisse

### 2.1 Grundlinie: was CraftFlow aus den fünf Referenztexten macht

_Netto ohne Preisfaktor (÷ 1,04), Werkstattstunden ohne den alten Testkonto-Faktor (÷ 1,08). Stunden je Position, ohne Stückzahl-Regel. Referenz = `referenzPreis()` mit Standardsätzen._

| Lauf | Positionen | Netto CraftFlow | Material | Fix h | Werkstatt h | Oberfl. h | Montage h | Referenz Netto | Referenz Material |
|---|---|---|---|---|---|---|---|---|---|
| einbauschrank:grund | 1 | 2508 € | 796 € | 3.5 | 15.2 | 0 | 5.5 | 2245 € | 532 € |
| einbauschrank:lack | 3 | 2583 € | 537 € | 5.8 | 17.6 | 0 | 5.3 | 2245 € | 532 € |
| einbauschrank:massiv | 2 | 6082 € | 2728 € | 9.7 | 21.4 | 10.6 | 5 | 2245 € | 532 € |
| einbauschrank:montage | 1 | 2670 € | 697 € | 3.8 | 15.5 | 0 | 8.8 | 2245 € | 532 € |
| kueche:grund | 7 | 8856 € | 980 € | 13 | 56 | 0 | 12.8 | 10073 € | 4501 € |
| kueche:lack | 6 | 6875 € | 1230 € | 13 | 53 | 0 | 12.4 | 10073 € | 4501 € |
| kueche:massiv | 7 | 10982 € | 2199 € | 13.2 | 68.5 | 6.2 | 13.1 | 10073 € | 4501 € |
| kueche:montage | 7 | 12265 € | 1280 € | 14.8 | 113.8 | 0 | 22.4 | 10073 € | 4501 € |
| tueren:grund | 1 | 2641 € | 1291 € | 2.2 | 1.5 | 0 | 2.7 | 2855 € | 1595 € |
| tueren:lack | 1 | 2791 € | 1456 € | 1.8 | 1.5 | 0 | 2.7 | 2855 € | 1595 € |
| tueren:massiv | 1 | 5529 € | 3163 € | 2 | 2.7 | 2 | 3.1 | 2855 € | 1595 € |
| treppen:grund | 2 | 7058 € | 4846 € | 4.4 | 6.4 | 5.7 | 15.5 | 4975 € | 2750 € |
| treppen:lack | 1 | 5950 € | 4232 € | 3.5 | 3.3 | 3 | 15.5 | 4975 € | 2750 € |
| treppen:montage | 2 | 8423 € | 5301 € | 6.4 | 3.2 | 5.1 | 31.5 | 4975 € | 2750 € |
| solitaer:grund | 1 | 1438 € | 677 € | 2.1 | 5.1 | 2.7 | 0.5 | 3069 € | 1050 € |
| solitaer:lack | 1 | 1250 € | 552 € | 2 | 5 | 1.8 | 0.8 | 3069 € | 1050 € |
| solitaer:montage | 1 | 1309 € | 450 € | 2.3 | 5 | 3.2 | 1.5 | 3069 € | 1050 € |


**Befunde aus der Grundlinie:**

1. **Ohne Kundenzeile rechnet CraftFlow nicht.** 16 von 17 Texten ergaben nur die Rückfrage „Wie lautet die Lieferadresse des Kunden?“. Die Referenztexte müssen vollständige Projektbeschreibungen sein (Kunde, Ort, Umfang) — genau Fabians Forderung.
2. **Küche: Material 980 € statt 4.500 €.** Die KI legte die Dekor-Fronten als „Lackierung (Zukauf) — Quadratmeterpreis eintragen, 0 €“ an (die Lackierkabinen-Regel griff, obwohl die Fronten Dekor sind) und die Arbeitsplatte ebenfalls mit 0 € („Material nach Kundenwahl“). Zwei Nullpositionen, die im Angebot stumm fehlen. Zusätzlich landeten 39 Werkstattstunden auf der Position Arbeitsplatte (Zuschnitt 1.468 min) — unplausibel.
3. **Massivholztisch: 5,1 h Werkstatt statt ~22 h.** Log: „Zeiten gekappt (Stückliste): Werkstattzeit von 14,4 h auf 4,4 h gekappt.“ Der Stücklisten-Deckel (`kappeOhneLaufmeter`, geeicht an Plattenmöbeln) kappt einen Eichentisch auf ein Viertel. Ergebnis 1.438 € netto für einen 200 × 90 Massivholztisch — weit unter der Faustregel 2.000–4.500 €. **Echter Rechenfehler, wird behoben** (Stücklisten-Deckel gilt nicht für Massivholzstücke).
4. **Treppe: Material 4.846 € statt 2.750 €** — die KI setzt die Rohtreppe mit 2.800 € + Geländer 750 € an. Fachlich vertretbar; der Referenz-Materialanteil (55 %) ist eher zu niedrig.
5. **Varianten schwanken mit der KI:** Lack-Variante der Küche (6.875 €) und des Tisches (1.250 €) liegen UNTER dem Grundtext; die Altbau-Variante der Küche verdoppelt die Werkstattzeit (113 h), obwohl sich nur die Montage ändern dürfte. Folgerung: Die Referenzkalkulation und ihre Varianten müssen eine **feste, gepflegte Positionsliste** sein, keine KI-Läufe (siehe Design-Entwurf `docs/superpowers/specs/2026-09-17-betriebskalibrierung-neu-design.md`).
6. Einbauschrank (die gemessene Referenz): 2.508 € gegen 2.245 € Referenz, Stunden 24,2 h gegen 23,8 h — die Abweichung kommt aus dem Material (796 € statt 532 €; darunter zwei Eichen-Massivholzladen à 60 € aus der Preisliste des Testkontos).

### 2.2 Extreme Einstellungen — deterministische Nachrechnung (alle 17 Läufe × 8 Varianten)

| Lauf | basis | saetze_halb | saetze_doppelt | preisfaktor_05 | preisfaktor_3 | zeit_05 | zeit_3 | nur_montage_05 | nur_werkstatt_3 |
|---|---|---|---|---|---|---|---|---|---|
| einbauschrank:grund | 2428 € / 24.2 h | 1612 € / 24.2 h | 4061 € / 24.2 h | 1214 € / 24.2 h | 7285 € / 24.2 h | 1744 € / 13.9 h | 5168 € / 65.7 h | 2250 € / 21.5 h | 4453 € / 54.7 h |
| einbauschrank:lack | 2491 € / 28.8 h | 1514 € / 28.8 h | 4446 € / 28.8 h | 1246 € / 28.8 h | 7474 € / 28.8 h | 1736 € / 17.3 h | 5517 € / 74.6 h | 2321 € / 26.1 h | 4835 € / 64.1 h |
| einbauschrank:massiv | 5968 € / 46.7 h | 4348 € / 46.7 h | 9208 € / 46.7 h | 2984 € / 46.7 h | 17905 € / 46.7 h | 4167 € / 20.2 h | 24111 € / 312.5 h | 5806 € / 44.2 h | 8815 € / 89.4 h |
| einbauschrank:montage | 2588 € / 28.1 h | 1643 € / 28.1 h | 4479 € / 28.1 h | 1294 € / 28.1 h | 7764 € / 28.1 h | 1784 € / 15.9 h | 5802 € / 76.9 h | 2301 € / 23.7 h | 4654 € / 59.2 h |
| kueche:grund | 8412 € / 108.6 h | 4696 € / 108.6 h | 15843 € / 108.6 h | 4206 € / 108.6 h | 25235 € / 108.6 h | 5205 € / 61.1 h | 21304 € / 299.9 h | 7998 € / 102.3 h | 19647 € / 274.4 h |
| kueche:lack | 6592 € / 78.4 h | 3911 € / 78.4 h | 11954 € / 78.4 h | 3296 € / 78.4 h | 19776 € / 78.4 h | 4407 € / 45.8 h | 15343 € / 209.2 h | 6191 € / 72.2 h | 13738 € / 184.5 h |
| kueche:massiv | 10499 € / 121.4 h | 6349 € / 121.4 h | 18800 € / 121.4 h | 5250 € / 121.4 h | 31498 € / 121.4 h | 5242 € / 43.6 h | 63841 € / 908.3 h | 10074 € / 114.8 h | 22516 € / 299.1 h |
| kueche:montage | 11643 € / 151 h | 6461 € / 151 h | 22006 € / 151 h | 5821 € / 151 h | 34928 € / 151 h | 7023 € / 82.9 h | 30141 € / 423.4 h | 10915 € / 139.8 h | 27229 € / 378.6 h |
| tueren:grund | 2612 € / 20 h | 1951 € / 20 h | 3932 € / 20 h | 1306 € / 20 h | 7835 € / 20 h | 2031 € / 11.1 h | 4935 € / 55.8 h | 2217 € / 14 h | 3355 € / 31.5 h |
| tueren:lack | 2761 € / 19.8 h | 2109 € / 19.8 h | 4066 € / 19.8 h | 1381 € / 19.8 h | 8284 € / 19.8 h | 2177 € / 10.8 h | 5107 € / 55.9 h | 2371 € / 13.8 h | 3547 € / 31.9 h |
| tueren:massiv | 5478 € / 34.3 h | 4321 € / 34.3 h | 7793 € / 34.3 h | 2739 € / 34.3 h | 16434 € / 34.3 h | 4086 € / 13.7 h | 17363 € / 209.4 h | 5025 € / 27.4 h | 6873 € / 55.5 h |
| treppen:grund | 7024 € / 32 h | 5935 € / 32 h | 9201 € / 32 h | 3512 € / 32 h | 21071 € / 32 h | 6103 € / 18.2 h | 10710 € / 87.1 h | 6520 € / 24.2 h | 7879 € / 44.8 h |
| treppen:lack | 5933 € / 25.3 h | 5082 € / 25.3 h | 7635 € / 25.3 h | 2967 € / 25.3 h | 17799 € / 25.3 h | 5214 € / 14.4 h | 8811 € / 69 h | 5429 € / 17.6 h | 6364 € / 32 h |
| treppen:montage | 8406 € / 46.2 h | 6854 € / 46.2 h | 11511 € / 46.2 h | 4203 € / 46.2 h | 25219 € / 46.2 h | 7096 € / 26.3 h | 13652 € / 125.8 h | 7384 € / 30.5 h | 8818 € / 52.6 h |
| solitaer:grund | 1410 € / 10.4 h | 1044 € / 10.4 h | 2143 € / 10.4 h | 705 € / 10.4 h | 4231 € / 10.4 h | 1124 € / 6.2 h | 2562 € / 26.9 h | 1394 € / 10.1 h | 2113 € / 20.6 h |
| solitaer:lack | 1223 € / 9.6 h | 887 € / 9.6 h | 1893 € / 9.6 h | 611 € / 9.6 h | 3668 € / 9.6 h | 966 € / 5.8 h | 2259 € / 24.8 h | 1199 € / 9.2 h | 1897 € / 19.6 h |
| solitaer:montage | 1282 € / 12 h | 866 € / 12 h | 2114 € / 12 h | 641 € / 12 h | 3847 € / 12 h | 953 € / 7.1 h | 2608 € / 31.4 h | 1235 € / 11.2 h | 1957 € / 22 h |


**Ergebnis: 136 von 136 Prüfungen entsprechen der Erwartung** (Toleranz 1–2 %). Stundensätze ändern nur Arbeitskosten, der Preisfaktor nur das Netto, die Zeitfaktoren nur die jeweilige Kostenstellengruppe; Besprechung/Planung/Konstruktion/Arbeitsvorbereitung bleiben unter allen Zeitfaktoren unverändert. Der Massivholzfaktor wirkt bei Massivholz-Läufen zusätzlich auf Werkstatt und Oberfläche (Faktor 3 × 3 = 9 auf diese Gruppen — so gewollt, aber ein Hinweis in der UI fehlt).

### 2.3 Extreme Einstellungen — live am Einbauschrank

| Variante | Netto | Material | Arbeit (Netto ÷ Preisfaktor − Material) | Std gesamt | Fix min | Werkstatt min | Montage min | Preisfaktor auf Position | Einstellungen danach = vorher |
|---|---|---|---|---|---|---|---|---|---|
| Basis (Testkonto: Werkstatt 1,08, Preisfaktor 1,04) | 2348 € | 649 € | 1609 € | 23.9 | 170 | 974 | 290 | 1.04 | ja |
| Alle Stundensätze × 0,5 | 2082 € | 692 € | 1310 € | 33.5 | 125 | 1555 | 330 | 1.04 | ja |
| Alle Stundensätze × 2 | 5399 € | 660 € | 4531 € | 36.2 | 155 | 1686 | 330 | 1.04 | ja |
| Preisfaktor 0,5 | 1627 € | 689 € | 2565 € | 37.8 | 310 | 1642 | 315 | 0.5 | ja |
| Preisfaktor 3,0 | 9475 € | 675 € | 2483 € | 36.6 | 265 | 1633 | 300 | 3 | ja |
| Alle Zeitfaktoren 0,5 | 1909 € | 734 € | 1102 € | 16.1 | 265 | 534 | 165 | 1.04 | ja |
| Alle Zeitfaktoren 3,0 | 5171 € | 529 € | 4443 € | 66.7 | 185 | 2826 | 990 | 1.04 | ja |

**Lesart:** Jeder Lauf ist ein eigener KI-Aufruf; die Rohminuten schwanken deshalb zwischen den Läufen (Werkstatt roh 900–1.600 min für denselben Text — siehe Befund KI-Streuung). Entscheidend ist, was die Einstellung *mit* den Rohminuten macht:
- **Stundensätze × 0,5 / × 2:** Die Sätze je Kostenstelle im Ergebnis sind exakt halbiert bzw. verdoppelt (z. B. Planung 42,50 / 85 / 170 €), Material unverändert. **Wichtig:** Stundensätze erreichen die Kalkulation nur über die vom Browser mitgeschickten Kostenstellen (`userKostenstellen` im Request) — ein Aufruf ohne diese Liste rechnet mit den Standardsätzen. Das ist so gebaut (die App schickt sie immer), muss aber jeder wissen, der die Schnittstelle direkt nutzt.
- **Preisfaktor 0,5 / 3,0:** auf jeder Position gestempelt, Netto = (Material + Arbeit) × Faktor, Stunden unverändert.
- **Zeitfaktoren 0,5 / 3,0:** Werkstatt- und Montageminuten skalieren mit dem Faktor (Werkstatt 534 bzw. 2.826 min gegenüber ~1.000 roh; Montage 165 bzw. 990 gegenüber ~330), Besprechung/Planung/Konstruktion/Arbeitsvorbereitung bleiben in der Größenordnung der Rohwerte (170–265 min, nur KI-Streuung).
- Nach jedem Lauf wurden Sätze, Faktoren und Preisfaktor zurückgesetzt und gegengeprüft (letzte Spalte).


## 3. Gesamt-Checkup aller Funktionen

### 3.1 Drei unabhängige Code-Prüfungen (Nacht 16./17.09.)

| Prüfung | Ergebnis | Behoben in |
|---|---|---|
| Plan-Sperren (Client ↔ Server ↔ Matrix ↔ Website) | 1 kritisch: Jeder Nutzer konnte sein Plan-Feld per Profil-Schnittstelle selbst setzen (Selbst-Upgrade). 11 wichtig: fehlende Server-Sperren (GAEB-Export, SMTP-Test, fünf Lieferanten-Routen, Textbausteine, PDF-Gestaltung), Gutschein nach Kündigung blieb gesperrt, Plan-Kacheln nach rohem Plan, Stripe-Preis-ID ungeprüft, Dateien-Deckel lehnte statt zu kappen, DB-Aussetzer warf in die Paywall. | Fix-Welle A (Commits 09ad1a7 … 8089104), SQL `2026-09-17-gutschein-abo-status.sql` ausgeführt |
| Schnittstellen und Fehlerbehandlung | 3 kritisch: Reservierung bei Netzfehler nicht freigegeben; Briefpapier-URL aus dem Request serverseitig geladen (SSRF); Selbst-Upgrade (s. o.). Wichtig: Tracking ohne Nutzerfilter, fetch-Aufrufe ohne Fehlerprüfung (Projektliste, Mikrofon). | Fix-Welle A |
| Farben und Lesbarkeit | Kritisch: kein Kontrastschutz zwischen Akzent- und Primärfarbe (Knopfschrift = Primärfarbe auf Akzent, ~45 Stellen); harte Farbwerte in Kopfzeile und Mikrofon-Knöpfen; fünf ungültige Transparenz-Angaben an CSS-Variablen (Rahmen fällt weg); Statusfarben im Hell-Design ohne Kontrastprüfung. | Fix-Welle B |

### 3.2 Automatisierter Rundgang (50 Prüfpunkte, zwei Farbwelten)
0 Konsolenfehler, 0 Seitenfehler, 0 fehlgeschlagene Anfragen, kein „undefined/NaN“ im Seitentext.
Screenshot-Sichtung (44 Bilder): Projektname in der Kopfzeile im Hell-Design kaum lesbar (harter
Farbwert, behoben in Welle B). Mehrere Bereiche erschienen in den Screenshots leer bzw. „Lädt …“ —
**Ursache war das Prüfskript**, nicht die App: Der Ganzseiten-Screenshot verändert kurz die
Fenstergröße, und die Bereiche bauten sich danach neu auf. Ohne Ganzseiten-Screenshot laden alle
34 Bereiche (dunkel + hell) in 1–3 s; einzeln nachgemessen: Textbausteine 1,0–1,5 s, Wünsche 2,5 s.
Trotzdem verbessert (Welle B): Die Plan-Schranke zeigt jetzt „Lädt …“ statt einer leeren Fläche und
gibt nach 10 s frei, falls der Plan nicht ladbar ist (der Server sperrt bezahlte Aktionen ohnehin).

Nachtest nach Welle B (Vorschau c8fb803): dritter Rundgang 50 Prüfpunkte — 0 Konsolenfehler,
0 fehlgeschlagene Anfragen; Küchen-Referenz erneut gerechnet: **keine Nullpreise mehr**, Fronten
als Dekor-Material (16 €/m²), Arbeitsplatte Schichtstoff 55 €/lfm, Material 1.995 € (vorher 980 €),
Netto 8.564 €, 96 h. Die Lackregel griff nicht mehr auf Dekor-Fronten.

### 3.3 Aus den Referenzläufen behoben
- Stücklisten-Deckel kappt keine Massivholzstücke mehr (Tisch 14,4 h → 4,4 h war falsch).
- Lackregel gilt nur für vom Betrieb lackierte Flächen (Dekor/CPL/Folie sind Material mit Preis).
- Nullpreis-Platzhalter („Quadratmeterpreis eintragen“) werden als Warnung an der Position sichtbar.

### 3.4 Offene Produktentscheidungen (nicht ohne Fabian änderbar)
1. Lieferanten-Anfrage-Entwürfe laufen über EIN zentrales Gmail-Konto für alle Betriebe — Kundendaten aller Nutzer landen in diesem Postfach. Abschalten oder je Betrieb über dessen SMTP.
2. SMTP-Passwörter liegen im Klartext (Spalte heißt „encrypted“, ist es aber nicht). Braucht einen Server-Schlüssel und eine Migration.
3. „Ausschreibungs-Modus“ und der Nutzer-Deckel (1/1/3/unbegrenzt) werden auf Website und Plan-Kacheln beworben, sind aber nicht gebaut/durchgesetzt.
4. Gutscheine ohne Ablaufdatum gewähren den Plan unbegrenzt.
5. E-Mail-Bereich: Matrix sagt „Versand ab Starter, SMTP ab Pro“ — so ist es jetzt gebaut (Bereich ab Starter sichtbar, SMTP-Teil ab Pro). Bitte bestätigen.
6. Referenzpreise der Kalibrierung (vor allem Küche) — deine Zahl als Meister, siehe Design-Entwurf.
7. KI-Streuung: derselbe Text ergibt zwischen zwei Läufen 24 h oder 38 h. Die Referenzkalkulation muss deshalb eine feste Positionsliste sein (Entwurf); für normale Angebote ist das die bekannte Unschärfe der KI.

## 4. Stand am Morgen des 17.09.

- App `dev` bis `c8fb803`, Website `dev` bis `5c81d94`, nichts auf `main`.
- Tests 430/430, Typprüfung sauber, keine neuen Lint-Fehler.
- Testkonto test@fscrafted.de: Farben wie von Fabian gesetzt (#E9CDCD / #820D1B), Stundensätze
  Standard, Zeitfaktor Werkstatt 1,08, Preisfaktor 1,04, eine Stimme auf dem Wunsch — alles wie vor
  der Nacht; alle Test-Umschaltungen wurden zurückgesetzt und gegengeprüft.
- KI-Kosten der Nacht: 17 Referenzläufe + 9 Live-Varianten + 1 Nachtest ≈ 27 Aufrufe ≈ 3–4 $.
