# Teamfunktion — Umsetzungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ein Betrieb (Inhaberkonto) kann Mitarbeiter per E-Mail-Link einladen; Mitarbeiter arbeiten auf den Daten des Inhabers, alles außer Plan/Abo, Team und Betrieb löschen. Nutzer-Deckel je Plan (Solo 1, Starter 1, Pro 3, Enterprise unbegrenzt), älteste bleiben aktiv.

**Architecture:** Additiv. Neue Tabelle `betrieb_mitglieder`, SQL-Funktion `konto_ids()` für RLS (Inhaber ODER aktives Mitglied), serverseitig `kontoIdFuer()` ersetzt `user.id` als Datenschlüssel in allen Routen. Deckel/„ruhend“ wird in der App-Schicht durchgesetzt (Ruling R1 unten), RLS ist die zweite Verteidigungslinie. Einladung = Zeile + Resend-Mail + Seite `/einladung/[token]`.

**Tech Stack:** Next.js App Router, Supabase (RLS, security-definer-Funktionen), Resend, Node-Tests (`npm run test`, `.ts` importfrei von React/Supabase in `src/lib`).

**Spec:** `docs/superpowers/specs/2026-09-17-teamfunktion-design.md` (bindend). Inventar: `.superpowers/sdd/2026-09-17-referenzprojekte/team-inventar.md`. Policies-Export: `.superpowers/sdd/2026-09-17-referenzprojekte/policies-all.txt` + `policies-rest.txt`.

## Global Constraints

- Sprache der Oberfläche Deutsch, Code Englisch/Deutsch wie im Repo; Kommentare erklären WARUM (Datum, Fabians Entscheidung).
- `src/lib/*.ts` importiert kein React und kein Supabase (Tests laufen mit Node direkt); `.ts`-Endung bei lib-Importen.
- Keine Kostenzahlen/Token in API-Antworten. Keine Nutzerdaten in öffentlichen Routen außer Firmenname des Einladers auf der Einladungsseite.
- Jede Route: `createClient()` + `auth.getUser()`; Datenschlüssel ist ab jetzt `kontoId` (aus `kontoIdFuer`), NICHT `user.id`. Ausnahmen (bleiben `user.id`): `consent`, `mail/willkommen`, `notify-signup`, Auth-Routen, Admin-Gates (`istAdmin(user.email)`), `admin/rundschreiben`, `stripe/webhook` (Service-Role, Stripe-Metadaten tragen bereits die Konto-ID).
- Inhaber-Dinge (`stripe/checkout`, `stripe/portal`, `gutschein`, `team/*` Schreibrouten, Betriebsprofil-Felder `plan`-nah) prüfen `konto.istInhaber`, sonst 403 `{ error: 'Nur der Inhaber des Betriebs kann das.' }`.
- Nichts wird gelöscht: entfernte Mitglieder → `status = 'entfernt'`, Zeile bleibt.
- Tests: `npm run test` grün, `npx tsc --noEmit -p tsconfig.json | grep -v "^.next/"` leer, ESLint keine NEUEN Fehler.
- Kein Push auf `main`. Commits auf dem eigenen Arbeitszweig (Worktree) bzw. `dev` (T1).

## Rulings (Controller, vor Start)

