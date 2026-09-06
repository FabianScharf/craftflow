# Umbau Lernabfrage + Materialpreise — Arbeitsstand

**Stand:** 2026-09-06 · **Branch:** `dev` = zuletzt gepusht, siehe `git log` · **`main`:** unberührt

> **Alles gebaut, NICHTS davon live getestet.** Das ist der wichtigste Satz dieser
> Datei. Der Live-Test auf der dev-Preview steht komplett aus.

Grundlage: `docs/superpowers/specs/2026-09-05-lernabfrage-im-chat-design.md`
Plan: `docs/superpowers/plans/2026-09-06-lernabfrage-im-chat.md`

## Was gebaut ist

| # | Task | Commit |
|---|---|---|
| 1 | SQL `materialpreise` (mit GRANTs) — **von Fabian ausgeführt und geprüft** | `d45201f` |
| 2 | `src/lib/materialpreise.ts` — Matching, Preisblock, Alterung | `d45201f` |
| 3 | `src/lib/lernwerkzeuge.ts` — Werkzeug-Schemata + Erfindungsschutz | `2494ed3` |
| 4 | `src/lib/preisspeicher.ts` — Supabase-Zugriff | `dc9cc2d` |
| 5 | `/api/settings/materialpreise` — CRUD | `cf53463` |
| 6 | Werkzeuge in `/api/optimize`, Preisblock auch in `/api/analyze` | `fd0a240` |
| 7 | Einstellungen-Reiter „Materialpreise" | `5a0ff61` |
| 8 | Speichern-Dialog und `/api/learn/candidates` entfernt (−237 Zeilen) | `d14be3c` |
| 9 | Kopfleiste hebt den aktiven Bereich hervor | `848f956` |
| 10 | **Live-Test** | **offen** |

Verifikation: 70 Tests grün, `npx tsc --noEmit` sauber, keine neuen ESLint-Fehler
(die vorhandenen sind Bestand).

## Nachträglich dazugekommen (nicht im ursprünglichen Plan)

### Preisblock auch in `/api/analyze`
Der Plan hatte nur `optimize` vorgesehen. Ein **neues** Angebot entsteht aber über
`analyze` — fixierte Preise hätten dort nicht gegriffen, also genau dann nicht, wenn
sie am meisten nützen.

### Zwei Fehler aus dem ersten Praxistest (2026-09-07 gemeldet)

**1. Die Werkzeuge wurden nie aufgerufen.** Der System-Prompt verlangte seit jeher
„Deine gesamte Antwort besteht aus GENAU EINEM gültigen JSON-Objekt, kein Text davor
oder danach". Beim Einbau der Werkzeuge blieb der Satz stehen. Das Modell hielt sich an
das strengere Gebot und rief nichts auf. **Selbst verursacht.** Behoben: Werkzeugaufrufe
sind ausdrücklich vom Textformat ausgenommen (`21f2e72`).

**2. KI-Änderungen gingen verloren.** Nach einer Optimierung wurde nur die *vorherige*
Fassung als Version gesichert und der lokale Zustand aktualisiert — der neue Stand stand
nirgends in der Datenbank. Wer das Projekt verließ, ohne „Änderungen speichern" zu
drücken, verlor alles. **Bestand schon lange**; sichtbar wurde es erst, als der
Lern-Dialog wegfiel und damit der Anlass, den Knopf zu drücken. Behoben durch Autosave
nach jeder KI-Änderung (`21f2e72`).

### Speicherverhalten neu geregelt (`59e7ee1`)
Fabians Entscheidung: **KI-Änderungen automatisch, Handarbeit bewusst.**
- Erkennung über Vergleich Bildschirm ↔ zuletzt gesicherter Stand (kein Flag je Feld —
  ein vergessenes Feld wäre wieder stiller Datenverlust).
- Feste Leiste am unteren Rand statt Knopf im Reiter „Angebot".
- Beim Verlassen: Speichern / Verwerfen / Zurück. Drei Wege, weil man sich verklickt.
- `beforeunload` fürs Tab-Schließen.

