# Task 3 — Einladung: Routen, Mail, Seite, Rücksprung

**Status:** fertig (Tests, tsc, eslint grün; ein Commit, nicht gepusht)

- **Worktree:** `/Users/fabianscharf/Downloads/craftflow/.claude/worktrees/agent-a9869d2dace55a3b7`
- **Branch:** `worktree-agent-a9869d2dace55a3b7`
- **Basis:** `02045b1` (dev, Task 1)
- **Commit:** `93f1eb5` — `feat(team): Einladung per E-Mail-Link, Annehmen, Verlassen, Rücksprung nach Login`

> **Hinweis an den Controller:** Der Worktree stand beim Start auf `8826876`, also
> vier Commits VOR der Task-1-Basis — `src/lib/konto.ts`, `kontoserver.ts`,
> `team.ts` und die Spec fehlten. Ich habe ihn per `git merge --ff-only 02045b1`
> vorgezogen (reiner Fast-Forward, nichts verworfen). Die Schwesterzweige
> `agent-ac73b79602fa8dea0` und `agent-afe42c1e6b3ad2bc0` stehen laut
> `git worktree list` ebenfalls noch auf `8826876` — dort dürfte dasselbe nötig sein.

---

## 1. Routenliste mit Statuscodes

Alle Routen: `createClient()` + `auth.getUser()`, dann `kontoIdFuer` →
`kontoGesperrt`. Datenschlüssel ist überall `konto.kontoId`, nie `user.id`
(Ausnahme: die Prüfungen, die bewusst den LOGIN betreffen — Adressgleichheit und
Ruling R4 beim Annehmen, eigene Mitgliedschaft beim Verlassen).

### `GET /api/team` — Liste (Inhaber **und** Mitarbeiter, nur lesen)
| Code | Fall |
|---|---|
| 200 | `{ inhaber: { email }, mitglieder: [{ id, email, status, angenommen_am, eingeladen_am, ruhend }], plaetze: { deckel, belegt, frei } }` |
| 401 | nicht angemeldet |
| 403 | `zustand` ruhend/entfernt (`kontoGesperrt`) |
| 500 | Teamliste nicht ladbar |

- `ruhend` kommt aus `istImDeckel(m, aktive, deckel(plan,'nutzer'))` — kein
  Datenbankzustand, sondern Ruling R1 in der App-Schicht.
- `plaetze.belegt` zählt den Inhaber mit (Spec §2, Platz 1).
- Entfernte Mitglieder stehen NICHT in der Liste (Zeile bleibt in der Datenbank).
- Die Anmeldeadresse des Inhabers liest ein Mitarbeiter über
  `auth.admin.getUserById(kontoId)` (Service-Role) — nur die des eigenen Betriebs.

### `POST /api/team/einladen` `{ email }` — nur Inhaber
| Code | Fall |
|---|---|
| 200 | `{ ok: true, id }` |
| 400 | Adresse unvollständig (`emailGueltig`) / eigene Adresse |
| 401 | nicht angemeldet |
| 402 | Betrieb gesperrt (`pruefeZugang`) — vor der Deckelprüfung, weil `'gesperrt'` kein Plan-Label hat |
| 403 | kein Inhaber (`TEAM_TEXTE.nurInhaber`) · gesperrtes Konto · Deckel voll (`TEAM_TEXTE.voll(PLAN_LABELS[plan])`) |
| 409 | Adresse ist schon aktiv / schon eingeladen |
| 500 | Zeile nicht anlegbar |
| 502 | Zeile steht, **Resend hat abgelehnt** — mit Grund, „Erneut senden" ist der Ausweg |

Prüfreihenfolge: Inhaber → Zugang → Adresse → Bestand → Deckel → Zeile → Mail.
Eine `status='entfernt'`-Zeile derselben Adresse wird wiederverwendet (neuer
Token, `eingeladen_am` neu, `angenommen_am` zurück auf null); `user_id` bleibt für
die Historie stehen und wird beim Annehmen überschrieben.