- **R1 Deckel in der App-Schicht:** Die Spec verlangt, dass `konto_ids()` ruhende Mitglieder ausschließt. Der effektive Plan (Trial 14 Tage = Enterprise, Gutschein, Abo-Status) lebt in `effektiverPlan()` (TypeScript) und läuft ohne Ereignis ab (Trial-Ende). Ihn in SQL zu spiegeln wäre eine zweite Rechenstelle. Entscheidung: `konto_ids()` liefert Inhaber für JEDES Mitglied mit `status = 'aktiv'`; die App (`kontoIdFuer`) berechnet bei jedem Aufruf, ob das Mitglied innerhalb des Deckels liegt (Reihenfolge `angenommen_am`), und liefert sonst `zustand: 'ruhend'` — jede Route antwortet dann 403, die Oberfläche zeigt die Sperrseite. Kosten bei Fehler: Ein ruhendes Mitglied könnte mit direktem Supabase-Client (nicht über Routen) Daten lesen — die Oberfläche hat nach T4 keinen solchen Zugriff mehr. Akzeptiert.
- **R2 Zähler je Betrieb:** `plan_usage`-RPCs (`reserviere_angebot`, `gib_angebot_frei`) nutzen `auth.uid()`. Sie werden in T1 auf `public.konto_id()` (Einzelwert: Inhaber-ID oder eigene ID) umgestellt, damit Mitarbeiter den Angebotszähler des Betriebs verbrauchen.
- **R3 Stimmen:** `wunsch_stimmen.user_id` wird ab jetzt mit `kontoId` geschrieben — das Stimmenbudget hängt am Betrieb (Spec §5). Bestehende Stimmen bleiben.
- **R4 Konto ohne Betriebsprofil annehmen:** Ein Konto darf eine Einladung annehmen, wenn es kein `betriebsprofil` hat ODER eines ohne Projekte und ohne `abo_status in ('active','trialing')`. Sonst „Dieses Konto ist bereits ein eigener Betrieb.“

---

## Dateistruktur

- `docs/sql/2026-09-17-teamfunktion.sql` — Tabelle, Funktionen, Policy-Umstellung (T1)
- `src/lib/konto.ts` — reine Logik: `ermittleKonto(...)`, `istImDeckel(...)`, Typen (T1)
- `src/lib/kontoserver.ts` — `kontoIdFuer(supabase, user)` mit Supabase (T1; darf Supabase-Typen importieren, liegt NICHT unter dem Test-Import)
- `src/lib/team.ts` — reine Logik: E-Mail-Prüfung, Deckelzählung, Sortierung, Mailtext-Bausteine (T1)
- `src/app/api/konto/route.ts` — GET: Konto-Zustand für die Oberfläche (T1)
- `src/app/api/team/route.ts` (GET Liste), `einladen/route.ts` (POST), `[id]/route.ts` (DELETE entfernen/Einladung löschen, POST erneut senden), `annehmen/route.ts` (POST), `verlassen/route.ts` (POST), `einladung/[token]/route.ts` (GET öffentlich) (T3)
- `src/lib/mail/vorlagen.ts` — `einladungsMail(...)` (T3)
- `src/app/einladung/[token]/page.tsx` — öffentliche Einladungsseite (T3)
- `src/app/login/page.tsx`, `register/page.tsx`, `auth/callback/route.ts`, `src/middleware.ts` — `next`-Rücksprung, PUBLIC_PATHS (T3)
- `src/components/settings/TeamSettings.tsx`, `src/app/settings/page.tsx`, `src/components/AppHeader.tsx`, `src/hooks/usePlan.ts`, `src/components/PlanGate.tsx`, `src/app/gesperrt/page.tsx` (T4)
- Routen-Sweep: alle Dateien unter `src/app/api/**` laut Inventar §2 (T2a/T2b/T2c)
- Tests: `tests/konto.test.mjs`, `tests/team.test.mjs` (T1), `tests/einladung.test.mjs` (T3)

---

### Task 1: Grundlage — SQL, Kontoauflösung, Team-Logik, `/api/konto`

**Files:**
- Create: `docs/sql/2026-09-17-teamfunktion.sql`
- Create: `src/lib/konto.ts`, `src/lib/kontoserver.ts`, `src/lib/team.ts`
- Create: `src/app/api/konto/route.ts`
- Test: `tests/konto.test.mjs`, `tests/team.test.mjs`

