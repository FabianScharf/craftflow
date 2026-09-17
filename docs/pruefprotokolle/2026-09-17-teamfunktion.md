# Prüfprotokoll Teamfunktion — 17.09.2026 (abends)

Spec: `docs/superpowers/specs/2026-09-17-teamfunktion-design.md` · Plan: `docs/superpowers/plans/2026-09-17-teamfunktion.md` · Ledger: `.superpowers/sdd/2026-09-17-teamfunktion/progress.md`

## 1. Was gebaut wurde

- **Grundlage (T1):** Tabelle `betrieb_mitglieder`, SQL-Funktionen `konto_ids()` / `konto_id()`, 51 RLS-Policies auf `user_id = any(konto_ids())` umgestellt (inkl. Storage), RPCs `reserviere_angebot`/`gib_angebot_frei` auf `konto_id()`. `src/lib/konto.ts` (`ermittleKonto`, Deckel „ruhend“ nach `angenommen_am`), `src/lib/kontoserver.ts` (`kontoIdFuer`, `kontoGesperrt`), `src/lib/team.ts`, `GET /api/konto`.
- **Routen-Sweep (T2a/b/c):** alle 50 Routen rechnen mit `kontoId` statt `user.id`; Inhaber-Dinge (Stripe-Checkout, Portal, Gutschein) nur für Inhaber (403).
- **Einladung (T3):** `POST /api/team/einladen`, `POST/DELETE /api/team/[id]`, `POST /api/team/annehmen`, `POST /api/team/verlassen`, öffentlich `GET /api/team/einladung/[token]`; Resend-Mail `einladungsMail`; Seite `/einladung/[token]`; `next`-Rücksprung in Login/Register/Callback mit `sicherNext`.
- **Oberfläche (T4):** Bereich „Team“ in den Einstellungen, Kopfzeile mit Betriebsname + „Mitarbeiter“, `usePlan` über `/api/konto`, „Mein Plan“ nur lesend für Mitarbeiter, Sperrseite `/gesperrt`.
- Parallel gebaut von fünf Agenten in eigenen Worktrees, jeweils mit Spec- und Qualitätsprüfung; Task 3 mit einer Fix-Runde (vier Befunde, alle behoben).

## 2. Rulings

R1 Deckel in der App-Schicht (nicht in SQL) · R2 Zähler je Betrieb · R3/R6 Stimmen und Wünsche gehören dem Betrieb · R4 Annahme nur ohne eigene Projekte/Abo · R5 `/api/konto` liefert Profilfelder für usePlan · R7 „Verlassen“ setzt `user_id = null`, Zeile bleibt.

## 3. Live-Test auf dev (Fabian mit fabianscharf@icloud.com, Inhaber l.m.p.1@gmx.de „fs crafted“)

| Schritt | Ergebnis |
|---|---|
| Inhaber: Team-Bereich, Einladen, Liste, Löschen einer Einladung | ✓ |
| Einladungsmail über Resend, Link auf die dev-Vorschau | ✓ (Link auf Vorschau nur bei `VERCEL_ENV=preview`) |
| Registrierung über den Link | ✓ Konto angelegt — **aber** Bestätigungsmail führt fest auf die Live-Adresse, dort Sitzung, auf dev keine; Passwort musste zurückgesetzt werden (Ursache offen, siehe §5) |
| Annahme | ✗ zuerst 500 — zwei Fehler gefunden und behoben (§4) — dann ✓ `status=aktiv`, angenommen 21:26 |
| Inhaberliste zeigt „Aktiv“ | ✓ |
| Mitarbeitersicht in Chrome (iCloud-Konto): Kopfzeile „FS CRAFTED · MITARBEITER“, 25 Projekte des Betriebs, Profil/Kalibrierung/Kostenstellen des Betriebs, Nutzung des Betriebs, Team nur lesend mit „Betrieb verlassen“, Mein Plan „Plan des Betriebs: Enterprise“ ohne Kaufknöpfe | ✓ |
| Verbotene Aktionen als Mitarbeiter: Stripe-Checkout, Portal, Gutschein, Einladen → 403 „Nur der Inhaber des Betriebs kann das.“; PATCH mit `plan` wirkungslos (Whitelist) | ✓ |
| Deckel: Inhaber per SQL auf Starter (1 Nutzer) → Mitarbeiter sofort `zustand=ruhend`, Umleitung auf `/gesperrt` mit richtigem Text, `/api/projects` 403, kontoId = eigene ID; zurück auf Enterprise → wieder `mitarbeiter` | ✓ |

## 4. Gefunden und behoben

1. **`count: 'exact', head: true` über die Service-Role** lieferte einen Fehler ohne Meldung → Annahme 500. Beide Stellen in `annehmen` durch gewöhnliche Abfragen ersetzt (aa9bdff, c24a946).
2. **Service-Role ohne SELECT auf 14 Tabellen** (projects, kostenstellen, materialpreise, bauweise_regeln, betriebskalibrierung, email_config, consent_log, optim_events, angebot_*, benchmark_cache, gutscheincodes, materialgruppen, textbausteine) — Altlast aus dem Dashboard. `docs/sql/2026-09-17-service-role-rechte.sql` ausgeführt (GRANT + Default-Privileges).
3. Einladungsseite zeigte „Anmelden“ und „Registrieren“ nebeneinander → jetzt nur der passende Weg (`kontoVorhanden` aus der Route), df5e0a7.
4. Startseite leitet ruhende/entfernte Mitglieder auf `/gesperrt` (Fund aus Task 4).

## 5. Offen vor dem Live-Gang

- Passwort nach Registrierung über den Einladungsweg zweimal „nicht funktioniert“ — mit frischer Adresse nachstellen (Bestätigungslink → Live-Adresse → Sitzung; dev-Vorschau ohne Sitzung).
- Gesamtprüfung des ganzen Zweigs (Opus): „bereit“, 0 kritisch, 2 wichtig + 9 klein; I1 (ruhende Mitglieder in SQL sperren, Spalte `ruht`), M2, M4, M9 behoben (bf0dc3b); M1/M3/M5–M8 geparkt (`final-review-report.md`).
- Hilfe-Assistent kennt „Team“ (EINSTELLUNGSBEREICHE), CLAUDE.md-Abschnitt folgt.

## 6. Live-Gang

17.09. nachts auf Fabians Wort: main = dev = 33ae968 (Merge mit einem Konflikt in `src/middleware.ts` PUBLIC_PATHS, dev-Fassung übernommen). Website unverändert. Produktionsproben nach dem Build (alle wie erwartet): Stripe-Webhook POST 400 · Cron-Route ohne Secret 401 · `/api/team` ohne Anmeldung 307 auf /login · Einladungsseite öffentlich 200 · Einladungs-API mit unbekanntem Token 404 · Startseite 307 auf /login · Roadmap-API 200.
