# Teamfunktion — Mitarbeiter im Betrieb

Stand: 2026-09-17. Entscheidungen von Fabian (17.09.): Teamfunktion bauen, mit mehreren Agenten
parallel; Mitarbeiter dürfen alles außer Inhaber-Dinge; Einladung per E-Mail-Link; Nutzer je Plan
wie in der Matrix (Solo 1, Starter 1, Pro 3, Enterprise unbegrenzt); die Teamfunktion gehört mit in
den Live-Gang.

## 1. Warum und was

Die Plan-Matrix und die Website bewerben „1 / 1 / 3 / unbegrenzt Nutzer“, aber jedes Konto war
bisher genau ein Login. Ein Betrieb mit drei Leuten konnte niemanden einladen. Ab jetzt:

- **Der Betrieb ist das Konto des Inhabers.** Alle Daten (Projekte, Kunden, Einstellungen,
  Kalibrierung, Preise, Dateien) bleiben unter der `user_id` des Inhabers — keine Tabelle wird
  umgebaut, kein Datensatz wandert.
- **Mitarbeiter** sind eigene Logins, die dem Betrieb zugeordnet sind. Sie arbeiten auf den Daten
  des Inhabers, als wären sie er — mit drei Ausnahmen: **Plan und Abo**, **Team verwalten**,
  **Betrieb löschen** bleiben beim Inhaber.
- Ein Mitarbeiter gehört zu genau einem Betrieb. Ein Inhaber kann selbst nirgends Mitarbeiter sein.

## 2. Datenmodell (neu, additiv)

```sql
create table betrieb_mitglieder (
  id            uuid primary key default gen_random_uuid(),
  inhaber_id    uuid not null references auth.users(id) on delete cascade,  -- der Betrieb
  user_id       uuid references auth.users(id) on delete cascade,           -- null bis zur Annahme
  email         text not null,                                             -- eingeladene Adresse (lowercase)
  rolle         text not null default 'mitarbeiter' check (rolle in ('mitarbeiter')),
  status        text not null default 'eingeladen' check (status in ('eingeladen','aktiv','entfernt')),
  token         uuid not null default gen_random_uuid(),                   -- Einladungslink
  eingeladen_am timestamptz not null default now(),
  angenommen_am timestamptz,
  unique (inhaber_id, email)
);
```
- **Aktive Mitglieder** = `status = 'aktiv'`. **Nutzer-Deckel** = Inhaber + aktive Mitglieder ≤
  `deckel(plan des Inhabers, 'nutzer')`; beim Wechsel nach unten bleiben die ältesten
  (`angenommen_am`) aktiv, weitere gelten als ruhend (`wendeDeckelAn`), nichts wird gelöscht.
- **Kontoauflösung:** `kontoIdFuer(user)` = `inhaber_id` des aktiven, nicht ruhenden Mitglieds
  mit `user_id = user.id`, sonst `user.id`. Ein ruhendes Mitglied sieht eine Sperrseite
  („Dein Betrieb hat aktuell weniger Nutzerplätze als Mitglieder — sprich mit dem Inhaber.“).

## 3. Zugriffsregeln (RLS)

Für jede Tabelle mit `user_id`-Policy `auth.uid() = user_id` wird die Policy zu
`user_id = auth.uid() OR user_id IN (select inhaber_id from betrieb_mitglieder where user_id = auth.uid() and status = 'aktiv')`
— per SQL-Funktion `public.konto_ids()` (security definer, stable), die genau diese Menge liefert;
die Policies rufen `user_id = any(public.konto_ids())`. Storage-Policies ebenso auf
`(storage.foldername(name))[1] = any(konto_ids()::text[])`. Ruhende Mitglieder bekommen über die
Funktion keinen Inhaber zurück (Deckel wird in der Funktion geprüft: Reihenfolge `angenommen_am`).

Serverseitig ersetzt `kontoIdFuer` den Ausdruck `user.id` in jedem Datenzugriff der Routen (Sweep,
siehe Umsetzungsplan). Inhaber-Dinge prüfen zusätzlich `user.id === kontoId`.

## 4. Einladung

1. Inhaber: Einstellungen → **Team** → E-Mail eingeben → „Einladen“. Route `POST /api/team/einladen`
   (Inhaber, Zugang, Deckel: eingeladen + aktiv + Inhaber ≤ Nutzer-Deckel, sonst 403 mit Plan-Text).
   Legt die Zeile an, schickt per Resend eine Mail: „{Inhaber} lädt dich zu CraftFlow ein“ mit
   Link `https://app.getcraftflow.de/einladung/<token>`.
2. Empfänger klickt: Seite `/einladung/[token]` (öffentlich): zeigt Betrieb und Einlader; wer nicht
   angemeldet ist, registriert sich oder meldet sich an (Rücksprung mit `?next=`); danach
   `POST /api/team/annehmen` → prüft Token, E-Mail muss zur angemeldeten Adresse passen, setzt
   `user_id`, `status = 'aktiv'`, `angenommen_am`. Ein Konto, das selbst schon Inhaber mit eigenen
   Projekten ist, wird abgelehnt („Dieses Konto ist bereits ein eigener Betrieb.“ — Inhaberprofil
   mit Projekten oder Abo).
3. Der Mitarbeiter sieht ab dann den Betrieb des Inhabers: Kopfzeile zeigt den Betriebsnamen und
   „Mitarbeiter“; Einstellungen ohne Mein Plan/Team/Betrieb löschen; kein eigener Trial-Balken
   (Plan des Inhabers gilt).
4. Inhaber kann Mitglieder entfernen (`status = 'entfernt'`, `user_id` bleibt für die Historie),
   Einladungen erneut senden oder löschen. Entfernte sehen beim nächsten Aufruf die Sperrseite
   und können sich einen eigenen Betrieb anlegen (Trial startet für sie regulär).

## 5. Was wo sichtbar ist

| Bereich | Inhaber | Mitarbeiter |
|---|---|---|
| Angebote, Projekte, Kunden, Kalkulation, PDF, Export | ja | ja |
| Einstellungen (Firmendaten, Kostenstellen, Kalibrierung, Preise, Bauweise, Texte, CI, E-Mail) | ja | ja |
| Wünsche (Vorschlagen/Stimmen) | ja | ja — Stimmenbudget hängt am Betrieb (Inhaber) |
| Mein Plan, Abo, Gutschein | ja | nur Anzeige „Plan des Betriebs: Pro“ |
| Team (einladen, entfernen) | ja | Liste sehen, nicht ändern |
| Betrieb/Konto löschen | ja | eigenes Mitarbeiter-Konto verlassen |

Zähler (Angebote/Monat, Optimieren-Runden) zählen je Betrieb (Inhaber-`user_id`).

## 6. Nicht in dieser Runde
Rollen mit abgestuften Rechten, mehrere Betriebe je Nutzer, Aktivitätsprotokoll je Mitarbeiter.

## 7. Umsetzung
Umsetzungsplan `docs/superpowers/plans/2026-09-17-teamfunktion.md`: Grundlage zuerst (SQL, konto.ts,
RLS), danach parallel: Routen-Sweep (aufgeteilt nach Ordnern), Einladung (Routen + Mail + Seite),
Team-Einstellungen (UI), Deckel/Ruhend/Sperrseite, Kopfzeile/Client-Zugriffe; zum Schluss
Gesamtprüfung und Live-Test mit einem zweiten Testkonto.