**Interfaces (Produces):**
```ts
// src/lib/konto.ts
export type KontoZustand = 'inhaber' | 'mitarbeiter' | 'ruhend' | 'entfernt'
export type Mitglied = { id: string; inhaber_id: string; user_id: string | null; email: string; status: 'eingeladen' | 'aktiv' | 'entfernt'; angenommen_am: string | null; eingeladen_am: string }
export type Konto = { kontoId: string; istInhaber: boolean; zustand: KontoZustand; mitglied: Mitglied | null }
export function ermittleKonto(userId: string, meineMitgliedschaften: Mitglied[], aktiveImBetrieb: Mitglied[], nutzerDeckel: number | null): Konto
export function istImDeckel(mitglied: Mitglied, aktiveImBetrieb: Mitglied[], nutzerDeckel: number | null): boolean
// src/lib/kontoserver.ts
export async function kontoIdFuer(supabase: SupabaseClient, user: { id: string }): Promise<Konto>
export function kontoGesperrt(konto: Konto): NextResponse | null   // 403 bei ruhend/entfernt
// src/lib/team.ts
export function emailGueltig(e: string): boolean
export function normalisiereEmail(e: string): string
export function plaetzeFrei(plan: EffektiverPlan, aktive: number, eingeladene: number): { frei: number | null; voll: boolean }
export function sortiereNachAnnahme<T extends { angenommen_am: string | null; eingeladen_am: string }>(l: T[]): T[]
export const TEAM_TEXTE = { nurInhaber: 'Nur der Inhaber des Betriebs kann das.', voll: (plan: string) => `Dein Plan ${plan} hat keine freien Nutzerplätze mehr.`, ruhend: 'Dein Betrieb hat aktuell weniger Nutzerplätze als Mitglieder — sprich mit dem Inhaber.', entfernt: 'Du gehörst diesem Betrieb nicht mehr an.' }
```

- [ ] **Step 1: Tests für konto.ts und team.ts schreiben** (`tests/konto.test.mjs`, `tests/team.test.mjs`):
  - `ermittleKonto('u1', [], [], 1)` → `{ kontoId: 'u1', istInhaber: true, zustand: 'inhaber', mitglied: null }`.
  - Mitglied aktiv, Deckel 3, zwei ältere aktive → `zustand: 'mitarbeiter'`, `kontoId = inhaber_id`.
  - Mitglied aktiv, Deckel 1 (Solo) → `zustand: 'ruhend'`, `kontoId = eigene id` (nie die des Inhabers!).
  - Deckel `null` (Enterprise) → immer `mitarbeiter`.
  - Deckel 3: Inhaber zählt als Platz 1; Mitglieder nach `angenommen_am` aufsteigend; das dritte aktive Mitglied ist ruhend.
  - Mitglied `status: 'entfernt'` → `zustand: 'entfernt'`, `kontoId = eigene id`.
  - `plaetzeFrei('pro', 1, 1)` → `{ frei: 0, voll: true }` (Inhaber + 1 aktiv + 1 eingeladen = 3); `plaetzeFrei('enterprise', 9, 9)` → `{ frei: null, voll: false }`; `plaetzeFrei('solo', 0, 0)` → `{ frei: 0, voll: true }`.
  - `emailGueltig('a@b.de')` true, `'a@b'` false, `normalisiereEmail(' A@B.DE ')` → `'a@b.de'`.
