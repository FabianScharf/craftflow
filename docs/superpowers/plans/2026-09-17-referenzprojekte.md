# Referenzprojekte in der Betriebskalibrierung — Umsetzungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Die fünf Referenzmöbel der Kalibrierung werden zu fünf vollständigen CraftFlow-Projekten (Positionen mit Material und Arbeitszeit, Varianten als Alternativpositionen), aus denen Ankerpreis, Antwortspannen und Faktoren abgeleitet werden; die Seite „Mein Betrieb“ zeigt die Kalkulation Zeile für Zeile und kann sie als Projekt öffnen.

**Architecture:** Neues importfreies Datenmodul `src/lib/referenzprojekte.ts` (fünf Projekte im `Angebotsposition`-Format, Sätze/Aufschlag als Platzhalter, Faustregel-Band je Projekt). Eine Ableitung `referenzAusProjekt()` baut daraus das heutige `Referenzmoebel` (Bandbasis), sodass `berechneFaktoren`, `referenzPreis` und `skala` **unverändert** weiterlaufen — `REFERENZEN` wird aus den Projekten erzeugt statt aus `SPECS`. Die Route liefert das mit den Sätzen des Betriebs gerechnete Projekt, die UI rendert es und ruft „Als Projekt öffnen“ auf.

**Tech Stack:** Next.js App Router, TypeScript, Supabase, Node-Tests (`npm run test`, `.ts`-Importe zwischen lib-Modulen).

**Spec:** `docs/superpowers/specs/2026-09-17-betriebskalibrierung-neu-design.md` (Abschnitte 3–5 sind bindend; Abschnitt 4 „Woher die Zahlen kommen“ beschreibt den Aufbau von unten).

## Global Constraints

- `src/lib`-Module importieren nur andere `src/lib`-Module mit `.ts`-Endung (kein React, kein Supabase) — sonst läuft `npm run test` nicht.
- Deutsche UI-Texte und Kommentare; Farben nur über `C.*` aus `@/lib/types`, Knopfschrift auf Akzent = `C.onAccent`.
- Kein KI-Aufruf beim Anzeigen der Referenz. Kein Preis wird aus einer Faustregel gesetzt — die Faustregel ist nur Kontrolle.
- Bestehende Tests bleiben grün oder werden bewusst auf die neuen Zahlen umgestellt (mit Kommentar warum). `npx tsc --noEmit -p tsconfig.json | grep -v "^.next/"` leer. Keine neuen ESLint-Fehler in `src`.
- Nichts pushen; keine DB-Änderungen.

---

### Task R1: Datenmodul `referenzprojekte.ts` — fünf Projekte von unten aufgebaut

**Files:**
- Create: `src/lib/referenzprojekte.ts`
- Test: `tests/referenzprojekte.test.mjs`

**Interfaces (Produces):**
```ts
export type Variante = 'lack' | 'massiv' | 'montage'
export type ReferenzPosition = Angebotsposition & { variante?: Variante }   // alternativ:true genau dann, wenn variante gesetzt
export type Referenzprojekt = {
  schluessel: 'einbauschrank' | 'kueche' | 'tueren' | 'treppen' | 'solitaer'
  name: string                       // „Einbauküche“
  kunde: { name: string; strasse: string; ort: string; projekt: string }
  text: string                       // der ausführliche Referenztext aus Spec 3.x (wörtlich)
  positionen: ReferenzPosition[]     // Grundpositionen + je Variante EINE Alternativposition (stueckzahl, material, arbeitszeit)
  faustregel: { von: number; bis: number; quelle: string }   // CLAUDE.md 6.1, netto, für die Grundsumme
  fragen: Partial<Record<'grund' | Variante, string>>        // Fragetexte wie in Spec 5 / heutigem SPECS
  fragenHinweis?: Partial<Record<'grund' | Variante, string>>
  ohneMaterial?: Array<'grund' | 'massiv'>                    // Türen, Treppe wie heute
  teiler?: Partial<Record<'grund' | Variante, number>>        // Türen: 5
}
export const REFERENZPROJEKTE: Record<Referenzprojekt['schluessel'], Referenzprojekt>
export const STANDARDSAETZE_REFERENZ: Record<string, number>   // = STANDARDSAETZE aus kalibrierung.ts, hier wiederholt (importfrei)
export function mitSaetzen(p: Referenzprojekt, saetze: Record<string, number>, aufschlag: number): ReferenzPosition[]
  // Kopie der Positionen mit vkStunde = saetze[kostenstelle] (Fallback: Platzhalter) und material.aufschlag = aufschlag*100? → prüfen, wie `aufschlag` in MaterialPosten skaliert ist (calcAngebotspos lesen!) und exakt so setzen
export function summen(pos: ReferenzPosition[], nurGrund = true): { netto: number; material: number; arbeit: number; stunden: number }
export function faustregelKontrolle(netto: number, f: Referenzprojekt['faustregel']): { imRahmen: boolean; text: string }
  // „Faustregel 1.800–2.600 € — liegt im Rahmen.“ / „… liegt darunter/darüber: prüfe Materialansatz, Stundensätze, Zeitrichtwerte.“
```

