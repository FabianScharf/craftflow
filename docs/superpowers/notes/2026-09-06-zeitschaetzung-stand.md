# Zeitschätzung geraderücken — Arbeitsstand

**Stand:** in der Nacht auf 2026-09-07 · **Branch:** `dev` · **`main`:** unberührt

Vorgezogen vor die Betriebskalibrierung
(`docs/superpowers/specs/2026-09-06-betriebskalibrierung-design.md`), auf Fabians
Entscheidung: Der Schätzfehler trifft alle Nutzer gleichermaßen, auch die, die nie ein
Onboarding ausfüllen. Die Kalibrierung soll die Spreizung *zwischen* Betrieben
abbilden — nicht einen Fehler ausbügeln, der allen gemeinsam ist.

## Der Befund

Referenzschrank, gemessen auf der dev-Vorschau: Einbauschrank Flur, 2,00 × 2,40 ×
0,60 m, Egger Dekor weiß, 4 Drehtüren, 2 Schubkästen, Kleiderstange, Sockel, Montage
im Neubau.

| | Pflichtrechnung im Prompt | CraftFlow |
|---|---|---|
| Zuschnitt + Zusammenbau | 2 lfm × 4,5 h = 540 min, plus Beschläge ≈ **690 min** | **1.350 min** |
| Gesamtstunden | — | **36,3 h** |
| Netto | — | **3.042 €** |

Fabians Faustregel für 2 lfm Einbauschrank inklusive Montage: 1.200–2.000 €.
CraftFlow lag **50 % über der oberen Grenze**.

**Die Ursache:** Die Selbstprüfungs-Checkliste im Prompt nannte ausschließlich
Untergrenzen — „Zuschnitt + Zusammenbau gesamt: **mind.** lfm × 270 min". Der KI wurde
gesagt, wie wenig es sein darf, nie wie viel es höchstens sein darf. Sie schoss auf
der sicheren Seite über und erfüllte die Prüfliste dabei mühelos.

**Warum es nie auffiel:** Die eingebaute Plausibilitätsprüfung (`analyze/route.ts`)
- schlug erst beim **Vierfachen** an,
- korrigierte auch dann nichts (Kommentar: „does NOT silently alter numbers"),
- verglich Werkstatt **plus** Montage gegen einen reinen Werkstatt-Richtwert und war
  dadurch von sich aus zu großzügig,
- und prüfte ohne Laufmeter (`if (lm > 0)`) überhaupt nicht.

## Was gebaut ist

| Was | Wo |
|---|---|
| Obergrenzen in der Pflichtrechnung, ausdrücklich „VERBINDLICH, keine Untergrenze" | Prompt in `analyze/route.ts` |
| Checkliste nennt **Bänder** statt Mindestwerte, für Werkstatt und Montage | ebenda |
| `kappeZeiten()` — deckelt anteilig nach der KI-Antwort | `src/lib/zeitpruefung.ts` |
| Montage raus aus dem Zähler der Plausibilitätsprüfung, Schwelle 4× → 2× | `analyze/route.ts` |

Die Deckelung greift **deterministisch nach** der KI-Antwort, an derselben Stelle, an
der schon `vkStunde` und `aufschlag` überschrieben werden. Gürtel und Hosenträger:
Der Prompt sagt es, die Engine setzt es durch.

Gedeckelt wird **anteilig** — die Aufteilung, die die KI zwischen Zuschnitt und
Zusammenbau gewählt hat, bleibt erhalten, nur die Summe stimmt wieder.

Grenzen: Zuschnitt + Zusammenbau höchstens 1,5 × Basis (Dekor) bzw. 2,0 × Basis
(Massivholz, wegen Holzart-Faktor bis ×1,4 und Verleimen). Montage höchstens
2,5 h/lfm (Neubau) bzw. 4,0 h/lfm (Altbau, per Regex im Text erkannt).

Verifikation: 105 Tests grün, `npx tsc --noEmit` sauber. Die vier eslint-Meldungen in
`analyze/route.ts` sind Bestand (vorher Zeile 753, jetzt 774, `prefer-const` auf einer
Destrukturierung, die ich nicht angefasst habe).

## OFFEN — die Frage an Fabian

**Möbel ohne Laufmeter werden weiterhin nicht geprüft.** Ein Rollcontainer, ein Tisch,
ein Sideboard haben keine sinnvollen Laufmeter; `lm` ist dort 0 und die Deckelung
greift nicht. Genau dieser Fall lief heute Vormittag mit 8,8 h durch.

Eine Faustformel dafür wurde bewusst **nicht** im Alleingang erfunden. Drei Wege
stehen zur Wahl:

1. **Nach Stückliste** *(fachlich am saubersten)*. Fabians Zeitrichtwerte sind ohnehin
   pro Stück formuliert: Korpus 30–60 min, Systemschubkasten 20–35 min, Drehtür
   15–25 min. Der Prompt rechnet bereits so („jede Tür +20 min, Schublade +30 min").
   Wenn die KI die Stückzahlen zusätzlich als Zahlenfelder ausgibt, kann die Engine
   die Erwartung daraus bilden — und zwar für **jedes** Möbel, mit oder ohne
   Laufmeter. Kostet eine Erweiterung des Antwortformats.
2. **Nach Plattenfläche.** Aus dem Material ist die m²-Zahl bekannt. Grobe Formel
   „Grundzeit + x min/m²". Schnell gebaut, ignoriert aber die Ausstattung — drei
   Schubladen einzubauen ist echte Zeit, die in keiner Plattenfläche steckt.
3. **Vorerst nur warnen**, nicht kappen, und die Fälle sammeln, bis genug Datenpunkte
   für eine belastbare Formel da sind.

Empfehlung: **Weg 1**, weil er die Wissensbasis nutzt, die ohnehin im Produkt steckt,
und weil er den lfm-Weg langfristig ablösen könnte statt ihn zu ergänzen.

## Noch nicht angefasst

- `analyze/route.ts:623` löscht die Arbeit abgeschalteter Kostenstellen weiterhin
  **ersatzlos**, statt sie zur Handarbeit umzubuchen. Steht im Kalibrierungs-Entwurf,
  Abschnitt 6.
- Die Vermischung von Netto- und Bruttozeit (Kammersatz auf produktive Stunden,
  Schätzung auf Bruttozeit). Die Deckelung entschärft das der Größenordnung nach,
  löst es aber nicht sauber.
- `optimize` hat gar keine Zeitprüfung. Wer im Chat Änderungen machen lässt, kann die
  Deckelung damit umgehen.