### `POST /api/team/[id]` — Einladung erneut senden (nur Inhaber)
| Code | Fall |
|---|---|
| 200 | `{ ok: true, id }` |
| 400 | Einladung ist bereits angenommen |
| 401 / 403 / 404 | nicht angemeldet · kein Inhaber/gesperrt · Zeile gehört nicht zu diesem Betrieb |
| 402 | Betrieb gesperrt |
| 500 / 502 | Token nicht erneuerbar · Mailfehler mit Grund |

### `DELETE /api/team/[id]` — entfernen bzw. zurückziehen (nur Inhaber)
| Code | Fall |
|---|---|
| 200 | `{ ok: true, ergebnis: 'zurueckgezogen' }` (Status war `eingeladen` → Zeile gelöscht) oder `{ ok: true, ergebnis: 'entfernt' }` (Status `aktiv` → `status='entfernt'`, Zeile bleibt) |
| 401 / 403 / 404 / 500 | wie oben |

**Bewusst kein `pruefeZugang`:** Entfernen muss auch im gesperrten Betrieb gehen —
es ist der Weg, wieder unter den Nutzer-Deckel zu kommen.
Das Löschen einer offenen Einladung läuft über die **Service-Role**, weil es für
`authenticated` absichtlich keine delete-Policy gibt; die Herkunft der Zeile ist
vorher mit `inhaber_id = kontoId` geprüft. Grund für das Löschen: `unique
(inhaber_id, email)` würde eine neue Einladung an dieselbe Adresse sonst blockieren
und nur über den Umweg „Wiedereinladung" erlauben — und eine nie angenommene
Einladung ist keine Historie, sondern ein Tippfehler.

### `GET /api/team/einladung/[token]` — öffentlich (PUBLIC_PATHS, Service-Role)
| Code | Fall |
|---|---|
| 200 | `{ betriebName, email: 'a***@b.de', status }`, Header `Cache-Control: no-store` |
| 404 | Token ist keine uuid · kein Treffer · `status='entfernt'` (zurückgezogen) |
| 500 | Datenbankfehler |

### `POST /api/team/annehmen` `{ token }` — angemeldet, Service-Role
| Code | Fall |
|---|---|
| 200 | `{ ok: true, betriebName }` |
| 401 | nicht angemeldet |
| 403 | Adresse passt nicht (`TEAM_TEXTE.andereAdresse`) · Adresse nicht bestätigt · Betrieb gesperrt · Deckel voll |
| 404 | Token unbekannt / Einladung nicht mehr offen |
| 409 | eigener Betrieb (`inhaber_id === user.id`) · schon Mitarbeiter woanders · Ruling R4 (`TEAM_TEXTE.eigenerBetrieb`) · Einladung schon angenommen (Wettlauf) |
| 500 | Datenbankfehler |

Ruling R4 prüft zwei Dinge über die Service-Role: laufendes Abo
(`abo_status ∈ {aktiv, active, trialing}` — diese Datenbank schreibt `'aktiv'`,
die Stripe-Schreibweisen stehen zur Sicherheit mit in der Liste) und
`count(projects where user_id = user.id) > 0`.
Die Deckelprüfung zählt **nur aktive** Mitglieder (offene Einladungen sind beim
Einladen bereits eingerechnet — sonst wäre die letzte Einladung nie annehmbar).
Das `update` trägt `.eq('status','eingeladen')` als Wettlaufsperre.

### `POST /api/team/verlassen` — angemeldet, Service-Role
| Code | Fall |
|---|---|
| 200 | `{ ok: true, geloest: <Anzahl> }` — **immer**, auch wenn es nichts zu lösen gab |
| 401 / 500 | nicht angemeldet · Datenbankfehler |

**Erledigt wie vom Controller nachgefordert (Ergänzung aus Task 4, 17.09.):** Die
Route ist idempotent und deckt alle drei Ausgangslagen ab.
- **aktives** Mitglied → verlässt den Betrieb.
- **ruhendes** Mitglied → in der Datenbank ebenfalls `status='aktiv'`, fällt also
  in denselben Fall.