### Testphase (`ab129ad`, `925929f`)
- Countdown rechnete auf Stunden und rundete auf → stand je nach Uhrzeit einen Tag
  still. Jetzt Kalendertage. Ob der Trial *läuft*, entscheidet weiter die exakte
  Zeitgrenze, identisch zu `/api/usage`.
- Hinweisbalken steckte im Startbildschirm fest → jetzt eigenes Element in allen drei
  Ansichten.
- Während der Tarif lädt, steht er auf `solo`; die Upload-Knöpfe zeigten „AB STARTER“.
  Ein Neukunde in der Testphase liest das und glaubt, sie gelte nicht für ihn. Optik
  hängt jetzt an `darfNutzen()`, die Klickprüfung bleibt an `planCanUse()`.

### Nachtrag: Die Warnung wirkte zunaechst gar nicht (`7ddbb0c`)

Sofort beim ersten Test gemeldet: Zeiten aendern, weggehen — keine Nachfrage, Aenderungen
weg. Ursache: `loadProject` setzte den Vergleichsstand nicht. Ein leerer Vergleichsstand
bedeutet in der Pruefung "nichts zu vergleichen", also galt nie etwas als ungespeichert —
und zwar in **jedem** aus der Liste geoeffneten Projekt, also im Normalfall.
`resetAll` fehlte aus demselben Grund (dort waere der Stand des vorigen Angebots stehen
geblieben und haette auf einem leeren Formular sofort gewarnt).

**Lehre:** Wer einen "hat sich etwas geaendert"-Vergleich einbaut, muss JEDEN Weg
durchgehen, auf dem Daten in den Zustand gelangen — nicht nur die, die man gerade
gebaut hat. Die Wege hier: laden, neu anlegen, Analyse, Optimierung (setzen den Stand);
Rollback und Handarbeit (setzen ihn bewusst nicht).

## Beinahe-Unfall, zur Warnung

Beim Ausbau des Dialogs wurde `page.tsx` zerschossen: Als Schnittende diente
`{HelpWidget}` — das kommt **siebenmal** vor, die erste Fundstelle lag *vor* dem Dialog.
Ergebnis: 1499 eingefügte statt gelöschter Zeilen. Sofort aufgefallen, `git checkout`,
mit eindeutigen Grenzen und einer Reihenfolge-Prüfung neu gemacht. Nie gepusht.

**Lehre:** Bei Blockschnitten in großen Dateien nie einen Marker verwenden, der mehrfach
vorkommt — und immer prüfen, ob das Ende hinter dem Anfang liegt.

## Der Live-Test (steht komplett aus)

Adresse: `https://craftflow-git-dev-fabian-scharf-s-projects.vercel.app`
Zwölf Kriterien in der Spec. Die entscheidenden:

1. „Rückwand mache ich immer in 8mm Spanplatte" → **die KI fragt im Chat**
2. „ja" → sie bestätigt, Regel steht unter *Einstellungen → Meine Bauweise*
3. „Der Blum Movento kostet mich 26,27 €, merk dir das" → Preis wird fixiert
4. Speichern → **kein Dialog mehr**
5. Neues Angebot → Rückwand und Movento stimmen von allein
6. EK von Hand ändern → **Speicherleiste erscheint**, Verlassen → **Nachfrage**
7. **Zweites Konto sieht weder Regeln noch Preise** — der Test, der über die Freigabe
   entscheidet

Erst danach `dev → main`.


---

## Stand nach dem ersten echten Praxistest (2026-09-06 abends)

### Was nachweislich funktioniert

- **Testphasen-Countdown**: zeigt korrekt "13 Tage" (Screenshot).
- **Hinweisbalken** ist sichtbar.
- Die **Optimierung selbst** laeuft: Materialaenderungen kommen an, die KI stellt
  Rueckfragen.