- [ ] **Step 2: Tests laufen lassen, müssen fehlschlagen** (`node --test tests/konto.test.mjs tests/team.test.mjs`).
- [ ] **Step 3: `src/lib/konto.ts` und `src/lib/team.ts` schreiben** (importfrei außer `./plaene.ts` für `deckel`/`EffektiverPlan`). `ermittleKonto`: aktive Mitgliedschaft des Nutzers suchen (`status === 'aktiv' && user_id === userId`); keine → Inhaber. Entfernt (nur `entfernt`, kein aktives) → `entfernt`. Aktiv → `istImDeckel`: Plätze für Mitglieder = `nutzerDeckel === null ? Infinity : max(0, nutzerDeckel - 1)`; Position des Mitglieds in `sortiereNachAnnahme(aktiveImBetrieb)`; Position < Plätze → `mitarbeiter`, sonst `ruhend`.
- [ ] **Step 4: Tests grün.**
- [ ] **Step 5: SQL schreiben** `docs/sql/2026-09-17-teamfunktion.sql` — vollständig, idempotent (`create table if not exists`, `create or replace function`, `drop policy if exists` + `create policy`):
```sql
-- Teamfunktion (Fabian 2026-09-17): Betrieb = Inhaberkonto, Mitarbeiter arbeiten auf dessen Daten.
create table if not exists public.betrieb_mitglieder (
  id            uuid primary key default gen_random_uuid(),
  inhaber_id    uuid not null references auth.users(id) on delete cascade,
  user_id       uuid references auth.users(id) on delete cascade,
  email         text not null,
  rolle         text not null default 'mitarbeiter' check (rolle in ('mitarbeiter')),
  status        text not null default 'eingeladen' check (status in ('eingeladen','aktiv','entfernt')),
  token         uuid not null default gen_random_uuid(),
  eingeladen_am timestamptz not null default now(),
  angenommen_am timestamptz,
  unique (inhaber_id, email)
);
create index if not exists betrieb_mitglieder_user_idx on public.betrieb_mitglieder (user_id) where status = 'aktiv';
create unique index if not exists betrieb_mitglieder_token_idx on public.betrieb_mitglieder (token);
alter table public.betrieb_mitglieder enable row level security;
grant select, insert, update on public.betrieb_mitglieder to authenticated;

-- Alle Konto-IDs, deren Daten der Angemeldete sehen darf: die eigene und die jedes
-- Betriebs, in dem er aktives Mitglied ist. Deckel/„ruhend“ prüft die App (Ruling R1).
create or replace function public.konto_ids() returns uuid[]
language sql stable security definer set search_path = public as $$
  select array_append(
    coalesce(array_agg(m.inhaber_id), '{}'::uuid[]), auth.uid())
  from public.betrieb_mitglieder m
  where m.user_id = auth.uid() and m.status = 'aktiv'
$$;
-- Genau EINE Konto-ID für Zähler (plan_usage): der Betrieb, sonst man selbst.
create or replace function public.konto_id() returns uuid
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select m.inhaber_id from public.betrieb_mitglieder m
      where m.user_id = auth.uid() and m.status = 'aktiv'
      order by m.angenommen_am limit 1),
    auth.uid())
$$;
grant execute on function public.konto_ids() to authenticated;
grant execute on function public.konto_id() to authenticated;

-- Policies auf betrieb_mitglieder: Inhaber sieht/ändert sein Team, Mitglied sieht sein Team.
drop policy if exists "team lesen" on public.betrieb_mitglieder;
create policy "team lesen" on public.betrieb_mitglieder for select
  using (inhaber_id = any(public.konto_ids()) or user_id = auth.uid());
drop policy if exists "inhaber lädt ein" on public.betrieb_mitglieder;
create policy "inhaber lädt ein" on public.betrieb_mitglieder for insert
  with check (inhaber_id = auth.uid());
drop policy if exists "inhaber ändert team" on public.betrieb_mitglieder;
create policy "inhaber ändert team" on public.betrieb_mitglieder for update
  using (inhaber_id = auth.uid()) with check (inhaber_id = auth.uid());
-- Annehmen/Verlassen laufen über die Service-Role (Route prüft Token bzw. Mitgliedschaft).
```
  Danach für JEDE Tabelle aus `policies-all.txt` + `policies-rest.txt` die vorhandenen Policies neu setzen (`drop policy if exists "<name>" on public.<tabelle>; create policy "<name>" on public.<tabelle> for <cmd> using (user_id = any(public.konto_ids())) [with check (user_id = any(public.konto_ids()))];` — Namen, cmd, using/with_check exakt aus dem Export, nur `auth.uid() = user_id` → `user_id = any(public.konto_ids())`). Sonderfälle: `supplier_categories`/`supplier_contacts`: `s.user_id = any(public.konto_ids())`. `wuensche` „Wünsche lesen“ (status <> 'ausgeblendet') und „eigene Wünsche anlegen“ (`user_id = any(public.konto_ids()) and status = 'offen' and zusammengelegt_in is null`). `plan_usage`: die drei Policies auf `user_id = any(public.konto_ids())`; die RPCs `reserviere_angebot`/`gib_angebot_frei` aus `docs/sql/2026-09-16-angebot-reservieren.sql` mit `public.konto_id()` statt `auth.uid()` neu anlegen (Funktionstext von dort kopieren, nur diesen Ausdruck tauschen). Storage (`storage.objects`): jede Policy aus dem Export mit `(storage.foldername(name))[1] = any(select k::text from unnest(public.konto_ids()) k)` statt `= (auth.uid())::text`; öffentliche Lese-Policies unverändert. `betriebsprofil`, `betriebskalibrierung`, `email_config`: Policies wie oben (Unique bleibt auf `user_id` = Inhaber; Routen schreiben mit `kontoId`). NICHT anfassen: `consent_log`, `gutscheincodes`, `optim_events` (kein Export → prüfen, ob Policy existiert; wenn `auth.uid() = user_id`, ebenfalls umstellen und im Report nennen).