**Inhalt der fünf Projekte (bindend, Zahlen aus CLAUDE.md, mit Kommentar je Zeile, woher der Wert kommt):**

1. **Einbauschrank** — Grundposition exakt aus der gemessenen Referenz `REFERENZ` in `src/lib/kalibrierung.ts` (Material-EK 409,50 € aufgeteilt in Zeilen: Dekorspanplatte 19 mm ~16 m² à 14 €, Rückwand 8 mm ~5 m² à 8 €, ABS-Kante ~58 lfm à 1,20 €, 8 Topfscharniere à 2,50 €, 2 Systemauszüge à 26 €, Kleiderstange, Bodenträger, Griffe, Kleinmaterial — Summe muss 409,50 € ± 1 € treffen; Minuten exakt: Fixsockel 20/30/60/45, Zuschnitt 216, Bekantung 190, Zusammenbau 479, Warenhandling 20, Produktion 30, Verpacken 30, Montage 240, Lieferung 70). Alternativen: **Lack** (+600 min Oberfläche, +60 € Lackmaterial, Bekantung 0), **Massiv** (Material-EK 1.770 €, Werkstatt ×1,3, +300 min Oberfläche Ölen, Bekantung 0), **Altbau-Montage** (Montage ×1,6 = 384 min, Lieferung gleich). Faustregel 1.800–2.600 € (CLAUDE.md: ~1.000 €/lfm ohne Montage + Montage 20–30 %).
2. **Einbauküche** — Positionen: Unterschränke Drehtür (5 Stk, je Korpus: Dekorspanplatte 1,8 m² à 15 €, Rückwand 0,5 m² à 10 €, 4 Topfscharniere à 2,50 €, Front 0,55 m² à 16 €, Griff à 12 €; Zeit je Korpus: Zuschnitt 25, Bekantung 15, Zusammenbau 45, Tür hängen 2×20 → als Zusammenbau, Warenhandling 5, Verpacken 5), Unterschränke mit 3 Auszügen (3 Stk, dazu 3 Legrabox à 55 € und 3×30 min Zusammenbau), Spülenunterschrank (1 Stk wie Drehtürschrank), Oberschränke (4 Stk, Platte 1,3 m², Rückwand 0,5, 4 Scharniere, Front 0,45 m², Griff), Arbeitsplatte Schichtstoff 38 mm (5,8 lfm à 55 €/lfm + Wandabschluss 5,8 lfm à 8 €, Zuschnitt 60, Zusammenbau 90 für Ausschnitte), Sockelblenden (5,8 lfm à 6 €, 30 min), Fixsockel als eigene Position „Planung und Konstruktion“ (Besprechung 90, Planung 120, Konstruktion 240, Arbeitsvorbereitung 120), Lieferung und Montage (Lieferung 60, Montage 2 Monteure × 8 h = 960 min — CLAUDE.md 5.1: 1,5–2,5 h/lfm bei 5,8 lfm ≈ 9–15 h plus Arbeitsplatte). Alternativen: **Lack** (Fronten: 7 m² × 40 min Oberfläche + 7 m² × 4 € Lack, statt Dekorfront 16 €/m² → MDF roh 12 €/m²), **Massiv** (Fronten 7 m² Eiche à 110 €/m², Werkstatt der Frontpositionen ×1,3, +7 m² × 20 min Ölen), **Altbau** (Montage ×1,6). Faustregel 5.000–20.000 € (CLAUDE.md 6.1) — im Kommentar vermerken, dass die Küche ohne Geräte, Spüle, Armatur ist.
3. **Innentüren** — 5 Stk: Türblatt CPL à 95 €, Zarge à 85 €, Bänder/Schloss/Drücker à 45 € (Materialpositionen), Zeit je Tür: Zuschnitt 10 (Zarge kürzen), Zusammenbau 20, Montage 90, Lieferung 15; Fixsockel 15/21/44/32 gesamt. `ohneMaterial: ['grund','massiv']`, `teiler` 5 für alle Fragen (wie heute). Alternativen: **Lack** (je Tür +4 m² × 40 min + 4 m² × 4 €, Türblatt roh 70 € statt CPL), **Massiv** (Türblatt Eiche à 420 €, Zarge Eiche à 260 €, +Ölen 4 m² × 20 min, Werkstatt ×1,3), **Altbau-Alternative** „mit Ausbau der alten Zargen und Wandausbesserung“ (+45 min Montage je Tür). Faustregel 350–800 €/Tür → 1.750–4.000 € für 5.
4. **Treppe** — Rohtreppe Buche 13 Steigungen à 2.400 €, Geländer/Handlauf à 650 €, Kleinmaterial 120 €; Zeit: Fixsockel 35/51/105/78, Warenhandling 40, Zuschnitt 108, Zusammenbau 162, Oberfläche 154 (Nacharbeit geölte Teile), Montage 752, Lieferung 212 (aus heutiger Referenz). `ohneMaterial: ['grund']`. Alternativen: **Lack** (12 m² × 40 min + 12 m² × 4 €), **Altbau** (Montage ×1,6). Keine Massivfrage. Faustregel 3.000–7.000 €.
5. **Massivholztisch** — Eiche 40 mm Platte 2,1 m² à 140 €, Gestell 1,3 m² à 140 €, Hartwachsöl 1,5 l à 22 €, Kleinmaterial 25 €; Zeit: Fixsockel 30/44/91/68, Zuschnitt 242, Bekantung 0, Zusammenbau 485, Warenhandling 39, Verpacken 29, Oberfläche 334, Lieferung 105+29 → Lieferung 134 (keine Montage). Alternativen: **Lack** (5 m² × 40 min + 5 m² × 4 €, statt Öl), **Lieferung 2. Stock + Gestell vor Ort** (Montage 60 min + Lieferung ×1,6). Keine Massivfrage. Faustregel 2.000–4.500 €.