### Was noch offen oder unklar ist

1. **"Antwort konnte nicht verarbeitet werden"** trat auf, nachdem der Nutzer einen
   Preis genannt hatte ("Eine Eiche Lade in der Groesse kostet ca. 60 EUR pro Stueck").
   Ursache nicht abschliessend geklaert — ohne Zugriff auf die Vercel-Logs nicht
   feststellbar, ob ein Werkzeug lief, abgelehnt wurde oder das Modell schlicht kein
   JSON lieferte.
   **Behoben wurde jedenfalls:** Der Fehlerpfad verschluckte die Werkzeug-Meldungen.
   Ein gerade fixierter Preis waere stillschweigend verlorengegangen. Ausserdem
   verlangt der Prompt jetzt ausdruecklich, nach jedem Werkzeug-Ergebnis das JSON zu
   liefern. Beim naechsten Test sollte im Chat stehen, was tatsaechlich passiert ist.
2. **Unbeantwortet:** Hat die KI gefragt, ob sie "Massivholzladen immer als Zukauf von
   Wuerth" merken soll? Das ist der Kernfall der Lernfunktion und muss beim naechsten
   Test gezielt geprueft werden.
3. **Speicherleiste und Verlassen-Nachfrage** sind seit dem `loadProject`-Fix
   ungetestet.

### Offene Konzeptfrage: variable Preise

Der Nutzer brachte einen Fall, den die Materialpreisliste konstruktiv nicht abdeckt:

> "Massivholzladen kaufe ich immer bei Wuerth fertig ein." + "kostet ca. 60 EUR,
> kommt auf Groesse und Holzart an."

Darin stecken **zwei verschiedene Dinge**:

| Aussage | Art | Wohin |
|---|---|---|
| "kaufe ich **immer** fertig ein" | Bauweise, gilt dauerhaft | Bauweise-Vault — genau dafuer gebaut |
| "**ca.** 60 EUR, je nach Groesse und Holzart" | Preis, variabel | Als feste Zahl unbrauchbar |

Die Preisliste kennt nur `bezeichnung -> preis`, keine Bedingungen. Ein fixiertes
"Massivholzlade = 60 EUR" waere falsch, sobald Buche statt Eiche gebaut wird.

**Vorschlag, noch nicht entschieden:**
- Typische Faelle einzeln hinterlegen ("Massivholzlade Eiche 600 mm = 60 EUR") statt
  einen Durchschnitt zu fixieren. Die Liste darf beliebig viele Zeilen haben.
- Unsichere Angaben ("ca.", "je nach", "kommt darauf an") erkennt die KI und fixiert
  sie **nicht**, sondern fragt im naechsten Angebot nach der Groesse.

**Fabian wurde gefragt**, ob das seiner Arbeitsweise entspricht oder ob er eher
Staffelpreise braucht (ein Material, mehrere Groessen und Preise). Antwort steht aus —
hier weitermachen.

---

## Live-Test 2026-09-06 nachmittags — durchgefuehrt, drei Fehler gefunden und behoben

Getestet auf der dev-Vorschau, ferngesteuerter Chrome + `puppeteer-core`.
Stand am Ende: `dev` = `a37e6f0`, `main` weiterhin unberuehrt.

### Bestanden

| Kriterium | Beleg |
|---|---|
| 2 — Die KI fragt bei einer "immer"-Aussage | zeigt den Wortlaut und fragt nach |
| 2 — und speichert nach "ja" | Regel steht in der Datenbank, `wenn` sauber |
| 5 der Notiz — neues Angebot uebernimmt Gelerntes | Rueckwand 8 mm **ohne** Nennung, Movento 26,27 €, Massivholzlade 60,00 € |
| 7 — kein Dialog mehr beim Speichern | — |
| 9/10 — Preis fixiert, mit Datum, aenderbar, abschaltbar | — |
| 12 — keine Zusagen, die sie nicht halten kann | "dauerhaft merken kann ich mir das nicht" beim Stundensatz |
| Speicherleiste bei Handarbeit + Nachfrage beim Verlassen | drei Wege: Speichern / Verwerfen / Zurueck |