- [ ] **Step 6: `src/lib/kontoserver.ts`**: `kontoIdFuer` lädt `betrieb_mitglieder` (Cookie-Client, RLS „team lesen“) für `user_id = user.id` (alle Status), dazu bei aktiver Mitgliedschaft alle aktiven Mitglieder des Betriebs (`inhaber_id = mitglied.inhaber_id and status='aktiv'`) und den effektiven Plan des Inhabers (`ladeEffektivenPlan(supabase, inhaber_id)` — RLS auf betriebsprofil erlaubt das über konto_ids). Dann `ermittleKonto(user.id, meine, aktive, deckel(plan, 'nutzer'))`. Supabase-Fehler → `console.error` und Konto = Inhaber (Fail-Closed wäre: der Nutzer sieht nur eigene, leere Daten — kein Fremdzugriff). `kontoGesperrt(konto)` → 403 mit `TEAM_TEXTE.ruhend`/`entfernt`, sonst null.
- [ ] **Step 7: `src/app/api/konto/route.ts` GET** → `{ kontoId, istInhaber, zustand, betriebName, plan }` (`betriebName` aus `betriebsprofil.firma_name` des Kontos, `plan` = effektiver Plan des Kontos). Kein 403 bei ruhend — die Oberfläche braucht den Zustand für die Sperrseite.
- [ ] **Step 8: `npm run test`, tsc, eslint; Commit** `feat(team): Grundlage — betrieb_mitglieder, konto_ids(), kontoIdFuer, /api/konto`. Die SQL führt der Controller aus (`node .tmp-cu/supa-sql.mjs --file docs/sql/2026-09-17-teamfunktion.sql --confirm`) und prüft danach: `select count(*) from pg_policies where qual like '%konto_ids%' or with_check like '%konto_ids%'` ≥ 45.

### Task 2a: Routen-Sweep `settings/**`

**Files:** alle `src/app/api/settings/**/route.ts` (bauweise, betriebsprofil, email-config, email-test, init, kalibrierung + als-projekt, kostenstellen, materialgruppen, materialpreise, suppliers + bulk, textbausteine).

**Consumes:** `kontoIdFuer`, `kontoGesperrt` aus `@/lib/kontoserver`; `TEAM_TEXTE` aus `@/lib/team`.

