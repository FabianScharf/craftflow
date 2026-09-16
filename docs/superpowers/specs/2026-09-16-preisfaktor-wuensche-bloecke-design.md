# Preisfaktor & Zeitfaktoren, Wünsche-Community, Große Projekte in Blöcken — Design

Stand 2026-09-16, morgens. Entscheidungen von Fabian aus dem Gespräch vom 16.09. Vorgänger-Spec
(Pläne/Deckel, umgesetzt): `2026-09-15-plaene-kosten-grosse-projekte-design.md` — Teil C von dort
wird hier konkretisiert; Teil B (Kostenzähler) ist **zurückgestellt** (Fabian: nicht wichtig,
solange alle Pläne kostenpositiv sind).

Fabians Rahmen: „Ich möchte eine Software haben, die sich jeder frei einstellen kann, wie er es
braucht. Wir müssen von einer Basis ausgehen — wenn ich feststelle, die Preise sind zu günstig,
dann möchte ich das mit Faktoren regeln können.“ Alles wird auf `dev` gebaut und live geprüft;
**nichts geht auf `main`, bis Fabian alles zusammen geprüft hat** („wir optimieren noch ein paar
Punkte und pushen erst dann“).

---

## Teil P — Zeitfaktoren 0,5–3,0 und ein neuer Preisfaktor

### Entscheidungen
- **Zeitfaktoren** (Werkstatt, Oberfläche, Massivholz, Montage) dürfen von Hand **0,50 bis 3,00**
  eingestellt werden. Die Ableitung aus den Kalibrierungsantworten bleibt wie sie ist
  (Zielfaktoren 0,6–1,4); die Grenze war nur ein Tippfehler-Schutz. Betroffen: `deckele()` in
  `src/lib/kalibrierung.ts` (nur für Handeingaben weiten — `MIN_FAKTOR`/`MAX_FAKTOR` bzw. eine
  eigene Grenze `HAND_MIN`/`HAND_MAX` für `vonHand` in der Route), die Eingabefelder und die
  Vorab-Prüfung in `BetriebSettings.tsx` (heute 0,6–1,4), die Server-Deckelung in
  `src/app/api/settings/kalibrierung/route.ts` (`vonHand` → `deckele`).
- **Preisfaktor** (neu): ein Wert je Betrieb, **0,50 bis 3,00**, Standard 1,00, der den
  **Endpreis jeder Position** multipliziert — Material und Lohn zusammen — **ohne die Stunden zu
  verändern**. Grund: Zeitfaktoren verfälschen „Stunden gesamt“ und den Plancraft-Export; wer
  teurer verkaufen will, braucht einen Preishebel.
  - Speicherort: `betriebsprofil.preisfaktor numeric(4,2) not null default 1.00`
    (SQL-Datei `docs/sql/2026-09-16-preisfaktor.sql`; PATCH-Route: in `allowed` + `numFields`,
    serverseitig auf 0,5–3,0 geklemmt, sonst 400 mit Meldung).
  - **Der Faktor wird auf die Position gestempelt**, wenn sie entsteht (`Angebotsposition.preisfaktor?: number`),
    aus dem Betriebsprofil des Nutzers. Ein späteres Ändern des Faktors ändert alte Angebote
    NICHT (ein verschicktes Angebot darf sich nicht rückwirkend verändern). Neue Positionen aus
    der Analyse, aus dem Optimieren (`updatedOffer`) und manuell angelegte bekommen den Faktor.
  - Rechenregel (Invariante, `src/lib/types.ts`): `calcAngebotspos(p) = (materialkostenPos(p) + arbeitszeitPreisPos(p)) * (p.preisfaktor ?? 1)`.
    `nettoSumme` summiert `calcAngebotspos` — damit stimmen App, PDF und Export automatisch.
    `stundenGesamt`, `materialkostenGesamt`, Stundensätze und Aufschläge bleiben unberührt.
  - Anzeige: In der Kalkulationsübersicht eine Zeile „Preisfaktor 1,25“ (nur wenn ≠ 1,00) und
    in „Mein Betrieb“ ein eigener Abschnitt „Preisfaktor“ unter den Zeitfaktoren mit
    Erklärung: „Multipliziert den Preis jeder neuen Position. Stunden und Stundensätze bleiben,
    wie sie sind. 1,00 = CraftFlow-Preis, 1,20 = 20 % teurer.“ Speichern mit demselben
    Knopf-Muster wie „Faktoren von Hand übernehmen“ (aktiv nur bei Änderung, Meldung daneben).
  - Der Preisfaktor erscheint NICHT im PDF (Kunde sieht nur Endpreise) und wird NIE in den
    KI-Prompt gegeben (Regel: Vault beeinflusst keine Preise; der Faktor ist reine Nachrechnung).
  - Der Hilfe-Assistent kennt beides (`assistentwissen.ts` + Test).
- Tests: `tests/preisfaktor.test.mjs` (Rechenregel, Klemmung, Standard 1), `tests/kalibrierung.test.mjs`
  ergänzen (Handgrenzen 0,5–3,0, Ableitung weiterhin 0,6–1,4).