- **schon entferntes** Mitglied → nichts zu ändern, Antwort trotzdem
  `{ ok: true }`. Der Knopf auf der Sperrseite darf beim zweiten Druck nicht mit
  einem Fehler antworten. (Vorher: 400 „Du bist in keinem Betrieb Mitarbeiter." —
  ist raus.)

**Wichtig für Task 4 und den Live-Test — die Route setzt `user_id = null`, nicht
nur `status = 'entfernt'`:** `ermittleKonto` (`src/lib/konto.ts`, Task 1) erkennt
ein entferntes Mitglied genau an `status='entfernt' && user_id = userId` und zeigt
dafür die Sperrseite. Bliebe die `user_id` stehen, wäre der Nutzer nach dem
Verlassen weiter gesperrt und die Sperrseite würde sich selbst wieder aufrufen.
Mit gelöster `user_id` findet `ermittleKonto` keine Zeile mehr und liefert
`zustand: 'inhaber'` — genau das, was `/settings` danach erwartet. Die Zeile
selbst bleibt stehen (Plan-Constraint „Nichts wird gelöscht") und trägt weiter
Betrieb, Adresse und Daten; nur die Verbindung zum Login ist gelöst. Das ist der
Unterschied zwischen „der Inhaber hat mich entfernt" (Zeile behält die `user_id`
→ Sperrseite) und „ich gehe selbst" (Zeile löst sich → eigener Betrieb).
Nebeneffekt, gewollt: Eine spätere Wiedereinladung derselben Adresse benutzt
dieselbe Zeile weiter (`unique (inhaber_id, email)`), und `annehmen` setzt die
`user_id` neu.

**Bewusst ohne `kontoGesperrt`:** Ein ruhendes Mitglied sitzt auf der Sperrseite,
deren Knopf „Eigenen Betrieb anlegen" genau diese Route ruft. Eine 403 wäre dort
eine Falle ohne Ausweg.

---

## 2. Wie die Resend-Mail verschickt wird

- Vorlage `einladungsMail({ betriebName, einladerEmail, link })` in
  `src/lib/mail/vorlagen.ts` — importfrei wie der Rest der Datei, damit
  `npm run test` sie direkt ausführt; nutzt die bestehenden Bausteine
  (`rahmen`, `h1`, `p`, `knopf`) der Willkommens-Mail.
- Versand über `sendeMail(email, einladungsMail(...))` aus
  `src/lib/mail/resend.ts` (HTTP-API, Absender `MAIL_FROM`, Standard
  `fabian@fscrafted.de`, `reply_to` dorthin).
- Link: `einladungsLink(token)` in `src/app/api/team/gemeinsam.ts` →
  `${APP_URL}/einladung/<token>` = `https://app.getcraftflow.de/einladung/<token>`.
  Absolut und fest auf die App-Domain, nicht auf `window.location.origin`:
  Eine Einladung von einer Vorschau-Adresse muss trotzdem live landen (Lehre 08.09.).
- Einladen und „Erneut senden" rufen beide `schickeEinladung(...)` — eine Stelle,
  an der die Adresse des Links entsteht.
- **Mailfehler wird nie verschluckt:** 502 mit dem Grund von Resend, Zeile bleibt
  stehen. Der Inhaber sieht, was schiefging, und kann erneut senden.
- Inhalt: Betreff „{Betrieb} lädt dich zu CraftFlow ein" (ohne Firmennamen tritt
  die Adresse des Einladers an dessen Stelle — kein „null lädt dich ein"),
  kurzer Text, Knopf, der Satz „Melde dich mit **genau dieser E-Mail-Adresse** an",
  der Link als Klartext zum Kopieren, Hinweis „Du weißt nicht, warum du diese Mail
  bekommst? Dann ignoriere sie", Kontaktzeile.
- Firmenname und Einlader-Adresse laufen durch ein lokales `esc()` — sie kommen aus
  einem Eingabefeld und landen in HTML.

---

