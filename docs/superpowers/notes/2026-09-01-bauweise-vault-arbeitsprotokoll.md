# Bauweise-Vault — Arbeitsprotokoll und offener Stand

**Stand:** 2026-09-01 · **Branch:** `dev` = `952bc24` · **`main`:** enthält das Feature NICHT

Dauerhafte Sicherung des Arbeitsprotokolls, das während der Umsetzung in einem
git-ignorierten Ordner lag (`.superpowers/sdd/2026-07-31-lernfunktion-bauweise-vault/`).
Dort liegen zusätzlich alle Einzelberichte und Review-Diffs — die gehen beim Aufräumen
verloren, dieses Dokument nicht.

Zugehörig: `docs/superpowers/specs/2026-07-31-lernfunktion-bauweise-vault-design.md`
(Design) und `docs/superpowers/plans/2026-07-31-lernfunktion-bauweise-vault.md` (Umsetzung).
Die Engine-Invarianten stehen in der Projekt-`CLAUDE.md`.

---

## 0. Live-Test bestanden (2026-09-05)

Alle sechs Schritte auf der dev-Preview durchgefuehrt, mit zwei getrennten Konten.

| # | Pruefung | Ergebnis |
|---|---|---|
| 1 | Angebot ohne Regeln unveraendert | bestanden |
| 2 | Lern-Dialog kommt, mit Beleg aus dem Chat | bestanden |
| 3 | Regel sichtbar unter Einstellungen -> Meine Bauweise | bestanden |
| 4 | Neues Angebot uebernimmt die Regel von allein | bestanden |
| 5 | Regel abschalten -> Rueckfall auf KI-Standard | bestanden |
| 6 | Zweites Konto sieht die Regel NICHT | bestanden |

Zu 5: Nach dem Abschalten kam HDF 8 mm statt der urspruenglichen 6 mm. Kein Fehler —
die Staerke war nie Teil der Regel, die KI waehlt sie projektabhaengig (Garderobenschrank
2600x2400 statt Kuechenunterschrank 600). Entscheidend ist das Material: HDF statt
Spanplatte, also greift die Regel nicht mehr.

### Dabei gefundener Fehler: fehlende Tabellenrechte (behoben)