---

## Teil W — Wünsche-Community

### Entscheidungen (Fabian, 16.09.)
- Bereich „Wünsche“ in den Einstellungen der App. **Jeder Plan** darf vorschlagen und abstimmen,
  auch Solo. Neue Vorschläge sind **sofort sichtbar**; Fabian kann ausblenden, zusammenlegen,
  Status setzen.
- **Stimmen je Plan als Budget:** Solo 1, Starter 3, Pro 10, Enterprise 30 (Testphase =
  Enterprise = 30). Je Wunsch höchstens **eine** Stimme pro Nutzer; das Budget verteilt der
  Nutzer über beliebig viele Wünsche und kann Stimmen jederzeit zurücknehmen. In `plaene.ts`
  als neue Deckel-Art `wunschStimmen` (1/3/10/30).
- **Wechsel nach unten:** dieselbe Regel wie überall — die ältesten N Stimmen bleiben aktiv, weitere
  werden inaktiv (zählen nicht), nichts wird gelöscht; wirkt beim Lesen (`wendeDeckelAn`).
- Status je Wunsch: `offen` | `geplant` | `in_arbeit` | `fertig` | `ausgeblendet` (nur Fabian).
  Fertige bleiben sichtbar — Stimmen sollen sichtbar etwas bewirken.
- **Website:** öffentliche Seite `/roadmap` („Was als Nächstes kommt“) zeigt nur `geplant`,
  `in_arbeit`, `fertig` mit Stimmenzahl — über eine öffentliche, gecachte API der App
  (`GET /api/wuensche/oeffentlich`, in `PUBLIC_PATHS`, ohne Nutzerdaten, 5 Min Cache). Offene
  Vorschläge nur in der App.

### Datenmodell (`docs/sql/2026-09-16-wuensche.sql`)
- `wuensche(id uuid pk, user_id uuid, titel text ≤ 120, beschreibung text ≤ 1000, status text default 'offen', zusammengelegt_in uuid null, created_at, updated_at)` — RLS: lesen alle angemeldeten (außer `ausgeblendet`), anlegen nur eigene, ändern nur Fabian (Admin-E-Mail wie `admin/gutscheincodes`) über Service-Role-Route.
- `wunsch_stimmen(wunsch_id uuid, user_id uuid, created_at, pk(wunsch_id, user_id))` — RLS: eigene lesen/anlegen/löschen.
- **GRANTs nicht vergessen** (`grant select, insert, update, delete … to authenticated, service_role`) — Lehre vom 16.09.
- Stimmenzahl je Wunsch = zählen der **aktiven** Stimmen (Budget-Deckel je Nutzer beim Lesen) — Berechnung serverseitig in der Route, nicht in SQL-Views (Deckel-Logik liegt in `plaene.ts`).

### Routen
- `GET /api/wuensche` (Liste mit Stimmen, eigener Stimme, Budget `{ gesamt, benutzt }`), `POST` (anlegen; Text-Längen prüfen; Deckel: max 3 offene Vorschläge je Nutzer und Tag gegen Spam), `POST /api/wuensche/[id]/stimme` (setzen — 403 mit Meldung, wenn Budget voll: „Du hast alle N Stimmen deines Plans vergeben. Nimm eine zurück oder wechsle den Plan.“ + `minPlan` = nächster Plan mit mehr), `DELETE …/stimme` (zurücknehmen), `PATCH /api/admin/wuensche/[id]` (Status, zusammenlegen, ausblenden — nur Fabian).
- `pruefeZugang` überall; Vorschlagen/Abstimmen ist für gesperrte Nutzer nicht möglich.

### Oberfläche
- Einstellungen → „Wünsche“ (neuer Bereich, Seitenleiste, Assistent kennt ihn): oben Budget
  „Du hast 3 von 10 Stimmen vergeben“, Formular (Titel, Beschreibung), Liste sortiert nach
  Stimmen, je Eintrag Status-Abzeichen, Stimmen-Knopf (an/aus), Datum, „von dir“ bei eigenen.
  Nur `C.*`/`akzentTon()`.
- Admin (nur Fabian): Status-Auswahl, „Ausblenden“, „Zusammenlegen in …“.
- Website `/roadmap`: drei Spalten Geplant / In Arbeit / Fertig; Link in der Navigation und im FAQ-Eintrag „Was passiert mit meinen Wünschen?“.

---

## Teil C — Große Projekte in Blöcken

### Ziel
Ein Kunde lädt 30 Fotos und ein 40-seitiges Leistungsverzeichnis hoch, und es läuft durch. Die
drei Wände (4,5 MB Anfrage, 300 s Laufzeit, stille 10.000-Zeichen-Kürzung) fallen. **Nichts wird
mehr stumm gekürzt oder verworfen.**

