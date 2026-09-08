-- Eigene Textbausteine, Kleinunternehmerregelung und tote Felder beleben
--
-- Aus Fabians Fragen vom 2026-09-08:
--   "Wäre es nicht gut, wenn sich Kunden eigene Textbausteine bauen können?"
--   "Sind die Informationen aus Buchhaltung und Dokumente auch wirklich mit dem
--    Erstellen des Angebots verknüpft?"
--
-- Beim Nachprüfen gefunden: Die Mehrwertsteuer steht mit 19 % FEST im Code. Für
-- einen Kleinunternehmer nach § 19 UStG erzeugt CraftFlow damit ein formal falsches
-- Angebot — es weist Umsatzsteuer aus, die er nicht berechnen darf. Ebenso fest
-- verdrahtet: die Gültigkeit von 30 Tagen. Und die Steuernummer wird abgefragt,
-- aber nirgends gedruckt — für wen keine USt-IdNr. hat, ist sie die Pflichtangabe.
--
-- Ausführen im Supabase SQL-Editor.

alter table public.betriebsprofil
  add column if not exists kleinunternehmer boolean default false,
  add column if not exists mwst_satz numeric default 19,
  add column if not exists angebot_gueltig_tage integer default 30;

-- ── Eigene Textbausteine ────────────────────────────────────────────────────
-- Beliebig viele benannte Blöcke. "immer" heißt: steht ohne Zutun in jedem neuen
-- Angebot. Sonst wird er im Angebot einzeln dazugeklickt.
create table if not exists public.textbausteine (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  titel text not null,
  inhalt text not null default '',
  immer boolean not null default false,
  reihenfolge integer not null default 0,
  aktiv boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists textbausteine_user_idx
  on public.textbausteine (user_id, reihenfolge);

alter table public.textbausteine enable row level security;

-- Rechte UND Policy — beides. Ohne GRANT: "permission denied". Ohne Policy: die
-- Abfrage läuft durch und liefert nichts, ohne Fehler. Der zweite Fall ist der
-- gefährlichere (gelernt am 2026-09-07 an offer_versions).
grant select, insert, update, delete on table public.textbausteine to authenticated;

drop policy if exists "textbausteine_own" on public.textbausteine;
create policy "textbausteine_own" on public.textbausteine
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Kontrolle
select column_name from information_schema.columns
 where table_name = 'betriebsprofil'
   and column_name in ('kleinunternehmer','mwst_satz','angebot_gueltig_tage','steuernummer')
 order by column_name;

select grantee, privilege_type from information_schema.role_table_grants
 where table_name = 'textbausteine' and grantee = 'authenticated'
 order by privilege_type;
