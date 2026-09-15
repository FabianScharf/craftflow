# Pläne, Kostenkontrolle und große Projekte — Design

Stand 2026-09-15. Abgestimmt mit Fabian in der Sitzung vom 15.09.

## 1. Ziel

CraftFlow soll Geld verdienen. Drei Dinge stehen dem heute im Weg:

1. **Jeder Plan hat alle Funktionen.** Seit dem Sommer-Update sind Betriebskalibrierung,
   Bauweise-Lernfunktion, Lernschleife, Materialpreise, Textbausteine, Briefpapier,
   Angebotsversionen, Optimieren-Chat, Hilfe-Assistent und CI-Farben in jedem Plan frei.
   Der Solo-Plan für 7 € liefert den vollen Kalkulator.
2. **Kosten sind nicht gedeckelt.** Begrenzt ist nur die Zahl der Angebote je Monat. Der
   Optimieren-Chat, Dateien und große Projekte sind offen. Niemand misst, was ein Nutzer
   kostet.
3. **Große Projekte scheitern.** Ein Kunde ging verloren, weil er viele Bilder und
   Dokumente hochlud und nur Fehler bekam. Drei Wände: 4,5 MB Anfragegröße (Vercel),
   300 s Laufzeit (Vercel), 10.000 Zeichen Text (stille Kürzung im Code).

Zielbild: **Pro (49 €) ist der Plan, den ein Betrieb mit 2–5 Leuten kauft.** Er macht
CraftFlow zum eigenen Kalkulator des Betriebs und kann große Projekte. Solo und Starter
sind gedeckelt, nicht kastriert. Enterprise ist Fair Use mit Ausschreibungs-Modus.

## 2. Entscheidungen (Fabian, 15.09.)

- Keine zahlenden Kunden → Grenzen gelten sofort für alle, keine Bestandsschonung.
  Gutschein-Nutzer behalten ihren Plan bis Oktober (der Gutschein setzt den Plan direkt).
- **Testphase bleibt Enterprise** (14 Tage): Der Tester lernt das volle Programm kennen.
  Die Fair-Use-Deckel gelten auch im Test.
- **Solo bleibt** (7 €), aber minimal: Der Nutzer muss mehr einbringen als er kostet.
- **Grenzen statt Sperren**: Ein Deckel lädt zum Upgrade ein, eine Sperre frustriert.
- **Betriebskalibrierung ab Starter** (Einstieg in „mein Kalkulator“), Lernfunktionen ab Pro.
- **Prompt-Caching sofort** — erledigt (Commit `071215b`, live gemessen: 10.401 Token aus
  dem Cache beim zweiten Aufruf).
- **Optimieren-Runden deckeln** — beschlossen.
- **Landingpage muss die Pläne mit ihren Grenzen zeigen** — Pflichtteil, gleich mit.

## 3. Die Plan-Matrix (verbindlich)

| | Solo 7 € | Starter 29 € | **Pro 49 €** | Enterprise 79 € |
|---|---|---|---|---|
| Angebote pro Monat | 3 | 15 | 50 | Fair Use 150 |
| Optimieren-Runden je Angebot | 5 | 10 | 20 | 40 |
| Dateien je Projekt (Fotos, PDFs) | keine | 5 | 25 | 60 |
| Große Projekte in Blöcken | nein | nein | **ja** | ja |
| Ausschreibungs-Modus (GAEB, Stapel) | nein | nein | nein | ja |
| Betriebskalibrierung | nein | ja | ja | ja |
| Bauweise-Lernfunktion | nein | 5 Regeln | **unbegrenzt** | unbegrenzt |
| Lernschleife (aus gewonnenen Angeboten) | nein | nein | **ja** | ja |
| Materialpreise | nein | 20 Einträge | **unbegrenzt** | unbegrenzt |
| Textbausteine, Briefpapier, Schriftwahl, CI-Farben | Standardlayout | ja | ja | ja |
| Lieferanten und Anfragen | nein | ja | ja | ja plus Internet-Suche |
| Auswertung | nein | nein | **ja** | ja |
| Eigener Mailversand (SMTP) | nein | nein | ja | ja |
| Nutzer | 1 | 1 | 3 | unbegrenzt |
| Hilfe-Assistent, Spracheingabe, PDF | ja | ja | ja | ja |

Ein großes Projekt in Blöcken zählt **je Block als ein Angebot**. Damit bleibt der
teuerste Vorgang an den Deckel gebunden.

### Warum diese Zahlen tragen

Eine Analyse kostet bei Sonnet 4.6 etwa 0,15–0,25 $ (mit Caching weniger), eine
Optimieren-Runde etwa 0,09 $. Preise brutto, netto nach Stripe ≈ Solo 5,50 €, Starter
23,70 €, Pro 40,20 €, Enterprise 65 €. Schlimmster Fall mit den Deckeln oben:
Solo ≈ 1,20 €, Starter ≈ 7,50 €, Pro ≈ 25 €, Enterprise ≈ 60 €. Typisch liegt jeder Plan
weit darunter. Fixkosten grob 65 €/Monat → zwei Pro-Kunden decken sie.