- [ ] **Step 1: Tests schreiben** (`tests/referenzprojekte.test.mjs`): (a) fünf Projekte, jedes hat ≥ 1 Grundposition und genau eine Alternativposition je gestellter Variantenfrage, Alternativen tragen `alternativ: true`; (b) keine Materialzeile mit `ekPreis <= 0`, keine Zeitzeile mit unbekannter Kostenstelle (Liste der 14 Standardnamen aus `kalibrierung.ts`); (c) `summen(mitSaetzen(p, STANDARDSAETZE_REFERENZ, 0.3))` liegt für jedes Projekt innerhalb `faustregel` (Kontrolle!), Einbauschrank-Grundsumme 2.245 € ± 30 € (die gemessene Referenz); (d) Alternativen sind teurer als die Grundposition außer „montage“ (nur Zeit) — insbesondere Küche massiv > Küche grund > Küche lack-Aufpreis > 0; (e) `faustregelKontrolle` liefert „liegt im Rahmen“ / „darunter“ / „darüber“.
- [ ] **Step 2: Modul schreiben** mit den Daten oben; jede Zahl mit Kommentar (CLAUDE.md-Abschnitt oder „gemessen“).
- [ ] **Step 3:** `npm run test` grün, Commit `feat(kalibrierung): fünf Referenzprojekte als Daten — Positionen, Alternativen, Faustregel-Kontrolle`.

### Task R2: `referenzAusProjekt()` — die Bandbasis aus dem Projekt, `REFERENZEN` aus Projekten

**Files:** Modify `src/lib/kalibrierung.ts`, Test `tests/kalibrierung.test.mjs` (bestehende Zahlen-Tests bewusst anpassen).