## 3. Seite, Rücksprung, Middleware

- **`src/app/einladung/[token]/page.tsx`** (Client, Gestaltung wie `/login`):
  lädt die öffentliche Route, zeigt „{Betrieb} lädt dich ein" und die maskierte
  Adresse. Nicht angemeldet → „Anmelden" (`/login?next=/einladung/<token>`) und
  „Registrieren" (`/register?next=…`). Angemeldet → „Einladung annehmen" mit der
  aktuell angemeldeten Adresse im Blick und dem Hinweis, sich sonst neu anzumelden.
  Erfolg: „Du gehörst jetzt zu {Betrieb}." + Link `/`. Jeder Fehler steht sichtbar
  mit dem Satz der Route.
- **`sicherNext(next)`** in `src/lib/team.ts` (rein, `tests/team.test.mjs`):
  nur relative Pfade mit führendem `/`, kein `//`, kein `\`, keine Leer- oder
  Steuerzeichen, max. 512 Zeichen — alles andere `'/'`.
- **`login`:** `router.push(nextZiel())` nach erfolgreicher Anmeldung; der Link
  „Kostenlos registrieren" hängt das `next` beim Klick an (nicht im Markup —
  sonst Hydrierungsunterschied).
- **`register`:** `emailRedirectTo: https://app.getcraftflow.de/auth/callback?next=<encoded>`
  (nur wenn ein Ziel da ist). Das `next` hängt an der Adresse, nicht am Cookie:
  Zwischen Registrierung und Klick in der Mail liegen Minuten, oft ein anderer Browser.
- **`auth/callback`:** `sicherNext(searchParams.get('next'))` statt
  `searchParams.get('next') ?? '/'`. Das war bereits vorher eine offene
  Weiterleitung (`${origin}${next}` mit `next = '//boese.example'`) — jetzt zu.
- **`middleware.ts`:** `PUBLIC_PATHS` um `/einladung` und `/api/team/einladung`
  ergänzt, volle Pfade mit Begründung im Kommentar. `'/api/team'` wäre über
  `startsWith` das ganze Feature.
- **Kein `useSearchParams()`** auf `/login` und `/register`: der Hook verlangt eine
  Suspense-Grenze für einen Wert, der ohnehin nur im Browser gebraucht wird.

---

## 4. Tests / Prüfungen

- `npm run test`: **499 Tests, 0 Fehler.** Neu: 3 Fälle in `tests/team.test.mjs`
  (`sicherNext` gut/böse, `maskiereEmail`) + 7 in `tests/einladung.test.mjs`
  (Betreff, Link in HTML und Text, Adress-Hinweis, Einlader und Kontakt,
  Fallback ohne Firmennamen, HTML-Entschärfung, kein Markdown).
  TDD: beide Testdateien liefen zuerst rot (`does not provide an export named
  'maskiereEmail'`), dann grün.
- `npx tsc --noEmit -p tsconfig.json | grep -v "^.next/"`: **leer.**
- `npx eslint` über alle geänderten Dateien: **keine Meldung.**
- Kein Live-Test möglich (kein Deploy aus diesem Worktree) — siehe Punkt 5.

---

## 5. Selbstprüfung Sicherheit und offene Punkte

**Geprüft und in Ordnung:**
1. **Token:** steht in keiner Antwort. `MITGLIED_FELDER` enthält ihn nicht, die
   Listenroute gibt ihn nicht heraus, die öffentliche Route liest ihn nur als
   Suchschlüssel. Formprüfung (`istToken`) vor jeder Abfrage. Jedes „Erneut
   senden" und jede Wiedereinladung setzt einen NEUEN Token — der alte Link
   stirbt, sonst hätte ein entferntes Mitglied nach der Wiedereinladung zwei
   gültige Links.
2. **Adressgleichheit:** `normalisiereEmail(user.email) === normalisiereEmail(zeile.email)`,
   beide Seiten normalisiert. Zusätzlich `user.email_confirmed_at` — die
   Adressgleichheit trägt nur, wenn die Adresse dem Konto wirklich gehört.
