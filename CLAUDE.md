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

Das Referenz-PDF liegt unter: docs/reference/angebot_referenz.pdf

VOR JEDER Änderung an lib/pdf.ts MUSS dieses PDF gelesen werden:
- Lies das PDF mit Read tool
- Vergleiche jeden Element-Typ mit dem Referenz
- Baue NUR nach was dort steht
- NICHTS erfinden, NICHTS hinzufügen

Checkliste vor jedem PDF-Commit:
[ ] Logo: nur Bild, kein zusätzlicher Text darunter
[ ] Header: Logo rechts, Absenderzeile links, keine Trennlinie
[ ] Adressblock: Name, Straße, PLZ Ort - kein Zusatz
[ ] Positionstabelle: Pos | Bezeichnung | Gesamt - keine Kostenstellen
[ ] Summenblock: Netto, MwSt, Gesamt - rechtsbündig
[ ] Footer: Dokumentnummer links, Firmendaten mitte, Seite rechts
[ ] KEINE Elemente die nicht im Referenz-PDF sind