**Produces:** `export function referenzAusProjekt(p: Referenzprojekt): Referenzmoebel` — baut die heutige Bandbasis: `materialEk` = Summe EK der Grundpositionen (× Stückzahl), `fixsockel/werkstatt/montage` = Zeitposten der Grundpositionen je Kostenstellengruppe (× Stückzahl), `lackMinuten` = Oberflächen-Minuten der Lack-Alternative minus Grund, `lackMaterialEk` = Material-EK-Differenz Lack−Grund, `massivMaterialEk` = **Grund-Material + Differenz der Massiv-Alternative** (nicht Ersatz!), `massivWerkstattFaktor` = Werkstattminuten massiv ÷ grund, `massivOberflaecheMinuten` = Oberflächen-Differenz, `altbauFaktor` = Montageminuten der Montage-Alternative ÷ grund, `ohneMaterial`, `teiler`, `fragen`, `fragenHinweis`, `name`, `text`. `REFERENZEN` = `Object.fromEntries(Object.values(REFERENZPROJEKTE).map(p => [p.schluessel, mitBaendern(referenzAusProjekt(p))]))`; `SPECS`/`baueReferenz` werden gelöscht (der Einbauschrank kommt ebenfalls aus dem Projekt; `REFERENZ` bleibt als Export für Altnutzer, nun aus dem Projekt abgeleitet).
- [ ] Tests: Küche massiv-Bandmitten > grund-Bandmitten je Band; Einbauschrank-Bänder identisch zu vorher (±1 €); Türen weiterhin 180/230/270/320 €/Tür treffen (sonst Zahlen der Türen-Positionen in R1 nachziehen — Test ist die Vorgabe); alle bisherigen `kalibrierung.test.mjs`-Tests grün oder mit Kommentar auf neue Werte gesetzt.
- [ ] Commit `feat(kalibrierung): Bandbasis aus den Referenzprojekten — Massiv rechnet Grundmaterial plus Mehrkosten`.

### Task R3: Route liefert das gerechnete Projekt; „Als Projekt öffnen“

**Files:** Modify `src/app/api/settings/kalibrierung/route.ts`; Create `src/app/api/settings/kalibrierung/als-projekt/route.ts`.
- GET zusätzlich: `referenzprojekt: { schluessel, name, kunde, text, positionen: mitSaetzen(p, saetze, aufschlag), summen, faustregel: faustregelKontrolle(...) , baender: ref.baender }` — gerechnet mit den Sätzen/Aufschlag des Nutzers (bereits geladen in der Route).
- POST `als-projekt` `{ schluessel }` → Zugang prüfen → Projekt anlegen (`projects.insert({ user_id, title: 'Referenz: ' + name, status: 'offen', data: { kunde, pos: positionen mit ids neu, docNr: '', docTyp: 'angebot', anschr: '', widerruf: false, angebotsdatum: heute } })` — Datenform genau wie `uebernehmeKiErgebnis` in `src/app/page.tsx` sie speichert (lesen!) → `{ id }`.
- [ ] Commit `feat(kalibrierung): Route liefert das Referenzprojekt mit Betriebssätzen; Als-Projekt-Öffnen`.

### Task R4: Oberfläche in `BetriebSettings.tsx`

- Statt des Textkastens: Kasten „Das Referenzprojekt: {name}“ mit Referenztext, darunter **aufklappbar** „So rechnet CraftFlow dieses Projekt“: Tabelle Positionen (Titel, Stk, Preis), je Position aufklappbar Material (Bezeichnung, Menge, Einheit, EK, Aufschlag, Preis) und Arbeitszeit (Kostenstelle, Minuten, Satz, Betrag); Alternativpositionen mit Chip „Alternative“ und Preis in Klammern (wie im Angebot); Summenzeile Material / Arbeit / Netto (nur Grund); Faustregel-Kontrollzeile (`C.ok` im Rahmen, `C.warn` sonst); Knopf „Als Projekt öffnen“ (POST, Erfolg: „Projekt ‚Referenz: …‘ angelegt — du findest es unter Meine Projekte.“).
- Die Fragen direkt unter der zugehörigen Position: Grundfrage unter der Grundsumme („CraftFlow rechnet X € — was nimmst du?“), Lack/Massiv/Montage unter der jeweiligen Alternative mit deren Preis bzw. Dauer als Anker; Bandtexte wie heute aus `ref.fragenliste`.
- Hinweise: Lackierkabine-Satz unter der Maschinenfrage; Schwerpunkt-Fallback-Satz.
- [ ] Commit `feat(betrieb): Referenzprojekt als Kalkulation mit Alternativen, Fragen an den Positionen, Als Projekt öffnen`.

### Task R5: Doku und Live-Test (Controller)
- CLAUDE.md-Abschnitt Kalibrierung anpassen (Referenzen sind Projekte; Faustregel Kontrolle), `src/lib/assistentwissen.ts` Satz. Live: Seite im Testkonto öffnen (Screenshot hell/dunkel), Projekt öffnen → in Meine Projekte sichtbar, Fragen beantworten → Faktoren; Vault-Notiz.