## 4. Umsetzung in vier Teilen

### Teil A — Pläne und Deckel (ein bis zwei Tage)

**Eine Quelle für alles:** `src/lib/plaene.ts` (reine Daten, testbar) mit

```
PLAENE = { solo: { preis: 7, angebote: 3, optimierenRunden: 5, dateien: 0,
                   bauweiseRegeln: 0, materialpreise: 0, nutzer: 1,
                   funktionen: ['spracheingabe', 'pdf', 'assistent'] }, ... }
```

Daraus lesen: `usePlan` (`canUse`, Limits), `PlanGate`, `darfNutzen` in page.tsx,
`PricingModal`, die Plan-Seite in den Einstellungen und der Hilfe-Assistent
(`assistentwissen.ts` nennt heute „ab Pro-Plan“ in Freitext — muss aus derselben Quelle
kommen, sonst berät er falsch; der bestehende Test erinnert daran).

**Serverseitig durchsetzen** (der Browser ist nie die Instanz):

| Deckel | Wo | Wie |
|---|---|---|
| Angebote/Monat | `/api/usage` (gibt es) | Limit aus `plaene.ts`; Blöcke zählen mit |
| Optimieren-Runden | `/api/optimize` | Zähler je `projekt_id` in `plan_usage` (neue Spalte oder Tabelle `optimieren_runden`); bei Überschreitung 402 mit lesbarer Meldung und Upgrade-Hinweis |
| Dateien je Projekt | `/api/analyze` (heute) bzw. Upload-Route (Teil C) | Anzahl prüfen, Meldung: „Im Starter-Plan sind 5 Dateien je Projekt möglich“ |
| Bauweise-Regeln | `/api/settings/bauweise` POST, `speichereRegel` im Optimieren | Zählen vor dem Speichern; die KI-gelernte Regel wird bei vollem Deckel als „nicht gespeichert — Deckel erreicht“ im Chat gemeldet (nie stumm) |
| Materialpreise | `/api/settings/materialpreise` POST | Zählen vor dem Speichern |
| Kalibrierung, Lernschleife, Auswertung, SMTP, Lieferanten | jeweilige Routen | `minPlan`-Prüfung mit einem gemeinsamen Helfer `pruefePlan(supabase, user, 'lernschleife')` → 403 mit Meldung |

**Oberfläche:** Gesperrte Bereiche zeigen den bestehenden `PlanGate`-Kasten („ab
Starter-Plan verfügbar“ + Upgrade). Deckel zeigen einen Zähler („3 von 5 Regeln“) und beim
Erreichen denselben Kasten. Kein Rätselraten, jede Grenze nennt den Plan, der sie hebt.

**Testphase:** `effectivePlan = 'enterprise'` bleibt. Der Gutschein setzt `plan` direkt —
keine Änderung nötig.

**Tests:** `tests/plaene.test.mjs` — jede Zahl der Matrix oben steht einmal im Test, dazu
Monotonie (kein höherer Plan hat weniger als ein niedrigerer).

### Teil B — Kostenzähler (halber Tag)

- Tabelle `ki_nutzung` (user_id, route, modell, eingabe, cache_geschrieben, cache_gelesen,
  ausgabe, kosten_usd, projekt_id, created_at). RLS: Nutzer liest nur sich selbst.
- Schreiben aus `/api/analyze`, `/api/optimize`, `/api/assistant`, `/api/lernschleife`
  über einen Helfer `protokolliereNutzung()` — **darf nie den Hauptvorgang blockieren**
  (try/catch, kein await auf den Erfolg).
- `src/lib/kinutzung.ts` (gibt es) rechnet Kosten; Preise dort pflegen.
- Admin-Bereich: Tabelle je Nutzer und Monat — Plan, Planpreis netto, KI-Kosten in €,
  Marge, Ampel: grün < 30 %, gelb < 50 %, rot darüber. Summenzeile.
- Später möglich: automatische Mail an Fabian bei Rot.

### Teil C — Große Projekte (zwei bis drei Tage plus Live-Tests)

Die drei Wände fallen nur, wenn Dateien nicht mehr in der Analyse-Anfrage stecken.

1. **Upload je Datei** nach Supabase Storage (Bucket `projektdateien`, Pfad
   `user_id/projekt_id/…`). Route `/api/upload` prüft Plan-Deckel und Größe je Datei
   (Fotos werden weiter im Browser verkleinert). Die 4,5-MB-Wand betrifft dann nur noch
   eine einzelne Datei, nie das Projekt.
2. **Vorbereitung serverseitig:** `/api/analyze/vorbereiten` liest die Dateien aus dem
   Storage, zieht Text aus PDFs (unpdf ist da), teilt den Gesamttext an Positions- oder
   Seitengrenzen in **Blöcke ≤ 8.000 Zeichen** und ordnet Bilder den Blöcken zu. Antwort:
   Liste der Blöcke mit Vorschau-Zeile. **Nichts wird gekürzt**; was nicht lesbar ist
   (Bild zu groß, PDF ohne Text), steht namentlich in `nichtVerarbeitet`.
