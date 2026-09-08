-- Betriebskalibrierung: die Antworten des Nutzers und die daraus abgeleiteten
-- Zeitfaktoren. Im Supabase-Dashboard (SQL Editor) einmal ausfuehren.
-- Gehoert zu docs/superpowers/specs/2026-09-06-betriebskalibrierung-design.md
--
-- Getrennt von betriebsprofil, weil hier gerechnete Werte liegen, die jederzeit aus
-- den Antworten neu abgeleitet werden koennen — das Profil traegt Stammdaten.

create table if not exists betriebskalibrierung (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users(id) on delete cascade unique,

  mitarbeiter        text not null default '',
  maschinen          text[] not null default '{}',
  schwerpunkt        text not null default '',
  montage_selbst     text not null default '',
  stueckzahlen       text not null default '',

  antwort_grund      text not null default '',
  antwort_lack       text not null default '',
  antwort_massiv     text not null default '',
  antwort_montage    text not null default '',

  faktor_werkstatt   numeric(4,2) not null default 1.0,
  faktor_oberflaeche numeric(4,2) not null default 1.0,
  faktor_massivholz  numeric(4,2) not null default 1.0,
  faktor_montage     numeric(4,2) not null default 1.0,

  abgeschlossen      boolean not null default false,
  hinweis_gezeigt    boolean not null default false,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

comment on column betriebskalibrierung.antwort_lack is
  'Bandschluessel, oder "nicht" (macht er nicht) oder "unbekannt" (weiss er gerade nicht). '
  '"unbekannt" laesst den Faktor auf 1.0 und darf NICHTS versprechen, solange es die Lernschleife nicht gibt.';

comment on column betriebskalibrierung.hinweis_gezeigt is
  'Der Deckungshinweis erscheint genau einmal und blockiert nie.';

create index if not exists betriebskalibrierung_user_idx on betriebskalibrierung (user_id);

alter table betriebskalibrierung enable row level security;

drop policy if exists "eigene kalibrierung lesen"   on betriebskalibrierung;
drop policy if exists "eigene kalibrierung anlegen" on betriebskalibrierung;
drop policy if exists "eigene kalibrierung aendern" on betriebskalibrierung;

create policy "eigene kalibrierung lesen"   on betriebskalibrierung for select using (auth.uid() = user_id);
create policy "eigene kalibrierung anlegen" on betriebskalibrierung for insert with check (auth.uid() = user_id);
create policy "eigene kalibrierung aendern" on betriebskalibrierung for update using (auth.uid() = user_id);

-- PFLICHT. Ohne diese Zeile schlaegt jedes Schreiben fehl, obwohl RLS korrekt ist.
-- Genau das hat am 2026-09-05 bei materialpreise einen halben Tag gekostet.
grant select, insert, update, delete on betriebskalibrierung to authenticated;
