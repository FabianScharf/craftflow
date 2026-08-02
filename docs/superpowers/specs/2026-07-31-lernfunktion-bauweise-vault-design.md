# Lernfunktion: Bauweise-Vault pro Nutzer

**Datum:** 2026-07-31
**Status:** Design freigegeben, Umsetzung offen
**Branch-Ziel:** `dev` → nach Freigabe `main`

## Problem

CraftFlow kalkuliert mit generischen Schreiner-Standardwerten aus dem System-Prompt
(z. B. 6 mm HPL-Rückwand). Nutzer, die anders bauen, korrigieren dieselbe Stelle in
jedem Angebot neu. Die Korrektur verpufft — CraftFlow weiß beim nächsten Angebot
wieder nichts davon.

Ziel: Wenn ein Nutzer eine Bauweise-Entscheidung korrigiert, erkennt CraftFlow das,
fragt einmal nach, und wendet die bestätigte Regel ab dem nächsten Angebot von selbst
an. Pro Nutzer getrennt.

## Nicht-Ziele

Bewusst ausgeschlossen, weil es die bestehende Kalkulations-Engine untergraben würde:

- **Keine Stundensätze lernen.** Gehören in `kostenstellen`, werden dort exakt gesetzt.
- **Keine Materialaufschläge lernen.** Gehören in `materialgruppen`.
- **Keine Preise lernen.** Preis = Zeit × Satz, deterministisch aus der Engine.
- **Kein Lernen über Nutzer hinweg.** Der Vault wird nie aggregiert, nie geteilt.
  Strikt getrennt von der Benchmark-Funktion (`benchmark_zustimmung`,
  `include_in_benchmark` in `src/app/api/tracking/route.ts`), die bewusst anonymisiert
  über Nutzer hinweg auswertet.

## Entscheidungen (mit Fabian abgestimmt)

| Frage | Entscheidung |
|---|---|
| Lern-Modus | Nachfragen, dann merken — nie stillschweigend |
| Signalquellen | Optimieren-Chat, Angebots-Check-Panel, manuelle Feldänderungen |
| Regel-Tiefe | Mit Bedingung (Wenn → Dann), „gilt immer" möglich |
| Vault-Form | Eigener Reiter in den Einstellungen, editierbar |
| Zeitpunkt der Nachfrage | Gesammelt beim Speichern / PDF-Export, ein Dialog |
| Erkennungs-Ansatz | Hybrid: Code liefert Fakten, KI formuliert Regel |

## Datenmodell

### Tabelle `bauweise_regeln`

```sql
create table bauweise_regeln (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  bereich       text not null,              -- Material | Konstruktion | Zeit | Oberfläche | Montage | Sonstiges
  wenn          text default '',            -- leer = gilt immer
  dann          text not null,
  herkunft      text not null,              -- 'gelernt' | 'manuell'
  quelle_text   text default '',            -- z.B. 'Angebot "Garderobe Müller", 31.07.2026'
  beleg         text default '',            -- der Diff-Eintrag / das Chat-Zitat, das die Regel begründet
  aktiv         boolean not null default true,
  gesendet_zahl integer not null default 0, -- wie oft in einen Prompt eingeflossen
  zuletzt_gesendet timestamptz,
  konflikt_hinweis boolean not null default false, -- true, wenn erneut widersprüchlicher Kandidat auftauchte
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index bauweise_regeln_user_idx on bauweise_regeln (user_id, aktiv);

alter table bauweise_regeln enable row level security;

create policy "eigene Regeln lesen"    on bauweise_regeln for select using (auth.uid() = user_id);
create policy "eigene Regeln anlegen"  on bauweise_regeln for insert with check (auth.uid() = user_id);
create policy "eigene Regeln ändern"   on bauweise_regeln for update using (auth.uid() = user_id);
create policy "eigene Regeln löschen"  on bauweise_regeln for delete using (auth.uid() = user_id);
```