3. **Inhaberprüfung:** `einladen`, `POST [id]`, `DELETE [id]` prüfen
   `konto.istInhaber` → 403 `TEAM_TEXTE.nurInhaber`. Jede Abfrage auf eine
   Zeile trägt zusätzlich `inhaber_id = kontoId`; die RLS-Policy ist die zweite
   Verteidigungslinie, nicht die einzige.
4. **Öffentliche Route:** Firmenname, Status, maskierte Adresse. Keine
   Einlader-Adresse, keine Teamgröße, kein Plan, kein Token, `no-store`.
   `status='entfernt'` gibt 404 statt Firmenname — ein toter Link erzählt nichts.
5. **`next`:** `sicherNext` an allen drei Stellen, getestet. Der Callback war
   vorher offen; das ist jetzt geschlossen.
6. **Service-Role nur dort, wo sie sein muss:** öffentliche Token-Auskunft,
   Annehmen, Verlassen, Löschen einer offenen Einladung, Inhaber-Adresse. Jede
   dieser Abfragen ist über einen Wert gebunden, den der Aufrufer nicht frei
   wählen kann (`token` mit Formprüfung, `user.id`, vorher geprüfte `id`).

**Was offen bleibt / Aufmerksamkeit braucht:**
- **Supabase-Erlaubt-Liste:** `emailRedirectTo` trägt jetzt eine Query
  (`/auth/callback?next=…`). Steht in Supabase → Authentication → URL
  Configuration nur die exakte Adresse ohne Query, lehnt Supabase den Link ab.
  Vor dem Livegang prüfen, notfalls `https://app.getcraftflow.de/auth/callback*`
  eintragen. **Das ist der einzige Punkt, der den Einladungs-Registrierweg
  komplett lahmlegen kann.**
- **Wettlauf am Deckel:** Zwei Eingeladene, die gleichzeitig annehmen, passieren
  beide die Deckelprüfung und werden beide aktiv. Folge ist nicht ein
  Überschreiten des Plans, sondern dass der jüngere beim nächsten Laden als
  `ruhend` erscheint (Ruling R1 rechnet beim Lesen). Selbstheilend, deshalb
  nicht mit einer Sperre behandelt.
- **`TEAM_TEXTE` hat zwei Schlüssel mehr** (`andereAdresse`, `eigenerBetrieb`) —
  additiv, der Test prüft alle sechs. Task 4 kann sie für dieselben Sätze in der
  Oberfläche nutzen.
- **`src/app/api/team/gemeinsam.ts`** ist neu und steht nicht in der
  Dateistruktur des Plans (Link-Bau, Token-Prüfung, Laden, Versand). Begründung
  im Dateikopf: Einladen und Erneut-Senden bauen denselben Link, und zwei Kopien
  davon wären zwei Stellen, an denen die Adresse falsch werden kann.
- **Login → Registrieren** hängt das `next` erst beim Klick an. Wer JavaScript
  blockiert, verliert dort das Rücksprungziel — die Einladungsseite bietet beide
  Knöpfe aber direkt an, der Weg bleibt offen.
- **Verlassen löst die `user_id`** (siehe Routenteil). Falls Task 1 oder Task 4
  die `user_id` einer entfernten Zeile für eine Anzeige („war bis … im Team")
  brauchen sollte: Nach dem freiwilligen Verlassen ist sie weg, nach dem
  Entfernen durch den Inhaber steht sie noch da. Das war die einzige Möglichkeit,
  ohne Änderung an `src/lib/konto.ts` (nicht meine Datei) nach dem Verlassen auf
  `zustand: 'inhaber'` zu kommen.
- **Noch nie gelaufen:** Alle Routen und die Seite sind geprüft, aber nicht
  ausgeführt (Regel „Code lesen ist nicht prüfen"). Der Live-Test gehört in
  Task 5: Einladen → Resend-Log → Link im zweiten Browserprofil → annehmen →
  Plan auf Solo → Sperrseite.