- [ ] Muster in jeder Route direkt nach `auth.getUser()`:
```ts
const konto = await kontoIdFuer(supabase, user)
const sperre = kontoGesperrt(konto); if (sperre) return sperre
const kontoId = konto.kontoId
```
  Dann JEDE Stelle `user.id` als Datenschlüssel (`.eq('user_id', user.id)`, `user_id: user.id`, `ladeKalibrierung(supabase, user.id)`, `pruefeZugang(supabase, user.id)`, `pruefeFunktion(supabase, user.id, …)`, `ladeEffektivenPlan(supabase, user.id)`, RPC-Parameter `p_user_id`) → `kontoId`. `settings/init` (RPC `init_betriebsprofil`): nur ausführen, wenn `konto.istInhaber` (ein Mitarbeiter legt kein eigenes Profil an). `betriebsprofil` PATCH: bleibt für alle (Firmendaten dürfen Mitarbeiter ändern), Sperrliste `profilfelder.ts` unverändert.
- [ ] Je Datei: `grep -n "user\.id" <datei>` muss danach nur noch Auth-/Log-Stellen zeigen (im Report auflisten).
- [ ] tsc, eslint, `npm run test`; Commit `refactor(api): settings-Routen rechnen mit der Konto-ID des Betriebs`.

### Task 2b: Routen-Sweep Projekte/Kalkulation

**Files:** `analyze/**` (route, block, vorbereiten, gemeinsam.ts falls user.id), `projects/**`, `upload/route.ts`, `upload-briefpapier/route.ts`, `offer-versions`, `generate-pdf`, `optimize`, `assistant`, `tracking`, `usage`, `analytics`, `lernschleife`, `gaeb/**`, `parse-pdf`, `transcribe`, `customers`.

- [ ] Gleiches Muster wie 2a. Storage-Pfade (`src/lib/upload.ts` Aufrufer, `upload-briefpapier`): `${kontoId}/…` statt `${user.id}/…`; `src/lib/briefpapier.ts` Herkunftsprüfung bekommt die `kontoId` übergeben (Signatur prüfen, Aufrufer anpassen). `tracking`: alle neun Stellen. Zähler (`usage`, `optimize` `optimieren_runden`, `angebotszaehler.ts` `plan_usage`) → `kontoId`.
- [ ] Commit `refactor(api): Projekt- und Kalkulationsrouten rechnen mit der Konto-ID`.

### Task 2c: Routen-Sweep Lieferanten, Wünsche, Stripe, Gutschein

**Files:** `suppliers/**`, `wuensche/route.ts`, `wuensche/[id]/stimme/route.ts`, `stripe/checkout`, `stripe/portal`, `gutschein`, `admin/plan`.

- [ ] Muster wie 2a. `wuensche`: Stimmen mit `kontoId` (Ruling R3), Budget aus dem Profil des Kontos. `stripe/checkout`, `stripe/portal`, `gutschein`: zusätzlich `if (!konto.istInhaber) return NextResponse.json({ error: TEAM_TEXTE.nurInhaber }, { status: 403 })`; Metadaten `userId: kontoId`. `admin/plan`: unverändert (Admin-Gate), Ziel-`user_id` ist die Konto-ID des Admins.
- [ ] Commit `refactor(api): Lieferanten, Wünsche und Abo-Routen rechnen mit der Konto-ID; Abo nur Inhaber`.

### Task 3: Einladung — Routen, Mail, Seite, Rücksprung

**Files:** `src/app/api/team/route.ts`, `einladen/route.ts`, `[id]/route.ts`, `annehmen/route.ts`, `verlassen/route.ts`, `einladung/[token]/route.ts`; `src/lib/mail/vorlagen.ts`; `src/app/einladung/[token]/page.tsx`; `src/app/login/page.tsx`, `src/app/register/page.tsx`, `src/app/auth/callback/route.ts`, `src/middleware.ts`; Test `tests/einladung.test.mjs` (Mailtext, `next`-Prüfung).