**Zur RLS-Policy:** Im Repo liegen keine SQL-Migrationen — das Schema wird direkt im
Supabase-Dashboard gepflegt. Das SQL oben muss dort einmal ausgeführt werden. Die
bestehenden Tabellen sichern die Mandantentrennung derzeit über die Route-Logik
(`.eq('user_id', user.id)` in jeder Abfrage, siehe
`src/app/api/settings/kostenstellen/route.ts:14`). Für `bauweise_regeln` kommt RLS als
zweites Schloss dazu: dann hält die Trennung auch, falls eine Route das `.eq()` vergisst.

### Mandantentrennung

- Jede Regel hängt an einer `user_id`. Es gibt keine globalen oder geteilten Regeln.
- `user_id` wird immer aus der Session gelesen (`supabase.auth.getUser()`), **niemals**
  aus dem Request-Body.
- Neuer Nutzer = leerer Vault = heutiges Verhalten. Kein Sonderfall im Code, kein
  Kaltstart-Problem.

## Ablauf

```
1. /api/analyze liefert Vorschlag
   → Frontend legt unveränderte Kopie in einen Ref (kein DB-Eintrag)

2. Nutzer arbeitet: Chat, Check-Panel, manuelle Feldänderungen
   → keine Unterbrechung, keine Nachfrage

3. Speichern / PDF-Export
   → POST /api/learn/candidates { kiVorschlag, endstand, chatVerlauf, projektTitel }
     chatVerlauf = Nutzer-Nachrichten aus BEIDEN Panels: Optimieren-Chat
     (optimMessages) und Angebots-Check (checkMessages), nur role === 'user'
   → Code-Diff → belegte Änderungsliste
   → KI formuliert Regelkandidaten mit Pflicht-Beleg
   → Server verwirft unbelegte Kandidaten

4. Ein Dialog mit Häkchen → Nutzer wählt aus, passt „Wenn" an

5. POST /api/settings/bauweise → Regeln im Vault
   → ab dem nächsten Angebot Teil des Prompts in analyze UND optimize
```

## Erkennung (Hybrid-Ansatz)

### Schritt 1: Code-Diff — `src/lib/learn.ts`