### Entscheidungen
- **Upload je Datei** in Supabase Storage, Bucket `projektdateien`, Pfad `<user_id>/<projekt_id>/<uuid>-<name>`.
  Route `POST /api/upload` (multipart, eine Datei): prüft `pruefeZugang`, `erlaubt('dateien')`,
  Deckel `dateien` je Projekt (zählt vorhandene Dateien des Projekts im Storage), Größe je Datei
  ≤ 10 MB, erlaubte Typen (jpg/png/webp/pdf). Fotos werden weiter **im Browser** verkleinert
  (bestehende `compressImage`). Antwort `{ pfad, name, groesse }`. Ohne `projekt_id` (neues,
  ungespeichertes Projekt) wird zuerst ein Projekt-Entwurf angelegt (`projects` POST mit Titel
  „Entwurf“), damit jede Datei einem Projekt gehört. `DELETE /api/upload` entfernt eine Datei.
  Bucket ist privat; Lesen nur über signierte URLs, die der Server erzeugt.
- **Vorbereitung serverseitig:** `POST /api/analyze/vorbereiten { projekt_id, text }` liest die
  Dateien des Projekts aus dem Storage, zieht Text aus PDFs (`unpdf`), und **teilt** Text +
  Bilder in Blöcke: Ziel je Block ≤ 8.000 Zeichen Text und ≤ 6 Bilder; Schnitt bevorzugt an
  Positions- oder Seitengrenzen (Zeilen, die mit einer Positionsnummer beginnen, z. B. `1.2`,
  `01.03`, `Pos. 4`; sonst Seitenumbruch; sonst Absatz). Bilder werden den Blöcken in
  Upload-Reihenfolge zugeteilt. Antwort: `{ bloecke: [{ nr, vorschau, zeichen, bilder }], nichtVerarbeitet: [{ name, grund }] }`.
  Grenzen (Deckel `dateien`, Plan `bloecke` ab Pro) werden hier geprüft: mehr als ein Block
  braucht `erlaubt('bloecke')`, sonst 403 mit Meldung „Große Projekte in Blöcken sind ab dem
  Pro-Plan möglich.“ Ein einzelner Block ohne Dateien läuft **wie heute** über `/api/analyze`.
- **Analyse je Block:** `POST /api/analyze/block { projekt_id, blockNr, kontext }` = die heutige
  Analyse, angewandt auf einen Block: Zugang, Deckel `angebote` (jeder Block reserviert ein
  Angebot, `reserviere_angebot`; ohne Positionen wieder frei), KI-Aufruf < 300 s, weil klein.
  `kontext` trägt aus Block 1: Kunde, Kopfdaten, die bisher erzeugten Positionstitel und den
  Hinweis **„Gemeinpositionen (Planung, Besprechung, Anfahrt/Montage-Pauschale) nur in Block 1;
  in Folgeblöcken NICHT erneut anlegen“** — die Prompt-Ergänzung ist ein eigener, fester Block
  (kein Nutzertext), damit das Caching greift.
- **Browser:** Ablauf Start → Upload je Datei mit Fortschritt → „Vorbereiten“ → Anzeige „7 Blöcke,
  2 Dateien nicht lesbar: …“ → Blöcke **nacheinander** → „Block 3 von 7“ mit bisherigen
  Positionen → Abbrechen jederzeit, Ergebnis bis dahin bleibt → Zusammenführen: Positionen
  anhängen, Nummerierung fortlaufend, Kunde/Kopf aus Block 1; **Dubletten** (gleicher Titel und
  gleiche Maße) werden als Hinweisliste gezeigt, nicht still verschmolzen. Der Kalkulations-
  bildschirm ist danach der heutige.
- **Timeout-Sicherheit:** jede Route ≤ 300 s (`maxDuration`), Blöcke klein genug (Erfahrung:
  8.000 Zeichen + 6 Bilder ≈ 60–120 s). Kein Streaming nötig.
- **Deckel:** Dateien je Projekt (Upload), Angebote je Block (Reservierung). Optimieren nach
  der Analyse zählt weiter je Projekt.
- **Nicht in dieser Runde:** Hintergrund-Warteschlange/E-Mail bei Fertigstellung (Enterprise-
  Ausschreibungs-Modus), GAEB als Blockquelle. Die Analyse-Route `/api/analyze` bleibt für
  kleine Projekte unverändert.

### Risiken, die der Live-Test klären muss
- Gemeinpositionen doppelt trotz Anweisung → Zusammenführen prüft Titel gegen eine feste Liste
  (Planung, Besprechung, Konstruktion, Montage-Pauschale, Anfahrt) und meldet Duplikate.
- Positions-Schnitt bei Leistungsverzeichnissen ohne Nummern → Fallback Seitengrenzen.
- Storage-RLS und GRANTs (Bucket-Policies: nur eigener Ordner) — beim Anlegen des Buckets prüfen.
- Kosten: 7 Blöcke ≈ 1,5 $ je großem Projekt — Pro-Kontingent 50 Angebote deckt ~7 große Projekte.

---

## Reihenfolge und Abnahme
1. Teil P (klein) → 2. Teil W (ein Tag) → 3. Teil C (zwei bis drei Tage + Live-Test mit einem
echten Leistungsverzeichnis). Alles auf `dev` (App) bzw. `dev` (Website). Danach **eine**
Abnahme durch Fabian, dann gemeinsam live.