- [ ] **Routen** (alle mit `kontoIdFuer`; Schreibrouten nur Inhaber → 403 `TEAM_TEXTE.nurInhaber`):
  - `GET /api/team` → `{ inhaber: { email }, mitglieder: [{ id, email, status, angenommen_am, eingeladen_am, ruhend }] , plaetze: { deckel, belegt, frei } }` — für Inhaber und Mitarbeiter (Mitarbeiter: nur lesen). `ruhend` über `istImDeckel`. E-Mails der Mitglieder darf das Team sehen (Betriebsintern).
  - `POST /api/team/einladen` `{ email }` → `emailGueltig`, `normalisiereEmail`; eigene Adresse ablehnen; `plaetzeFrei(plan, aktive, eingeladene)` → 403 `TEAM_TEXTE.voll(PLAN_LABELS[plan])`; vorhandene Zeile mit gleicher E-Mail und `status='entfernt'` → wieder auf `eingeladen` mit neuem Token; sonst insert. Mail über `sendeMail(email, einladungsMail({ betriebName, einladerEmail, link }))`, Link `https://app.getcraftflow.de/einladung/<token>`. Antwort `{ ok: true, id }`. Mailfehler → 502 mit Grund, Zeile bleibt (erneut senden möglich).
  - `POST /api/team/[id]` → Einladung erneut senden (neuer Token). `DELETE /api/team/[id]` → `status = 'entfernt'` (bei `eingeladen`: Zeile löschen).
  - `GET /api/team/einladung/[token]` (öffentlich, Service-Role, in PUBLIC_PATHS) → `{ betriebName, email (maskiert: a***@b.de), status }` oder 404.
  - `POST /api/team/annehmen` `{ token }` (angemeldet): Service-Role; Zeile mit Token und `status='eingeladen'`; `normalisiereEmail(user.email) === zeile.email` sonst 403 „Die Einladung gilt für eine andere E-Mail-Adresse.“; Ruling R4 prüfen (eigenes Betriebsprofil mit Projekten oder aktivem Abo → 409 „Dieses Konto ist bereits ein eigener Betrieb.“); Deckel prüfen (`plaetzeFrei` gegen aktive, eingeladene nicht zählen) → 403 voll; update `user_id, status='aktiv', angenommen_am=now()`.
  - `POST /api/team/verlassen` → eigene aktive Mitgliedschaft auf `entfernt`.
- [ ] **Mail** `einladungsMail({ betriebName, einladerEmail, link }): Mail` in `vorlagen.ts` — Betreff „{betriebName} lädt dich zu CraftFlow ein“, kurzer Text, Link, Hinweis „Melde dich mit genau dieser E-Mail-Adresse an“, Kontakt. Test: Betreff und Link enthalten.
- [ ] **Seite** `/einladung/[token]` (Client-Komponente): lädt `GET /api/team/einladung/<token>`; zeigt „{betriebName} lädt dich ein“; nicht angemeldet → zwei Knöpfe `Anmelden` (`/login?next=/einladung/<token>`) und `Registrieren` (`/register?next=/einladung/<token>`); angemeldet → Knopf „Einladung annehmen“ → `POST /api/team/annehmen` → Erfolg: „Du gehörst jetzt zu {betriebName}.“ + Link `/`; Fehler sichtbar mit Grund.
- [ ] **Rücksprung `next`:** `login`: nach Erfolg `router.push(sicherNext(searchParams.get('next')))`; `register`: `emailRedirectTo: https://app.getcraftflow.de/auth/callback?next=<encoded>`; `auth/callback`: nach Session-Tausch Redirect auf `next`, wenn `sicherNext` (nur relative Pfade, beginnt mit `/`, kein `//`). `sicherNext` in `src/lib/team.ts` (rein, Test).
- [ ] **Middleware:** PUBLIC_PATHS um `/einladung` und `/api/team/einladung` ergänzen (volle Pfade, Kommentar wie bei `/api/wuensche/oeffentlich`).
- [ ] tsc, eslint, `npm run test`; Commit `feat(team): Einladung per E-Mail-Link, Annehmen, Verlassen, Rücksprung nach Login`.

### Task 4: Oberfläche — Team-Einstellungen, Kopfzeile, Plan-Sicht, Sperrseite

