# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # start dev server
npm run build    # production build
npm run lint     # ESLint (flat config, eslint.config.mjs)
```

No Prettier is configured. Do not add formatting tools.

## Architecture

Single-page app — all UI lives in `src/app/page.tsx` (~850 lines). Do not split into separate component files unless explicitly asked.

```
src/
  app/
    page.tsx          # entire frontend (screens: start, app, pdf)
    api/analyze/
      route.ts        # POST → Gemini API → structured JSON
  lib/
    types.ts          # domain model, company constants (FIRMA, C colors, helpers)
    pdf.ts            # builds PDF as HTML string
```

Path alias: `@/*` → `./src/*`

## Styling

All styles are inline `style={{}}` objects using constants from `@/lib/types` (color palette `C`, etc.). Do not use Tailwind utility classes or CSS modules — the project intentionally avoids them.

## Environment

Alle Secrets liegen auf **Vercel**. Lokal enthält `.env.local` nur leere Platzhalter → die App läuft lokal NICHT (siehe „Lokale Umgebung & Testen" unten). Relevante Keys: `ANTHROPIC_API_KEY` (Analyse/Optimierung), `GROQ_API_KEY` (Voice), `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` (Auth/DB).

## AI integration

Modelle: Anthropic `claude-sonnet-4-6` für `/api/analyze` (Extended Thinking) und `/api/optimize`; Groq `whisper-large-v3-turbo` für `/api/transcribe` (Voice). Prompts sind deutsch und liefern strukturiertes JSON (Backtick-Fences werden als Fallback entfernt).

## Deployment

Push to `main` → Vercel auto-deploys. Live URL: `https://app.getcraftflow.de` (Custom-Domain, offizielle Adresse). Vercel-Standarddomain (Fallback): `https://craftflow-sable.vercel.app` — zeigt auf dieselbe Produktion.

No CI pipeline. To trigger a redeploy without code changes: `git commit --allow-empty -m "..." && git push`

## Language

UI and all user-facing strings are German only. Keep them German.

## AI-Provider (aktueller Stand — ersetzt den alten Gemini/Groq-Migrationsplan)

Die Migration ist erledigt: Analyse/Optimierung laufen über Anthropic
`claude-sonnet-4-6`, Voice über Groq `whisper-large-v3-turbo`. Gemini wird nicht
mehr verwendet.

---

# Zusammenarbeit & Projektwissen (Stand 2026-07-07)

> Kompakte Zusammenfassung der Erkenntnisse aus der Session, damit künftige
> Sitzungen sofort produktiv sind.

## Über Fabian
Schreinermeister, kein Programmierer. Erklärungen kurz, in Alltagssprache,
Deutsch. Entscheidungen — besonders Deployments — immer ihm überlassen; nichts
ungefragt auf `main`.

## Lokale Umgebung & Testen — WICHTIG
- `.env.local` enthält **nur leere Platzhalter** (`ANTHROPIC_API_KEY=""` etc., von
  `vercel env pull`). `npm run dev` scheitert am Supabase-Client. **Nicht** versuchen,
  die App lokal laufen zu lassen — Zeitverschwendung.
- Echte Keys liegen ausschließlich auf Vercel. **Deployen braucht sie nicht** (läuft
  über GitHub-Push, Vercel baut mit seinen eigenen Keys).

### Drei bewährte Testwege
1. **Reine Logik ohne Keys/LLM:** Die Preisfunktionen in `src/lib/types.ts` und die
   Nachbearbeitung sind pure Funktionen → in ein Node-Skript kopieren, mit festen
   Eingaben durchrechnen. Bester Weg für exakte Zahlen-Plausibilität.
2. **Live gegen die deployte dev-Preview (echte KI):**
   - **Stabile Dev-Adresse (bevorzugt — kein Neu-Login je Preview):**
     `https://craftflow-git-dev-fabian-scharf-s-projects.vercel.app` — zeigt immer auf
     die neueste dev-Version, einmal einloggen bleibt über Deploys gültig.
     (Per-Deploy-URL sonst via `gh api repos/FabianScharf/craftflow/deployments` →
     `/deployments/<id>/statuses` → `target_url` — erzwingt aber je Preview neuen App-Login.)
   - Chrome mit Debug-Port: `"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --remote-debugging-port=9222 --user-data-dir=/tmp/craftflow-chrome-profile <url>/login`
   - **Zwei Login-Wände:** Vercel-SSO (über GitHub, gilt teamweit über alle Previews)
     + App-Login (Supabase, host-scoped → per Preview neu; stabiler Alias vermeidet das).
     Fabian loggt manuell ein.
   - **Alle Previews + Produktion teilen dieselbe Supabase-DB** → Daten-/Settings-
     Änderungen (z. B. Kostenstellen) wirken sofort überall, unabhängig vom Branch.
   - Steuerung über projekteigenes `puppeteer-core` (v25):
     `puppeteer.connect({ browserURL: 'http://localhost:9222' })`, dann im
     eingeloggten Tab per `page.evaluate(fetch('/api/analyze', …))`. So lassen sich
     `userKostenstellen`/`userMaterialgruppen`/`deaktivierteKostenstellen` exakt
     steuern — sauberer als UI-Klicken.
   - `/api/analyze` und `/api/optimize` haben keine eigene Auth-Prüfung, brauchen
     aber die Session-Cookies (Middleware schützt alles außer `PUBLIC_PATHS`).
3. **Reine Logik mit echten Tests:** `npm run test` führt `tests/*.test.mjs` über Nodes
   eigenen Test-Runner aus. Node 24 führt die TypeScript-Dateien direkt aus (Type
   Stripping) — deshalb sind **keine** Test-Pakete installiert und `src/lib/learn.ts`
   importiert absichtlich nichts. Alles, was Supabase braucht, gehört nach
   `src/lib/bauweise.ts`, sonst sind die Tests nicht mehr lauffähig.

## Kalkulations-Engine — verbindliche Invarianten
- Preis pro Position: Material `= Σ menge·EK·(1+aufschlag)`, Lohn
  `= Σ (minuten/60)·vkStunde` (`src/lib/types.ts`).
- **Nach** der KI-Antwort werden `vkStunde` und `aufschlag` **deterministisch
  überschrieben** (`validateAndFix` in analyze, `applyUserRates` in optimize) —
  den KI-Zahlen nie vertrauen.
- Stundensätze werden per **`normalizeKsId(code)`** zugeordnet (NIE über
  `bezeichnung`, NIE über rohen Code — Code/Bezeichnung/Legacy-IDs weichen ab;
  war Ursache mehrerer Vorfälle).
- 15 feste Standard-Kostenstellen. Eigene Kostenstellen sind zusätzlich erlaubt
  (per `bezeichnung` gekeyt), mit Anti-Doppelzählungs-Regel im Prompt.
- **Deaktivierte** Kostenstellen werden komplett ausgeschlossen (Frontend sendet
  `deaktivierteKostenstellen`); kein Rückfall mehr auf den Standardsatz.
- **Bauweise-Vault** (`bauweise_regeln`, pro `user_id`): gelernte Wenn-Dann-Regeln des
  Nutzers werden **serverseitig** geladen und als **letzter** Block an den System-Prompt
  von analyze und optimize gehängt, mit ausdrücklichem Vorrang-Satz. Reihenfolge ist
  funktional — vor dem Standardwissen wäre der Block wirkungslos.
- Der Vault beeinflusst **nie** `vkStunde`, `aufschlag` oder Preise. Nur Bauweise,
  Material, Konstruktion, Zeitgefühl.
- Der Vault wird **nie** über Nutzer hinweg aggregiert oder geteilt — strikt getrennt von
  `benchmark_zustimmung` / `include_in_benchmark`.
- Regelkandidaten aus der KI haben **Belegpflicht**: ohne gültigen Verweis auf einen
  Code-Diff-Eintrag oder ein wörtliches Chat-Zitat werden sie verworfen
  (`pruefeKandidaten` in `src/lib/learn.ts`). Gleiche Haltung wie bei den KI-Zahlen.
- Lernen darf Speichern und PDF-Export **nie** blockieren.

## Preisfaktor & Zeitfaktoren (Stand 2026-09-16)
- **Zwei verschiedene Hebel, nie verwechseln.** Zeitfaktoren (`kalibrierung.ts`) ändern
  die Minuten — und damit „Stunden gesamt" und den Export. Der **Preisfaktor**
  (`src/lib/preisfaktor.ts`) multipliziert nur den Endpreis der Position, Material und
  Lohn zusammen; Stunden, Stundensätze und Aufschläge bleiben unberührt.
- **Grenzen:** Zeitfaktoren von Hand 0,50–3,00 (`deckeleHand`), Ableitung aus den
  Kalibrierungsantworten unverändert 0,6–1,4 (`deckele` — die fünf Antwortbänder sind
  genau darauf zurückgerechnet). Preisfaktor 0,50–3,00, Standard 1,00.
- **Gestempelt, nicht nachgeschlagen:** `Angebotsposition.preisfaktor` wird gesetzt, wenn
  die Position entsteht (analyze nach `validateAndFix`, optimize in `applyUserRates`,
  manuell in `defaultAngebotspos`). Bestehende Faktoren werden nie überschrieben — ein
  verschicktes Angebot darf sich nicht rückwirkend verändern.
- **Eine Rechenstelle:** `calcAngebotspos` in `src/lib/types.ts`. Wer selbst multipliziert,
  bringt App, PDF und Export auseinander. Ein kaputter Wert gilt als 1,00 (ein NaN würde
  sonst die ganze Angebotssumme zerstören).
- Der Preisfaktor geht **nie** in einen KI-Prompt und erscheint **nie** im PDF.
- Speicherort `betriebsprofil.preisfaktor numeric(4,2) not null default 1.00`
  (`docs/sql/2026-09-16-preisfaktor.sql`). Tests: `tests/preisfaktor.test.mjs`.

## Betriebskalibrierung: Referenzprojekte (Stand 2026-09-17)
- **Fünf Referenzprojekte als Daten** in `src/lib/referenzprojekte.ts` (importfrei, `tests/referenzprojekte.test.mjs`):
  Einbauschrank (gemessen), Einbauküche, Innentüren, Treppe, Massivholztisch — je Kunde, ausführlicher
  Text, Grundpositionen und **Varianten als Alternativpositionen** (`alternativ: true`, `variante`).
  Jede Zahl trägt einen Quellenkommentar (CLAUDE.md-Abschnitt, „gemessen“ oder „Annahme: …“).
- **Preise entstehen von unten** (Stückliste × Richtpreise, Zeitrichtwerte × Sätze, Fixsockel). Die
  Faustregeln aus Abschnitt 6.1 sind NUR Kontrolle (`faustregelKontrolle`), nie Vorgabe (Fabian, 17.09.).
- `src/lib/kalibrierung.ts` leitet die Bandbasis aus dem Projekt ab (`referenzAusProjekt`); `REFERENZEN`
  und `REFERENZ` kommen daraus, `SPECS`/`baueReferenz` gibt es nicht mehr. Massiv = Grundmaterial +
  Mehrkosten (nie Ersatz). Die Bandbasis jeder Variantenfrage muss der Preisdifferenz der
  Alternative entsprechen — der Anker („CraftFlow rechnet …“) liegt immer im mittleren Band (Test).
- Route `GET /api/settings/kalibrierung` liefert `referenzprojekt` (mit den Sätzen des Betriebs
  gerechnet, `summen`, `faustregel`, `baender`); `POST …/als-projekt` legt „Referenz: <Name>“ als
  Projekt an (`projektDatenAus`, Datenform wie `saveProject`).
- UI `src/components/settings/ReferenzprojektKasten.tsx`: aufklappbare Kalkulation, Fragen an den
  Positionen (Lack = Aufpreis, Massiv = Gesamtpreis, Montage = Dauer), Faustregel-Zeile, „Als Projekt öffnen“.
- Referenzen NIE aus KI-Läufen bauen: derselbe Text ergibt ±30 % Stunden je Lauf (Vault „KI-Streuung
  und feste Referenzkalkulationen“). Prüfprotokoll: `docs/pruefprotokolle/2026-09-17-kalibrierung-und-checkup.md`.

## Farben / CI (Stand 2026-09-15)
- Zwei Nutzerfarben (`farbe_primaer`, `farbe_akzent` im Betriebsprofil). Alles andere —
  Schrift, Nebentext, Kästen, Rahmen, Kopfzeile — leitet `leitePaletteAb()` in
  `src/lib/theme.ts` daraus ab. **Dunkle** Primärfarbe → heutige Palette byte-identisch;
  **helle** → dunkle Schrift, Flächen leicht abgesetzt. Kontrast ≥ 4,5 ist per Test belegt.
- Alle `C`-Konstanten (types.ts, settings/page.tsx, AppHeader, PricingModal, Lieferanten-,
  EmailSettings) sind CSS-Variablen `var(--c-…, Rückfall)`. **Keine festen Textfarben
  mehr einführen**, die auf `C.black`/`C.gray*` liegen sollen — sonst kippt der Kontrast
  bei hellem Grund wieder (Kundenrückmeldung 15.09.: „Schrift kaum noch lesbar“).
- **Nie** einen Hex-Alpha-Anhang an eine Variable hängen (`${C.copper}55` → ungültiges
  CSS, fällt stumm weg; war 53× im Code). Stattdessen `akzentTon('55')` aus theme.ts.
- Farbcode-Eingabe: das Textfeld ist führend (`FarbFeld` in settings/page.tsx),
  `normalisiereHex()` bereinigt (ohne Raute, klein, Kurzform), Ungültiges wird gemeldet.
  Der Farbwähler von macOS/iOS rechnet eingetippte Codes in ein anderes Farbprofil um —
  Ursache des „Rot wird Lila“ aus derselben Rückmeldung. Server (PATCH betriebsprofil)
  prüft die Codes ebenfalls und antwortet mit 400 + lesbarer Meldung.
- `ThemeLoader` merkt sich die letzte Palette im localStorage (`craftflow-palette`),
  damit ein heller Nutzer nicht bei jedem Laden die dunkle Seite aufblitzen sieht.
- Tests: `tests/theme.test.mjs`.

## Pläne / Deckel / Zugang (Stand 2026-09-16)
- **Eine Quelle:** `src/lib/plaene.ts` — Matrix (Preise netto, Deckel, Funktionen je Plan),
  beide Stripe-Preis-Sätze (`planFuerPreisId`), `effektiverPlan()`, `wendeDeckelAn()`,
  `merkmaleFuerAnzeige()`. Nirgends sonst Preise, Limits oder Plan-Namen hart schreiben.
  Änderungen an der Matrix gehören in `tests/plaene.test.mjs` — bewusst, nicht nebenbei.
- **Der Browser ist nie die Instanz.** Jede Sperre/jeder Deckel steht serverseitig in der
  Route über `src/lib/planpruefung.ts`: `pruefeZugang` (402 wenn `'gesperrt'`),
  `pruefeFunktion` (403 mit `{ error, minPlan }`), `pruefeDeckel`. Texte aus
  `src/lib/plantexte.ts` (rein, getestet). Nie stumm ablehnen.
- **Zugang nach der Testphase:** `effektiverPlan` = Testphase → enterprise; `abo_status
  = 'aktiv'` → gespeicherter Plan; Plan ≠ solo mit gültigem `plan_gueltig_bis` (Gutschein/
  Admin) → dieser Plan; sonst `'gesperrt'`. Webhook setzt `abo_status`; `redeem_coupon`
  setzt `plan_gueltig_bis`. SQL: `docs/sql/2026-09-16-abo-status.sql`.
- **Angebot zählt bei der Analyse** (nicht beim PDF), nur wenn Positionen zurückkommen;
  Deckel wird VOR dem KI-Aufruf geprüft (`src/lib/angebotszaehler.ts`).
- **Deckel wirken beim Lesen:** die ältesten N (nach `created_at`) bleiben aktiv, der Rest
  ist `aktivDurchPlan: false` — nichts wird gelöscht, Upgrade wirkt sofort. Gilt für
  Bauweise-Regeln, Materialpreise; Optimieren-Runden je Projekt in `optimieren_runden`
  (`docs/sql/2026-09-16-plan-deckel.sql`); Dateien je Projekt in analyze.
- **Solo = Standardlayout:** `pdfTextOptionen`/`pdfFirmaOptionen` bekommen den Plan;
  ohne `gestaltung` fallen Layout/Schrift/Briefpapier/Textbausteine/Akzent zurück, Inhalt bleibt.
- **Website:** `scripts/plaene-export.mjs` schreibt `~/craftflow-web/lib/plaene.json`;
  `tests/plaene-website.test.mjs` schlägt an, wenn die Website veraltet ist. Nach jeder
  Matrix-Änderung exportieren und im Website-Repo committen.
- Tests ohne React/Supabase: `plaene.ts`, `plantexte.ts` importieren nur untereinander
  (mit `.ts`-Endung — `allowImportingTsExtensions` ist gesetzt).

## Wünsche-Community (Stand 2026-09-16, abends: Stimmenkonto)
- **Stimmenbudget je Plan** (1 / 3 / 10 / 30) steht als Deckel-Art `wunschStimmen` in
  `src/lib/plaene.ts` — nirgends sonst. Stimmen sind stapelbar: beliebig viele Stimmen
  auf einen Wunsch möglich, alle Stimmen auf ein Thema legen ist erlaubt. Stimmen kommen
  zurück, sobald ein Wunsch fertig, ausgeblendet oder zusammengelegt ist, oder der
  Nutzer sie selbst zurückzieht. Kein monatlicher Nachschub — das Konto ist ein fester
  Vorrat je Plan. Primärschlüssel der Tabelle ist jetzt `id` (nicht mehr
  `(wunsch_id, user_id)`, SQL `docs/sql/2026-09-17-stimmen-stapelbar.sql`).
- **Wechsel nach unten wie überall:** die ältesten N Stimmen bleiben aktiv, weitere
  zählen nicht (`wendeDeckelAn` über `wunsch_stimmen.created_at`). Nichts wird gelöscht.
- **Gezählt wird serverseitig, nie in einer SQL-View:** Ob eine Stimme zählt, hängt am
  Plan ihres Urhebers, und die Plan-Logik steht in `plaene.ts`. Die reine Zählung liegt
  in `src/lib/wuensche.ts` (`stimmenJeWunsch`), getestet in `tests/wuensche.test.mjs`.
- Fremde Stimmen und fremde Betriebsprofile darf niemand lesen (RLS). Die Zählung läuft
  deshalb über den Service-Role-Client (`getSupabaseClient`) und gibt **nur Zahlen** heraus.
- **Status:** `offen | geplant | in_arbeit | fertig | ausgeblendet`. Status setzen,
  zusammenlegen und ausblenden macht ausschließlich `PATCH /api/admin/wuensche/[id]`
  (Fabians E-Mail) — für `authenticated` gibt es bewusst keine update-Policy.
- **Öffentlich** ist nur `GET /api/wuensche/oeffentlich` (`PUBLIC_PATHS`, 5 Minuten Cache,
  ohne Nutzerdaten). Die Website `/roadmap` liest sie mit `revalidate = 300`.
- SQL: `docs/sql/2026-09-16-wuensche.sql` — **mit GRANTs.**

## Settings / Kostenstellen (Regeln & Route)
- **15 Standard-Kostenstellen:** nicht löschbar, nicht umbenennbar — nur Betrag
  ändern oder aus/an. Standard-Erkennung IMMER über `normalizeKsId(code) ∈
  DEFAULT_STUNDENSAETZE` (NIE roher `code` — sonst erscheint der Lösch-Button bei
  Legacy-Codes fälschlich). Gilt im UI (`settings/page.tsx`) UND serverseitig (DELETE blockt).
- **Eigene Kostenstellen:** mit Name + Preis anlegbar, löschbar (× nur bei eigenen);
  werden in der Kalkulation genutzt, wenn die Beschreibung passt.
- **Update-Route ist PUT** (nicht PATCH → 405) und akzeptiert nur `stundensatz` +
  `aktiv` — bewusst KEIN `bezeichnung` (Umbenennen gesperrt). Methoden der
  Kostenstellen-Route: GET (lesen), PUT (stundensatz/aktiv), POST (neu), DELETE (nur eigene).

## Erledigt & auf `main` deployt (2026-07-06/07)
- Fallback-Ergänzung Zuschnitt/Zusammenbau nutzt Nutzer-Stundensatz (statt 72/65).
- Deaktivieren schließt Kostenstelle wirklich aus.
- Eigene Kostenstellen nutzbar, ohne Doppelzählung.
- Standard-Kostenstellen nicht löschbar / nicht umbenennbar; Code-Zeile im UI entfernt.
- Fabians Konto bereinigt: alle 15 Standard-KS vorhanden, Handwerkskammer-Standardsätze,
  saubere Standard-Kurznamen (frühere Umbenennungen zurückgesetzt).
- Alles live auf dev getestet, dann `dev → main` gemerged.

## Offen / für Fabian
- Stundensätze auf die echten Betriebswerte anpassen (stehen aktuell auf
  Handwerkskammer-Standard, der für viele Betriebe zu hoch ist).
- (Frühere Lücke „Zusammenbau fehlt" ist erledigt — wiederhergestellt.)

## Deploy-Workflow (strikt)
Nie direkt auf `main`. Immer: Änderung auf `dev` → live auf dev-Preview testen →
Fabian gibt Freigabe → dann `dev → main` mergen + pushen (Vercel deployt Produktion
automatisch). GitHub-Push ist eingerichtet (gh-CLI, Konto FabianScharf).

## Bekannte Bugs / Stolperfallen

- Base64 URL-Prefix (`data:image/jpeg;base64,...`) muss vor dem API-Call gestripped werden
- Bilder via Canvas API komprimieren vor dem Upload (verhindert 413-Fehler)
- `URL.revokeObjectURL()` erst nach erfolgreichem Upload aufrufen, nicht vorher

## Feature-Prioritäten

1. Neues Start-UI: großer Mic-Button, Foto-Button, einzelner „Generieren"-Button (kein mehrstufiger Flow)
2. Multi-Tenant Onboarding: jeder Handwerker konfiguriert eigenes Logo, CI-Farben, Stundenpreise, Standardpositionen
3. Angebots-Tracking: accepted/negotiated/rejected pro Position und Region → Basis für KI-Preisempfehlungen

## Produkt-Vision

SaaS für Handwerker. Solo-Betrieb, kein Team. Lean und AI-gestützt.
Langfristig: Preisempfehlungen aus aggregierten Angebotsdaten als Differenzierungsmerkmal.

## Corporate Identity

- **Schwarz:** `#0D0D0D`
- **Kupfer:** `#C8885A`
- **Schrift:** Helvetica Neue

## Firmendaten

- **Firma:** FS Crafted
- **Adresse:** Fuldaer Straße 15, 63517 Rodenbach
- **E-Mail:** anfrage@fscrafted.de
- **USt-IdNr.:** DE459348681

---

# CraftFlow Kalkulationsregeln

## Grundprinzip

Ein Angebot besteht aus ANGEBOTSPOSITIONEN (z.B. "TV-Lowboard", "Garderobe").
Jede Position hat intern MATERIAL und ARBEITSZEIT.
Der Kunde sieht nur: Titel, Beschreibung, Gesamtpreis.

## Faustregeln

- 1 Laufmeter Schrank = ca. 1.000 € netto (ohne Montage, ohne Besonderheiten)
- Pro 1.000 € Nettowert = 1 Stunde Montage + Anfahrt
- Anfahrt immer ab: Fuldaer Straße 15, 63517 Rodenbach
- Material-Aufschlag: pauschal 30% (überschreibbar pro Nutzer)

## Oberflächenregel

- Massivholz: Kostenstelle "Oberfläche" IMMER einplanen, zeitintensiver.
  Dafür entfällt "Bekantung".
- Dekormöbel: "Oberfläche" kaum bis gar nicht.
  Dafür "Bekantung" IMMER einplanen.

## Sonderteile-Regel

Folgende Ausstattungen erhöhen immer "Konstruktion":
- Klappen mit Akustikstoff
- Laden aus Massivholz
- LED-Beleuchtung
- Jede weitere Besonderheit an Material oder Mechanik

## Fixkosten pro Position (anteilig immer dabei)

Diese Kostenstellen fallen immer an, anteilig auf die gesamte Position:
- Besprechung
- Planung
- Konstruktion
- Arbeitsvorbereitung

## Kostenstellen und Stundensätze

| Kostenstelle        | €/h |
|---------------------|-----|
| Besprechung         |  65 |
| Planung             |  85 |
| Konstruktion        |  75 |
| Arbeitsvorbereitung |  75 |
| Produktion          |  65 |
| Warenhandling       |  65 |
| Zuschnitt           |  72 |
| Bekantung           | 100 |
| CNC                 | 120 |
| Oberfläche          |  72 |
| Zusammenbau         |  65 |
| Verpacken           |  65 |
| Azubi               |  52 |
| Montage             |  65 |
| Lieferung           |  65 |

## Pflichtfragen der KI vor jeder Kalkulation

Die KI MUSS folgende Punkte klären bevor sie kalkuliert.
Auch wenn einzelne Punkte bereits genannt wurden, trotzdem nochmal bestätigen:

1. **OBERFLÄCHE/MATERIAL:** Massivholz oder Dekormöbel? Welche Holzart/Dekor?
2. **MASSE:** Breite × Höhe × Tiefe in mm – falls nicht vollständig genannt
3. **AUSSTATTUNG:** Anzahl Schubladen, Türen, Klappen – und gibt es weitere
   Besonderheiten? (LED, Akustik, Sondermaterialien, Mechaniken)
4. **MONTAGE:** Lieferadresse des Kunden für Anfahrtsberechnung

## Verhalten bei Unklarheit

- Lieber einmal zu viel fragen als falsch kalkulieren
- Keine Annahmen ohne Bestätigung bei Oberfläche, Maßen und Sonderausstattung
- Bei unvollständigen Angaben: STOPP und Rückfrage, nicht weitermachen

## MÖBELTYP-FACHWISSEN

### Küche
- Korpusse: immer Türen oder Schubladenfront, NIE Klappen
- Hängeschränke: immer Türen, NIE Klappen
- Schubladen: haben Fronten, keine eigene Tür
- Spülenschrank, Herdschrank, Spülmaschinenkorpus: Sonderpositionen
- LED-Beleuchtung: Sonderposition, erhöht Konstruktion

### Schrank / Garderobe
- Kann Türen, Klappen oder offen sein
- Klappen typisch bei: Oberschränken, Akustikpanelen, Stauraum

### Sideboard / Lowboard
- Türen oder Klappen möglich
- Schubladen möglich

### REGEL: Wenn Kunde sagt "ergänze den Rest"
- NICHT weiter nachfragen
- Erfahrungswerte verwenden
- Im Angebot vermerken: "(Position nach Aufmaß anpassen)"

## Nutzereinstellungen (SaaS-Prinzip)

Alle Stundensätze der Kostenstellen sind NICHT fest im Code.
Sie werden pro Nutzer in den Einstellungen hinterlegt und gespeichert.
Die Werte in dieser Datei sind nur STANDARD-VORGABEN für neue Nutzer.

Jeder Nutzer kann einstellen:
- Stundensatz pro Kostenstelle (überschreibt den Standard)
- Material-Aufschlag in % (Standard: 30%)
- Eigene Firmenadresse (für Anfahrtsberechnung)

Beim ersten Start wird der Nutzer durch einen Einrichtungs-Wizard geführt:
1. Firmenname und Adresse
2. Stundensätze pro Kostenstelle (mit Standard-Vorgaben vorausgefüllt)
3. Material-Aufschlag

Diese Einstellungen werden in der Datenbank gespeichert und bei jeder
Kalkulation verwendet – niemals die hardcodierten Werte aus dem Code.

## PDF-LAYOUT-REFERENZ

Das Referenz-PDF liegt unter: **craftflow-app/docs/reference/angebot_referenz.pdf**
(nicht docs/reference/ — dort ist es nicht).

Lesen: `poppler` ist nicht installiert, das Read-Tool kann es nicht rendern. Im
ferngesteuerten Chrome per `file://` öffnen und einen Screenshot machen.

VOR JEDER Änderung an lib/pdf.ts MUSS dieses PDF gelesen werden:
- Vergleiche jeden Element-Typ mit der Referenz
- Baue NUR nach was dort steht
- NICHTS erfinden, NICHTS hinzufügen

Checkliste vor jedem PDF-Commit:
[ ] Logo: nur Bild, kein zusätzlicher Text darunter — mit max-width, sonst läuft
    ein Querformat-Logo über den Seitenrand (Fehler von 2026-09-08)
[ ] Header: Logo rechts, Absenderzeile links, keine Trennlinie
[ ] Adressblock: Name, Straße, PLZ Ort - kein Zusatz
[ ] Positionstabelle: Pos | Bezeichnung | Gesamt.
    **Menge und Einheitspreis sind einstellbar** (Briefpapier → Gestaltung),
    standardmäßig aus. Die Referenz zeigt sie — deshalb sind sie möglich, aber
    manche Betriebe weisen bewusst nur Endsummen aus. Reihenfolge WIE IN DER
    REFERENZ: Pos · Menge · Bezeichnung · Einheitspreis · Gesamt.
    Keine Kostenstellen.
[ ] Positionstitel steht GENAU EINMAL. Eine Gruppenkopfzeile entsteht nur, wenn
    die Position ein Feld `gruppe` trägt (Fehler von 2026-09-08: Der Titel stand
    hart in beiden Zeilen).
[ ] Alle Textfelder laufen durch `alsAbsaetze()` — sonst verschwinden Absätze
    (Fehler von 2026-09-08: sechs von acht Feldern)
[ ] Summenblock: Netto, MwSt, Gesamt - rechtsbündig.
    Bei Kleinunternehmern nach § 19 UStG **keine** MwSt-Zeile, dafür der Hinweis.
[ ] Footer: Dokumentnummer links, Firmendaten mitte, Seite rechts.
    USt-IdNr. ODER Steuernummer (§ 14 UStG verlangt eines von beiden).
[ ] KEINE Elemente die nicht im Referenz-PDF sind — **mit einer Ausnahme:** Der
    Unterschriftsblock steht nicht in der Referenz, ist aber abschaltbar
    (`pdf_zeige_unterschrift`). Was abschaltbar ist, darf zusätzlich da sein.

**Grundsatz für alles am PDF** (mit Fabian abgestimmt, 2026-09-08):
Würde irgendjemand die andere Variante freiwillig wählen? Ja → Einstellung.
Nein → Fehler, und der wird behoben, nicht zur Wahl gestellt.

---

## Große Projekte in Blöcken (Stand 2026-09-16)
- **Nichts wird stumm gekürzt.** Die alte 10.000-Zeichen-Grenze in `/api/analyze` gilt nur
  noch für kleine Projekte ohne Dateien. Große Projekte laufen über
  `POST /api/upload` → `POST /api/analyze/vorbereiten` → `POST /api/analyze/block` (je Block).
- **Die reine Teil-Logik liegt in `src/lib/bloecke.ts`** (importfrei, `tests/bloecke.test.mjs`):
  schneiden (≤ 8.000 Zeichen, ≤ 8 Positionen, ≤ 6 Bilder), Kontext bauen, Positionen vereinigen, Dubletten
  finden. Der Test prüft nicht nur die Schnittstellen, sondern dass sich der Ausgangstext
  wieder zusammensetzen lässt — das ist die Gegenprobe gegen stilles Wegwerfen.
- **Schnittregel:** Positionsnummer vor Seitengrenze vor Absatz. Eine einzelne überlange
  Zeile bildet ihren eigenen Block — lieber ein zu großer Block als eine verschwundene Zeile.
- **Höchstens 8 Positionen je Block** (`MAX_POSITIONEN_JE_BLOCK`). Grund: Bei ~30 Positionen wurde die KI-Antwort abgeschnitten (max_tokens) und das JSON war unlesbar — Live-Test 16.09. (16.09.: 12 Positionen brauchten 191 s und 14.483 Ausgabe-Tokens) Die Route loggt `stop_reason` und `usage` nur serverseitig; Kosten und Token erscheinen nie in einer API-Antwort.
- **Block 1 trägt Kunde, Kopfdaten und die Gemeinpositionen.** Folgeblöcke bekommen den
  Kontext (`baueKontext`) und die feste Prompt-Regel `BLOCK_REGEL` — ein eigener,
  unveränderlicher System-Block, damit `cache_control` greift. Nutzertext gehört nie hinein.
- **Jeder Block reserviert ein Angebot** (`reserviere_angebot` VOR dem KI-Aufruf); ohne
  Positionen wird es wieder freigegeben. Sieben Blöcke = sieben Angebote.
- **Dateien liegen im privaten Bucket `projektdateien`**, Pfad `<user_id>/<projekt_id>/<uuid>-<name>`,
  eine Anfrage je Datei (damit fällt die 4,5-MB-Wand von Vercel). Dateien mit führendem
  Unterstrich sind interne Zwischenstände (`_vorbereitet.json`) und zählen nicht gegen den
  Dateien-Deckel. SQL: `docs/sql/2026-09-16-bloecke-storage.sql` — **mit GRANTs.**
- **Dubletten werden gemeldet, nie verschmolzen.** Zwei gleich benannte Möbel mit gleichen
  Maßen können zwei echte Möbel sein; automatisch zusammengelegt wäre das Angebot
  stillschweigend zu billig.
- `src/app/api/analyze/gemeinsam.ts` hält `SYSTEM_PROMPT` und `validateAndFix` — beide
  Analyse-Routen lesen dort. Zwei Kopien des Systemprompts wären der sichere Weg in
  auseinanderlaufende Kalkulationen.