3. **Analyse je Block:** `/api/analyze/block` ist die heutige Analyse für einen Block
   (< 300 s garantiert, weil Block klein). Der Browser ruft die Blöcke **nacheinander**
   auf, zeigt „Block 3 von 7“ und die bisher erzeugten Positionen; abbrechen jederzeit,
   Ergebnis bis dahin bleibt. Jeder Block zählt als Angebot (Deckel).
4. **Zusammenführen:** Positionen der Blöcke werden angehängt, Kunde/Kopf aus Block 1,
   Nummerierung fortlaufend, Dubletten (gleicher Titel + Maße) werden gemeldet, nicht
   still verschmolzen.
5. **Kleine Projekte** (ein Block, keine Dateien) laufen wie heute in einem Schritt —
   kein spürbarer Unterschied für den Solo-Nutzer.

Später (Enterprise, Ausschreibungs-Modus): dieselben Blöcke im Hintergrund durch eine
Warteschlange, Nutzer kann den Tab schließen, Mail bei Fertigstellung. GAEB-Import
liefert die Blöcke direkt aus den Positionen. Nicht Teil dieses Vorhabens.

Streaming (Roadmap Phase 1 alt) ist damit nicht mehr nötig — Blöcke lösen Zeit und Größe
zugleich. Die Vault-Roadmap wird entsprechend umgeschrieben.

### Teil D — Landingpage (halber Tag, Repo `~/craftflow-web`)

Heutiger Stand dort: Die Pläne stehen fest verdrahtet in `app/page.tsx` (ab Zeile ~70,
Namen wie „Professional“, Texte wie „Foto- & Bildanalyse“, „3 Benutzer“ bei Starter) und
werden von `components/landing/PricingSection.tsx` gezeichnet. Namen und Grenzen weichen
von der App ab (App: „Pro“, Starter hat 1 Nutzer). Genau diese Abweichung soll die
gemeinsame Matrix beenden.

- Preistabelle aus derselben Matrix, gleiche Wortwahl wie in der App. Idealerweise
  eine kleine JSON-Datei, die beide Repos teilen (Kopie mit Test, der Gleichheit prüft).
- Pro als hervorgehobene Spalte („Beliebt“), Untertitel „Mein eigener Kalkulator“.
- Je Plan drei Sätze Nutzen, dann die Grenzen als Zahlen, nicht als Fußnote.
- FAQ-Eintrag „Was heißt Fair Use bei Enterprise?“ und „Was passiert, wenn ich eine
  Grenze erreiche?“ (Antwort: Hinweis in der App, Upgrade mit einem Klick, nichts geht
  verloren).
- Bruttopreise mit „inkl. MwSt.“, weil Handwerker vergleichen, was sie überweisen.

## 5. Reihenfolge

1. Teil A (Pläne) — sofort wirksam für jeden neuen Nutzer.
2. Teil D (Landingpage) — gleichzeitig, sonst verspricht die Website anderes als die App.
3. Teil B (Kostenzähler) — direkt danach, damit die ersten Zahler gemessen werden.
4. Teil C (große Projekte) — das Verkaufsargument für Pro.

Jeder Teil geht einzeln auf `dev`, wird live geprüft, dann freigegeben.

## 6. Risiken

- **Gesperrte Funktionen, die Tester schon nutzen:** Wer im Test Regeln angelegt hat und
  danach Starter kauft, hat mehr als 5 Regeln. Regel: Vorhandenes bleibt wirksam, nur
  Neues ist gedeckelt. Gilt für alle Deckel (nie löschen, nur nicht mehr wachsen lassen).
- **Optimieren-Deckel trifft mitten im Gespräch:** Meldung im Chat, letzter Stand bleibt
  gespeichert, Upgrade-Link. Keine 500er.
- **Blöcke verändern die Kalkulation:** Ein Block kennt die anderen nicht; Gemeinkosten-
  Positionen (Planung, Montage) könnten doppelt entstehen. Lösung: Block 1 legt sie an,
  Folgeblöcke bekommen die Anweisung „keine Gemeinpositionen“ und die Kopfpositionen
  als Kontext. Muss im Live-Test mit einem echten Leistungsverzeichnis geprüft werden.
- **Vercel-Kosten** steigen mit mehr Funktionsaufrufen — im Kostenzähler mit erfassen
  (Aufrufe je Nutzer), nicht nur Token.

## 7. Offen

- Exakte Fixkosten (Fabian nennt sie, sobald es entscheidend wird).
- Ob Enterprise auf 99 € gehen sollte, wenn der Ausschreibungs-Modus steht.
- Nachkalkulation als Datenbasis (Vault-Notiz) — passt zum Kostenzähler, aber später.