Reine Funktionen, keine Datenbank, kein Netzwerk. Damit lokal ohne Keys testbar
(die App läuft lokal nicht, siehe Projekt-CLAUDE.md „Lokale Umgebung & Testen").

```ts
type Aenderung =
  | { nr: number; art: 'material_ersetzt';      position: string; vorher: string; nachher: string }
  | { nr: number; art: 'material_entfernt';     position: string; vorher: string }
  | { nr: number; art: 'material_neu';          position: string; nachher: string }
  | { nr: number; art: 'kostenstelle_entfernt'; position: string; kostenstelle: string }
  | { nr: number; art: 'kostenstelle_neu';      position: string; kostenstelle: string }
  | { nr: number; art: 'minuten_geaendert';     position: string; kostenstelle: string; vorher: number; nachher: number }
  | { nr: number; art: 'menge_geaendert';       position: string; material: string; vorher: number; nachher: number }

function diffOffer(kiVorschlag: Offer, endstand: Offer): Aenderung[]
```

**Rauschfilter — der kritische Teil.** Ohne ihn entsteht bei jedem Angebot Regel-Müll:

- `minuten_geaendert` nur bei **≥ 25 % Abweichung UND ≥ 15 Minuten** absolut.
- `menge_geaendert` nur bei **≥ 20 % Abweichung**.
- **Ignoriert:** `vkStunde`, `aufschlag`, alle Preisfelder. Die werden nach jeder
  KI-Antwort deterministisch überschrieben (`validateAndFix` in analyze,
  `applyUserRates` in `src/app/api/optimize/route.ts:57`) — Abweichungen dort sind
  Engine-Artefakte, keine Entscheidungen des Nutzers.
- **Ignoriert:** Kundendaten, Positions-Titel, Beschreibungstexte.
- Positionen werden über ihre `id` gepaart; Material und Arbeitszeit über `id`, bei
  fehlender `id` über normalisierte `bezeichnung` / `kostenstelle`.
- Positionen, die im Endstand komplett neu sind oder fehlen, erzeugen keine
  Material-/Zeit-Änderungen (nur Rauschen — eine gelöschte Position sagt nichts über
  Bauweise).

### Schritt 2: KI formuliert

Ein Call an `claude-sonnet-4-6`, `temperature: 0`, kleines `max_tokens`. Input: nur die
belegte Änderungsliste (nummeriert) plus die Chat-Sätze des Nutzers. Output: JSON-Array.

```json
[{
  "bereich": "Material",
  "wenn": "Korpus mit Rückwand",
  "dann": "Rückwand 8mm Multiplex Birke, kein HPL",
  "belegt_durch": { "art": "diff", "nr": 2 }
}, {
  "bereich": "Konstruktion",
  "wenn": "",
  "dann": "LED-Profil immer als eigene Position ausweisen",
  "belegt_durch": { "art": "zitat", "text": "LED bitte immer separat ausweisen" }
}]
```

### Schritt 3: Belegpflicht — die Absicherung gegen Halluzination

Der Server prüft jeden Kandidaten:

- `belegt_durch.art === 'diff'` → `nr` muss in der Änderungsliste existieren.
- `belegt_durch.art === 'zitat'` → `text` muss in einer Nutzer-Chat-Nachricht vorkommen
  (normalisiert: Kleinschreibung, Mehrfach-Leerzeichen zusammengefasst), und zwar unter
  **zwei** Bedingungen gleichzeitig: mindestens **6 Zeichen** lang UND als **vollständige
  Wortfolge** (Wortgrenzen an beiden Enden), nicht als beliebiger Teilstring.
  Begründung: Ohne Mindestlänge genügt ein Alltagswort wie „die", das in fast jeder
  Nachricht steht; ohne Wortgrenze trifft „machen" auch mitten in „Maschinen". Beides
  wären Schlupflöcher, durch die sich die KI einen Beleg erschleichen kann — und damit
  genau der Fehlermodus, den die Belegpflicht verhindern soll.
- Alles andere → verworfen, ohne Fehlermeldung an den Nutzer.

Damit kann die KI keine Änderung erfinden, die nicht passiert ist. Sie darf nur in Worte
fassen, was der Code bereits bewiesen hat. Das entspricht der bestehenden Projekt-Invariante
„den KI-Zahlen nie vertrauen".

### Schritt 4: Einmal-Ausnahmen aussortieren

Doppelt abgesichert, weil ein Kundensonderwunsch sonst zur Dauerregel wird:

- Im KI-Auftrag: „Änderungen, die als einmalig gekennzeichnet sind, ergeben keine Regel."
- Im Code: Chat-Nachrichten mit `diesmal`, `nur hier`, `nur bei diesem`, `ausnahmsweise`,
  `einmalig`, `für diesen Kunden` werden vor dem Call als Signalquelle entfernt.

### Schritt 5: Datenschutz-Filter

- Kundendaten (`kunde`-Objekt) werden **vor** dem KI-Call entfernt.
- Kandidaten, deren `wenn` oder `dann` einen Namen oder Ortsteil aus den Kundendaten des
  Angebots enthält, werden verworfen. Der Vault enthält Bauweise, keine personenbezogenen
  Daten — sonst liegen DSGVO-relevante Daten dauerhaft in einem Bereich, den niemand aufräumt.

### Schritt 6: Abgleich mit dem Vault

Ein Kandidat gilt als Änderung einer bestehenden Regel, wenn eine aktive Regel desselben
Nutzers **denselben `bereich`** hat **und** ihr `wenn` als gleich gilt. „Gleich" heißt
konkret: beide `wenn` auf Kleinschreibung normalisiert, Mehrfach-Leerzeichen und
Satzzeichen entfernt, dann Zeichenketten-Vergleich. Kein unscharfes Matching, keine
Ähnlichkeitsschwelle: das wäre nicht testbar und würde bei Fehltreffern die falsche Regel
überschreiben.

**Ein leeres `wenn` („gilt immer") ist ausdrücklich KEINE Identität** (Entscheidung Fabian,
2026-08-02). Ein Bereich enthält viele unabhängige Immer-Regeln: „Rückwand immer Multiplex"
und „Kanten immer ABS" sind beide *Material* und beide *immer*, aber verschiedene Regeln.
Würden zwei leere `wenn` als gleich zählen, könnte es pro Bereich nur eine einzige
Immer-Regel geben — über alle sechs Bereiche also sechs im ganzen Betrieb. Das ist für
einen Schreiner viel zu wenig, und die zweite Regel würde beim Anlegen abgewiesen bzw. im
selben Durchlauf still verworfen.

Preis dieser Entscheidung: Eine Immer-Regel wird nie als „ersetzt bestehende" erkannt.
Ändert der Nutzer seine Meinung zu einer Immer-Regel, entsteht eine zweite, die er im Vault
selbst löscht — sichtbares Aufräumen statt stillem Wissensverlust. Innerhalb eines
Kandidaten-Durchlaufs unterscheidet bei leerem `wenn` das `dann`, wortgleiche Vorschläge
fallen also weiterhin zusammen.

Solche Kandidaten werden als **„ändert bestehende Regel"** markiert, im Dialog **nicht**
vorangehakt, und die bestehende Regel bekommt `konflikt_hinweis = true`. Bestätigt der
Nutzer, wird die bestehende Regel aktualisiert statt eine zweite angelegt.

Ohne diesen Schritt sammeln sich widersprüchliche Regeln und die KI würfelt.

## Dialog beim Speichern

```
┌──────────────────────────────────────────────────────────┐
│  Mir sind 3 Dinge aufgefallen                            │
│  Was davon ist deine Standardbauweise?                   │
├──────────────────────────────────────────────────────────┤
│  ☑  MATERIAL                                             │
│     Wenn  [ Korpus mit Rückwand        ▾ ]               │
│     Dann  Rückwand 8mm Multiplex Birke, kein HPL         │
│     ↳ belegt: „HPL 6mm" → „Multiplex Birke 8mm"          │
│                                                           │
│  ☑  ZEIT                                                 │
│     Wenn  [ gilt immer                 ▾ ]               │
│     Dann  Zuschnitt braucht bei mir ca. 50 % länger      │
│     ↳ belegt: Zuschnitt 45 → 70 min                      │
│                                                           │
│  ☐  KONSTRUKTION   ⚠ ändert bestehende Regel             │
│     Dann  LED-Profil immer als eigene Position           │
│     ↳ belegt: Chat „LED bitte immer separat ausweisen"   │
│                                                           │
│         [ Nicht merken ]      [ 2 Regeln merken ]        │
└──────────────────────────────────────────────────────────┘
```

- Neue Regeln: vorangehakt. Regeln, die bestehende ändern: **nicht** vorangehakt.
- Der Beleg steht immer sichtbar unter dem Vorschlag — nachvollziehbar, woher er kommt.
- „Wenn" ist ein editierbares Feld mit Auswahl „gilt immer".
- Keine Kandidaten → kein Dialog, der Nutzer merkt nichts.

## Anwendung im Prompt

Neuer Block in `/api/analyze` **und** `/api/optimize`, angehängt nach dem allgemeinen
Fachwissen und nach den Nutzer-Stundensätzen:

```
## MEINE BAUWEISE — VERBINDLICHE REGELN DIESES BETRIEBS
[Material] Wenn Korpus mit Rückwand → Rückwand 8mm Multiplex Birke, kein HPL
[Zeit]     Immer → Zuschnitt ca. 50 % länger ansetzen als Standard

Diese Regeln haben Vorrang vor allen allgemeinen Vorgaben oben.
```

**Position und Vorrang-Satz sind funktional erforderlich**, nicht Kosmetik: Steht der
Block vor dem Standardwissen, gewinnt weiter die generische Vorgabe und die 6-mm-HPL-Rückwand
kommt zurück.

**Serverseitiges Laden.** Beide Routen lesen die Regeln selbst aus der Datenbank —
nicht das Frontend, das sie mitschickt. Abweichung vom bestehenden Muster bei
`userKostenstellen` (die kommen heute aus dem Frontend), begründet:

- Beide Routen holen sich sowieso schon das Betriebsprofil aus der DB
  (`src/app/api/optimize/route.ts:157`) → kein zusätzlicher Roundtrip.
- Was das Frontend nicht sendet, kann nicht manipuliert werden.

**Mengenbegrenzung:** Sortierung nach `zuletzt_gesendet` absteigend, dann `created_at`
absteigend. Bis 60 aktive Regeln fließen in den Prompt. Ab 40 zeigt der Vault einen
Aufräum-Hinweis; ab 60 wird im Vault **sichtbar markiert**, welche Regeln nicht mehr
mitgeschickt werden. Kein stilles Abschneiden.

Nach erfolgreichem Call: `gesendet_zahl + 1` und `zuletzt_gesendet = now()` für alle
mitgeschickten Regeln (fire & forget, darf die Antwort nicht verzögern).

## Vault-UI

`src/components/settings/BauweiseSettings.tsx`, eingehängt in `src/app/settings/page.tsx`.
Eigene Komponente wie `EmailSettings.tsx` und `LieferantenSettings.tsx`, damit
`settings/page.tsx` (bereits 1.866 Zeilen) nicht weiter wächst.

Inhalt:

- Regeln gruppiert nach `bereich`.
- Pro Regel: `wenn` / `dann` bearbeiten, an/aus, löschen.
- Anzeige: Herkunft (`gelernt am … aus Angebot „…"` / `von mir eingetippt`),
  wie oft mitgeschickt, wann zuletzt.
- `konflikt_hinweis = true` → sichtbarer Hinweis „greift möglicherweise nicht mehr".
- Knopf „Regel selbst anlegen" — Wissen direkt eintippen, ohne auf einen KI-Fehler zu warten.

**Messbarkeit, korrekt benannt:** Angezeigt wird, wie oft eine Regel **mitgeschickt**
wurde, nicht wie oft sie *angewendet* wurde. Ob die KI eine Regel befolgt hat, ist nicht
zuverlässig messbar — man müsste sie fragen, und das wäre geraten. Das verlässlichere
Signal für eine wirkungslose Regel ist `konflikt_hinweis`.

## Fehlerverhalten

**Grundregel: Lernen darf Speichern und PDF-Export niemals blockieren.** Ein
Komfort-Feature darf nie der Grund sein, dass ein Angebot nicht rausgeht.

| Fall | Verhalten |
|---|---|
| KI-Call scheitert / Timeout | Kein Dialog, Speichern und PDF laufen normal durch |
| KI liefert unbelegte Kandidaten | Server verwirft sie stillschweigend |
| KI-Antwort nicht parsebar | Kein Dialog, Log-Eintrag `[learn]` |
| Keine Änderung erkannt | Kein Dialog |
| Vault leer (neuer Nutzer) | Prompt wie heute |
| Kein KI-Erstvorschlag vorhanden (PDF-Import, GAEB-Import, geladenes Projekt) | Kein Lernen, kein Fehler |
| Nutzer nicht eingeloggt | 401 aus der Route, Frontend ignoriert still |

**Reihenfolge, damit „nicht blockieren" auch wirklich gilt:** Speichern bzw. PDF-Export
läuft zuerst und vollständig durch. Der Lern-Call startet parallel dazu. Der Dialog
erscheint erst, wenn Kandidaten vorliegen — das können ein bis mehrere Sekunden nach dem
Speichern sein. Der Nutzer wartet also nie auf das Lernen; im Zweifel erscheint der Dialog
einfach etwas später oder gar nicht. Verlässt der Nutzer den Bildschirm vorher, wird das
Ergebnis verworfen (kein nachträgliches Aufpoppen an anderer Stelle).

## Testplan

Nach den zwei bewährten Wegen aus der Projekt-CLAUDE.md — die App läuft lokal nicht
(`.env.local` enthält nur leere Platzhalter).

### 1. Lokal ohne Keys — reine Funktionen

`diffOffer()` und die Belegprüfung sind ohne DB und ohne KI ausführbar. Node-Skript mit
festen Vorher/Nachher-Angeboten. Abgedeckt werden muss:

- Material ersetzt / entfernt / neu → korrekte `Aenderung`-Einträge
- Kostenstelle entfernt / neu
- **Rauschfilter-Grenzwerte:** 24 % Minuten-Abweichung → keine Änderung;
  26 % → Änderung. 14 Minuten absolut → keine Änderung; 16 Minuten bei ≥ 25 % → Änderung.
- Reine `vkStunde`-Änderung → **keine** Änderung erkannt
- Reine `aufschlag`-Änderung → **keine** Änderung erkannt
- Beleg mit nicht existierender `nr` → verworfen
- Zitat-Beleg, der nicht im Chat vorkommt → verworfen
- Kandidat mit Kundennamen → verworfen
- Chat mit „diesmal" → Nachricht nicht als Signalquelle verwendet

Das ist der Teil, der still falsch sein könnte — hier liegt der Testschwerpunkt.

### 2. Live auf der dev-Preview — echter Durchlauf

Adresse: `https://craftflow-git-dev-fabian-scharf-s-projects.vercel.app`

1. Angebot mit Rückwand erzeugen → KI schlägt HPL vor
2. Im Optimieren-Chat auf Multiplex 8 mm ändern
3. Speichern → Dialog erscheint, Regel anhaken
4. Einstellungen → Vault: Regel ist da, mit Beleg und Herkunft
5. **Neues** Angebot erzeugen → Rückwand ist von allein Multiplex 8 mm
6. Regel im Vault deaktivieren → nächstes Angebot fällt auf HPL zurück

Schritt 5 ist der eigentliche Beweis, dass das Feature den Zweck erfüllt.

### 3. Mandantentrennung prüfen

Regeln von Konto A dürfen in Konto B weder im Vault auftauchen noch die Kalkulation
beeinflussen. Das ist der wichtigste Test des Features — im SaaS-Betrieb wäre ein Leck
hier ein Vertrauensschaden, der sich nicht reparieren lässt.

**Testkonto existiert noch nicht** und muss angelegt werden. Machbar ohne Bezahlplan:
Ein frisches Konto startet auf `solo` mit 3 Angeboten pro Monat und 14 Tagen Trial
(`PLAN_LIMITS_ANGEBOTE` in `src/hooks/usePlan.ts:14`); Texteingabe und Kalkulation sind
auf `solo` freigeschaltet. Für den Test brauchen wir zwei Angebote — das Limit reicht.
Fotos und PDF-Upload wären gesperrt (ab `starter`), sind für diesen Test aber nicht nötig.

Benötigt wird nur eine zweite E-Mail-Adresse für die Registrierung über `/register`
(z. B. eine Plus-Adresse wie `anfrage+vaulttest@fscrafted.de`, falls der Mailanbieter das
unterstützt — sonst eine echte zweite Adresse).

**Achtung:** Alle Previews und die Produktion teilen dieselbe Supabase-DB (siehe
Projekt-CLAUDE.md). Das Testkonto und seine Regeln landen also auch in der Produktions-DB
und müssen hinterher aufgeräumt werden.

## Betroffene Dateien

```
NEU   src/lib/learn.ts                                Diff + Belegprüfung (reine Funktionen)
NEU   src/app/api/learn/candidates/route.ts           Kandidaten erzeugen
NEU   src/app/api/settings/bauweise/route.ts          Vault CRUD (GET/POST/PUT/DELETE)
NEU   src/components/settings/BauweiseSettings.tsx    Vault-Reiter
NEU   Supabase: Tabelle bauweise_regeln + RLS         SQL oben, im Dashboard ausführen
ÄND   src/app/api/analyze/route.ts                    Regel-Block in den System-Prompt
ÄND   src/app/api/optimize/route.ts                   Regel-Block in den System-Prompt
ÄND   src/app/page.tsx                                Erstvorschlag-Ref + Lern-Dialog
ÄND   src/app/settings/page.tsx                       Vault-Reiter einhängen
ÄND   CLAUDE.md                                       Vault als Engine-Invariante dokumentieren
```

## Deployment

Strikt nach Projekt-Regel: alles auf `dev`, live auf der dev-Preview getestet, Fabian gibt
Freigabe, dann `dev → main`. Niemals direkt auf `main`.

Das SQL für Tabelle und RLS-Policy muss Fabian im Supabase-Dashboard ausführen, bevor der
`dev`-Test möglich ist.

## Offene Punkte für Fabian

- SQL im Supabase-Dashboard ausführen (Tabelle + RLS-Policies). Muss vor dem dev-Test
  erledigt sein, sonst läuft nichts.
- Zweites Testkonto über `/register` anlegen (zweite E-Mail-Adresse nötig). Kein
  Bezahlplan erforderlich, `solo` genügt. Nach dem Test wieder aufräumen.
