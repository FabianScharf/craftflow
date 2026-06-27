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

`GEMINI_API_KEY` is required for `/api/analyze`. For local dev, add it to `.env.local`. On Vercel it is set as an environment variable in the project settings.

## AI integration

Model: `gemini-1.5-flash`. Prompt is German-only and returns structured JSON parsed directly — no markdown wrapper expected. The route strips backtick fences as a fallback.

## Deployment

Push to `main` → Vercel auto-deploys. Live URL: `https://craftflow-sable.vercel.app`

No CI pipeline. To trigger a redeploy without code changes: `git commit --allow-empty -m "..." && git push`

## Language

UI and all user-facing strings are German only. Keep them German.

## API Migration (geplant)

Aktuell: `gemini-1.5-flash` via `GEMINI_API_KEY`
Geplant: Migration zu Groq (Whisper für Voice + Llama für Analyse)
Grund: Gemini Free Tier funktioniert nicht in der Schweiz; Groq ist kostenlos, keine Kreditkarte erforderlich.
Route die geändert wird: `src/app/api/analyze/route.ts`

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