`POST /api/settings/bauweise` schlug reproduzierbar fehl ("Eine Regel konnte nicht
gespeichert werden"). Ursache durch Vergleich mit der funktionierenden Tabelle `projects`
gefunden:

| Tabelle | Rechte fuer `authenticated` |
|---|---|
| `projects` | DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE |
| `bauweise_regeln` | REFERENCES, TRIGGER, TRUNCATE |

Es fehlten SELECT, INSERT, UPDATE, DELETE. Supabase vergibt sie bei neuen Tabellen nicht
zuverlaessig automatisch. Behoben per `grant ... to authenticated` und dauerhaft in
`docs/sql/2026-07-31-bauweise-regeln.sql` aufgenommen.

Ein Schema-Reload (`notify pgrst`) war NICHT die Ursache — als erste Hypothese geprueft
und verworfen.

### Offene Punkte aus dem Test

1. **Lern-Dialog sitzt am falschen Ort** (Fabian, 2026-09-05): Die Abfrage gehoert in die
   KI-Optimierung, nicht an den Speichern-Schritt. Revidiert die Entscheidung vom
   2026-07-31 ("gesammelt beim Speichern, ein Dialog"). Umbau vor dem main-Merge.
2. **Fehlermeldungen werden verschluckt**: Das Frontend zeigt nur "konnte nicht gespeichert
   werden", die echte Ursache aus `error.message` bleibt unsichtbar. Hat bei der Suche
   nach dem Rechte-Fehler rund 20 Minuten gekostet.
3. **KI verspricht zu frueh**: Im Chat antwortet sie "Ich merke mir das als deinen
   Standard" — gespeichert wird aber erst nach Bestaetigung im Dialog.

---

## 1. Was noch zu tun ist

| # | Schritt | Wer |
|---|---|---|
| 1 | `docs/sql/2026-07-31-bauweise-regeln.sql` im Supabase-Dashboard ausführen | Fabian |
| 2 | Live-Test auf der dev-Preview (6 Schritte, siehe unten) | gemeinsam |
| 3 | Zweites Testkonto anlegen (`/register`, `solo` genügt) für den Trennungstest | Fabian |
| 4 | Nach Freigabe: `dev → main` mergen | nach Fabians OK |

**Das SQL ist das Gate.** Ohne die Tabelle zeigt der Lern-Dialog Vorschläge, die sich nicht
speichern lassen. Der Rest der App ist unberührt — der Code ist sicher deploybar, bevor das
SQL läuft (Analyse, Optimierung, Speichern, PDF laufen alle unverändert weiter).

### Live-Test-Reihenfolge

Adresse: `https://craftflow-git-dev-fabian-scharf-s-projects.vercel.app`

1. Angebot ohne eigene Regeln → alles muss wie bisher sein
2. Rückwand ändern + im Chat „nie HPL, immer 8mm Multiplex" → nach dem Speichern **ein**
   Dialog mit sichtbarem Beleg
3. Regel anhaken → erscheint unter *Einstellungen → Meine Bauweise*
4. **Neues** Angebot mit Rückwand → Rückwand ist von allein Multiplex. **Das ist der Beweis.**
5. Regel abschalten → nächstes Angebot fällt auf HPL zurück
6. Zweites Konto → sieht **keine** Regeln des ersten. Wichtigster Test.

Zusätzlich prüfen, ob `gesendet_zahl` beim *nächsten* Angebot hochzählt — das ist der einzige
Beweis, dass `after()` auf Vercel wirklich feuert; lokal nicht verifizierbar.

---

## 2. Wie es gebaut ist

```
1. /api/analyze liefert Vorschlag → Frontend legt tiefe Kopie in kiVorschlagRef
2. Nutzer arbeitet (Chat, Check-Panel, Felder) — keine Unterbrechung
3. Speichern / Rückkehr aus der PDF-Vorschau:
   POST /api/learn/candidates → diffOffer (Rauschfilter) → KI formuliert
   → pruefeKandidaten verwirft alles ohne gültigen Beleg
4. EIN Dialog mit Häkchen → Nutzer bestätigt
5. POST /api/settings/bauweise → bauweise_regeln (pro user_id, RLS)
6. Ab dem nächsten Angebot: Regelblock als LETZTER Anhang am System-Prompt
   von analyze und optimize, mit ausdrücklichem Vorrang-Satz
```

**Dateien:** `src/lib/learn.ts` (rein, importfrei, 45 Tests), `src/lib/bauweise.ts` (DB),
`src/app/api/learn/candidates/route.ts`, `src/app/api/settings/bauweise/route.ts`,
`src/components/settings/BauweiseSettings.tsx`, Eingriffe in `src/app/page.tsx`,
`src/app/api/analyze/route.ts`, `src/app/api/optimize/route.ts`.

**Verifikation zuletzt:** 45/45 Tests, `npx tsc --noEmit` Exit 0, Vercel-Build erfolgreich.

---

## 3. Entscheidungen von Fabian

| Datum | Frage | Entscheidung |
|---|---|---|
| 2026-07-31 | Lern-Modus | Nachfragen, nie stillschweigend |
| 2026-07-31 | Signalquellen | Optimieren-Chat, Angebots-Check, manuelle Feldänderungen |
| 2026-07-31 | Regel-Tiefe | Mit Bedingung (Wenn → Dann), „gilt immer" möglich |
| 2026-07-31 | Vault-Form | Eigener Reiter in den Einstellungen, editierbar |
| 2026-07-31 | Zeitpunkt | Gesammelt beim Speichern, ein Dialog |
| 2026-07-31 | Erkennung | Hybrid: Code liefert Fakten, KI formuliert |
| 2026-07-31 | Beleg-Strenge | **Streng:** mind. 6 Zeichen UND ganze Wortfolge |
| 2026-08-01 | PlanGate am Vault | **Kein PlanGate** — in allen Tarifen, hebt die Produktqualität insgesamt |
| 2026-08-02 | Mehrere „gilt immer"-Regeln je Bereich | **Immer-Regeln nie als Dublette werten** |

---

## 4. Die folgenreichsten Befunde aus den Prüfungen

Elf ernsthafte Fehler wurden abgefangen, die meisten im Plan, nicht im Code. Die wichtigsten,
weil sie erklären, warum der Code so aussieht wie er aussieht:

1. **`kiVorschlagRef` wurde nie zurückgesetzt.** Nach „Neues Angebot" oder dem Laden eines
   Projekts wäre gegen den Erstvorschlag des *vorigen* Angebots verglichen worden — der Diff
   wäre Müll, und die Regeln daraus kamen **vorangehakt**. Ein Klick hätte den Vault dauerhaft
   vermüllt. Behoben in `resetAll`, `loadProject`, `restoreVersion` und `lernDialogSchliessen`.
2. **Dialog fragte bei jedem Speichern erneut** — samt bezahltem KI-Aufruf. Gelöst dadurch,
   dass `lernDialogSchliessen` den Ref leert: ein Angebot, eine Frage.
3. **Beleg-Prüfung war aushebelbar** (3 Zeichen reichten, „die" hätte genügt). Jetzt 6 Zeichen
   plus ganze Wortfolge (`enthaeltWortfolge`).
4. **PDF-Trigger feuerte auf einem Bildschirm, auf dem der Dialog nicht gerendert wird** —
   er wäre später aufgetaucht, ggf. mit Vorschlägen eines anderen Angebots. Jetzt im
   „← Zurück"-Handler der PDF-Vorschau.
5. **Bestätigte Regeln gingen still verloren**, wenn Speichern scheiterte. Jetzt `res.ok` pro
   Regel, Dialog bleibt offen, deutsche Meldung, bereits gespeicherte werden nicht doppelt
   angelegt (`lernErledigt`).
6. **Regel-Identität (`bereich`, `wenn`) erlaubte nur EINE Immer-Regel je Bereich** — sechs
   im ganzen Betrieb. Nach Fabians Entscheidung zählt leeres `wenn` nie als Identität.
   Folgefehler davon (totes Warndreieck + vorangehaktes Widerspruchs-Risiko) behoben durch
   `weitereImmerRegel`.

**Bestätigte Eigenschaften** (mehrfach geprüft, u. a. mit dem stärksten Modell):
Mandantentrennung lückenlos (jede Abfrage auf `user_id`, RLS als zweites Schloss,
`security invoker`); Regelblock ist beweisbar der letzte Prompt-Anhang; Nutzer ohne Regeln
bekommt einen byte-identischen Prompt wie vor dem Feature; Lernen kann Speichern und PDF
nicht blockieren; `/api/learn/candidates` liefert auf jedem Pfad 200 außer 401.

---

## 5. Bewusst offen gelassen (nicht blockierend)

- **Semantische Belegprüfung:** Es wird geprüft, *dass* eine zitierte Änderung existiert,
  nicht ob sie inhaltlich zur Regel passt. Abgesichert dadurch, dass der Dialog den Beleg
  zeigt und jeder Kandidat bestätigt werden muss. Bewusst so — die Alternative wäre ein
  zweites KI-Urteil, also eine unsichtbare Schwäche statt einer sichtbaren.
- **Lern-Dialog, `wenn`-Feld editierbar:** Leert man das Feld eines mit ⚠ markierten
  Kandidaten, wird die bestehende bedingte Regel per UPDATE zur Immer-Regel. Verhalten wie
  vorher, passt aber nicht mehr zum neuen Invariant. Beim nächsten Durchgang aufräumen.
- **Plan-Codeblock für `pruefeKandidaten`** enthält den Batch-Dedup nicht (Divergenz zum
  Code). Nur relevant, falls jemand den Plan als Vorlage nimmt.
- **`MODULE_TYPELESS_PACKAGE_JSON`-Warnung** bei `npm run test`. Fix wäre `"type":"module"`
  repo-weit — Risiko für den Next-Build, nicht wert.
- Literal-Hexfarben außerhalb der `C`-Palette; `{ok:true}` bei 0 betroffenen Zeilen;
  `loadRegeln` ohne try/catch; kein Lade-Indikator pro Zeile.
- **`konflikt_hinweis` wird beim Vorschlagen gesetzt**, nicht erst beim Bestätigen. Lehnt
  Fabian einen Kandidaten ab, bleibt das Warndreieck an der bestehenden Regel stehen, bis er
  sie bearbeitet. Spec-konform, aber beim ersten Mal überraschend.

---

## 6. Umgebungswissen, das Zeit spart

- **Die App läuft lokal nicht.** `.env.local` enthält nur leere Platzhalter.
- **`npm run build` läuft lokal auch nicht** — bricht vorbestehend bei
  `/api/stripe/checkout` ab (fehlende Stripe-Keys). Lokaler Typecheck ist
  **`npx tsc --noEmit`**.
- **`npm run lint` hat keine saubere Basis** — 513 Bestandsfehler in fremden Dateien.
  Verbindlich ist `npx eslint <geänderte Dateien>`.
- **`npm run test`** läuft über Nodes eigenen Test-Runner; Node 24 führt die TypeScript-
  Dateien direkt aus. Deshalb ist **kein** Test-Paket installiert und `src/lib/learn.ts`
  importiert absichtlich **nichts**. Wer dort einen Import ergänzt, macht die Tests
  unausführbar.
- `node --test tests/` schlägt fehl; nötig ist die Glob-Form
  `node --test "tests/**/*.test.mjs"`.