**Files:** `src/components/settings/TeamSettings.tsx` (neu), `src/app/settings/page.tsx`, `src/components/AppHeader.tsx`, `src/hooks/usePlan.ts`, `src/components/PlanGate.tsx`, `src/app/gesperrt/page.tsx` (neu), Logo-Upload in `settings/page.tsx`.

- [ ] **`usePlan`:** liest nicht mehr direkt `betriebsprofil` vom Client, sondern `GET /api/konto` (liefert `plan`, `trial_starts_at`, `abo_status`, `plan_gueltig_bis` des KONTOS — T1-Route um diese Felder erweitern, Feld-Namen wie bisher) plus `istInhaber`, `zustand`, `betriebName`. Gleiche Ausgabe wie bisher + `istInhaber`, `zustand`, `betriebName`. Notbremse/Retry beibehalten.
- [ ] **Sperrseite** `/gesperrt`: Text `TEAM_TEXTE.ruhend` bzw. `entfernt`, Knopf „Eigenen Betrieb anlegen“ (→ `POST /api/team/verlassen`, dann `/settings`) und „Abmelden“. `PlanGate`: wenn `zustand` ruhend/entfernt → Redirect `/gesperrt`.
- [ ] **Kopfzeile:** Mitarbeiter sehen `betriebName` und Chip „Mitarbeiter“; Trial-Balken nur `istInhaber`.
- [ ] **Einstellungen:** Nav-Eintrag `{ id: 'team', label: 'Team', icon: '👥' }` vor „Mein Plan“; Bereich `TeamSettings`: Liste (E-Mail, Status: Eingeladen/Aktiv/Ruhend, Datum), Inhaber: Feld E-Mail + „Einladen“, je Zeile „Erneut senden“/„Entfernen“ (mit Bestätigung, lesbare Schrift auf dem roten Knopf — siehe Fehler 16.09.), Plätze-Zeile „2 von 3 Plätzen belegt“ mit Link zu „Mein Plan“ wenn voll; Mitarbeiter: nur Liste + Knopf „Betrieb verlassen“. „Mein Plan“: für Mitarbeiter nur Anzeige „Plan des Betriebs: {Label}“ ohne Kauf-/Gutschein-Knöpfe. Kein Bereich „Betrieb löschen“ existiert heute — nichts zu verstecken.
- [ ] **Logo-Upload** (`settings/page.tsx`): Pfad `${kontoId}/logo.<ext>` mit `kontoId` aus `usePlan`.
- [ ] tsc, eslint; Commit `feat(team): Team-Einstellungen, Kopfzeile, Plan-Sicht für Mitarbeiter, Sperrseite`.

### Task 5: Zusammenführen, Gesamtprüfung, Live-Test (Controller)

- [ ] Zweige T2a/T2b/T2c/T3/T4 nacheinander in `dev` mergen (Konflikte melden), `npm run test`, tsc, eslint, Rundgang `grep -rn "user\.id" src/app/api | grep -v "consent\|willkommen\|notify\|rundschreiben\|webhook\|istAdmin\|email"` → Restliste im Ledger begründen.
- [ ] SQL ausführen (falls noch nicht), Policies zählen.
- [ ] Live-Test auf dev mit zweitem Testkonto (Supabase-Dashboard → Add user, E-Mail bestätigt): Einladen als test@fscrafted.de → Mail landet (Resend-Log) → Link im zweiten Chrome-Profil/Inkognito öffnen → annehmen → als Mitarbeiter: Projekte des Inhabers sichtbar, Angebot rechnen, Einstellungen ohne Mein-Plan-Kauf, Team-Liste nur lesen → als Inhaber: Plan auf Solo stellen (Admin-Umschalter) → Mitarbeiter sieht Sperrseite → zurück auf Enterprise.
- [ ] Prüfprotokoll-Abschnitt in `docs/pruefprotokolle/2026-09-17-teamfunktion.md`, CLAUDE.md-Abschnitt „Teamfunktion“, Vault-Notiz.