Offen bleiben: 1, 3, 4 (Frageverhalten im Detail), 8 und 11 (zweites Konto),
5 und 6 der Spec (Erfindungsschutz, Speicherfehler — von aussen kaum ausloesbar).

### Fehler 1: Ablehnung war unsichtbar und traf treue Formulierungen (`6eb180c`)

Auf "ja" kam "Die Antwort kam nicht in verwertbarer Form zurueck". Das Vercel-Log
zeigte `stop: 'tool_use', raw: ''` — das Werkzeug lief also sehr wohl. Der
Beleg-Test lehnte ab, weil **ein gewoehnliches Wort** ("ansetzen") nicht
woertlich gefallen war; Ablehnungen gaben `meldung: ''` zurueck, die Schleife
lief dreimal, der Nutzer erfuhr nie den Grund.

Nachgerechnet mit den echten Saetzen: "Kleinmaterial mit 5 % der Materialkosten
ansetzen" faellt durch, "5 % der Materialkosten als Kleinmaterial" nicht.

**Fabians Entscheidung:** Er bestaetigt kuenftig den Wortlaut. Damit zaehlen auch
fruehere KI-Nachrichten als Belegquelle — `chatHistory` traegt nie die laufende
Antwort, erfinden und speichern in einem Zug bleibt also ausgeschlossen.

### Fehler 2: Steuerzeichen im "Wenn"-Feld (`6eb180c`)

Wirklich in der Datenbank gelandet:
`"wenn": "</parameter>\n<parameter name=\"dann\">5 % der Materialkosten ..."`
Das Modell schrieb seine eigene Werkzeug-Syntax in das Feld. Geprueft wurde nur
`dann`, nie `wenn` — der Muell waere in jede Kalkulation gewandert.
`bereinigeWenn()` verwirft jetzt alles mit Spitzklammern.

### Fehler 3: Brauchbare Antworten wurden weggeworfen (`b600496`, `a37e6f0`)

Der Fehler, den Fabian seit Tagen sah. Das Log zeigt: Die Antwort war jedes Mal
inhaltlich richtig, nur die Verpackung kaputt — mal reiner Text statt JSON, mal
JSON, das an **einem einzigen geraden Anfuehrungszeichen** zerbrach.

**Selbst verursacht und wieder zurueckgenommen:** Die Anweisung, den Regeltext in
typografische Anfuehrungszeichen zu setzen, brachte das Modell dazu, mit `„` zu
oeffnen und mit `"` zu schliessen — danach scheiterte sogar die Eingangsanalyse.

`notNachricht()` rettet die Nachricht aus zerbrochenem JSON, `brauchbarerText()`
laesst reinen Fliesstext durch. **`updatedOffer` wird nie gerettet**: Ein halb
gelesenes Angebot ins Formular zu schreiben waere schlimmer als keine Aenderung.

### Lehren

1. **Wer ablehnt, muss sagen woran es lag.** Ein stiller Fehlschlag kostete drei
   bezahlte Aufrufe pro Versuch und war von aussen nicht zu diagnostizieren.
2. **Die Vercel-Laufzeitlogs sind erreichbar**, ohne CLI: `/api/logs/request-logs`
   mit der angemeldeten Browser-Sitzung, Feld `logs` je Anfrage. Das hat zwei
   falsche Hypothesen in Minuten widerlegt — vorher wurde geraten.
3. **Formatvorgaben an ein Modell koennen das Format zerstoeren.** Die Bitte um
   typografische Anfuehrungszeichen erzeugte gemischte Paare.
4. **Beim Fernsteuern nie den ersten `×`-Knopf im Dokument klicken.** Das ist die
   Loeschtaste der ersten Materialzeile, nicht der Panel-Schliesser — eine Zeile
   verschwand und sah nach einem Programmfehler aus.

