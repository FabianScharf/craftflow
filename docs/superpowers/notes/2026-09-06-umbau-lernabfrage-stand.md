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