### Noch offen

- **Fabians Entscheidung zu variablen Preisen ist getroffen** (2026-09-06):
  typische Faelle einzeln hinterlegen, unsichere Angaben ("ca.", "je nach") gar
  nicht fixieren, sondern nachfragen. **Gebaut ist das noch nicht.**
  Der Live-Test belegte den Bedarf: "ca. 60 EUR" steht als harte 60,00 € in der
  Preisliste.
- Kriterien 1, 3, 4, 8, 11.

### Zweitkonto-Test 2026-09-06 — bestanden (Kriterien 8 und 11)

Der Test, der laut Spec ueber die Freigabe entscheidet. Fabian hat sich zweimal
umgemeldet, gelesen wurde jeweils ueber `/api/settings/bauweise`,
`/api/settings/materialpreise` und `/api/projects` aus der laufenden Sitzung.

| | Testkonto `9a174b25…` | Arbeitskonto `7ca5f21e…` |
|---|---|---|
| Bauweise-Regeln | 2 | **0** |
| Materialpreise | 2 | **0** |
| Projekte | 4 | 25 (voellig andere) |

Kein Uebersprung in beide Richtungen, und nach der Rueckmeldung ins Testkonto war
dort alles unveraendert vorhanden.

**Zusatzbefund:** Ohne Anmeldung liefern alle drei Schnittstellen einen Redirect auf
`/login`, keine Daten. Die Middleware greift auch fuer die neuen Routen.

**Fuer die Uebergabe wichtig:** Alles heute Gelernte liegt im **Testkonto**. Fabians
Arbeitskonto hat null Regeln und null Preise — nach `dev → main` faengt es leer an.
Das ist richtig so, sollte ihn aber nicht ueberraschen.

### Frageverhalten 2026-09-06 — Kriterien 1, 3, 4 bestanden

| Eingabe | Erwartet | Ergebnis |
|---|---|---|
| „Für dieses Angebot bitte aufgesetzte Griffe statt Griffmulden." | keine Merken-Frage | keine — nur eine sachliche Rückfrage nach dem Griffmodell |
| „Das Kantenband bitte in ABS 1 mm." | keine Merken-Frage | keine |
| „Nimm für das Kantenband doch ABS 2 mm." (**zweite** Änderung am selben Merkmal) | fragt | „Da du das Kantenband jetzt zum zweiten Mal geändert hast – soll ich mir merken: Kantenband wird standardmäßig in ABS 2 mm ausgeführt?" |
| „Nein, das gilt nur für dieses Angebot." | keine Regel, kein Nachbohren | keine Regel angelegt, Frage nicht wiederholt |

Jede Antwort enthielt **genau eine** Frage (Kriterium 4).

**Achtung bei kuenftigen Tests:** Ein *Zurücknehmen* (A → B → A) loest die
Wiederholungsfrage nicht aus und ist auch kein fairer Test dafuer — ein Hin und Her
ist ein schwacher Beleg fuer einen Standard. Zwei echte Aenderungen am selben
Merkmal loesen sie aus.

### Gesamtstand der zwoelf Pruefkriterien

Bestanden: 1, 2, 3, 4, 5 (als Funktionstest: „7 %" faellt durch), 7, 8, 9, 10, 11, 12.
Offen: **6** — „Schlaegt das Speichern fehl, steht der Grund im Chat" ist gebaut
(`werkzeugFehler` in `/api/optimize`), liess sich von aussen aber nicht gezielt
ausloesen. Ein echter Datenbankfehler waere dafuer noetig.

**Damit ist der Live-Test abgeschlossen.** `dev → main` haengt nur noch an Fabians
Freigabe. Die Materialpreis-Tabelle ist in der gemeinsamen Datenbank vorhanden und
fuer andere Konten lesbar — belegt durch den Zweitkonto-Test (Status 200, leere Liste).
