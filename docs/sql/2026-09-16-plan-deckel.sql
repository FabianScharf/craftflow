-- Zähler für Optimieren-Runden je Angebot (Deckel je Plan, Spec 2026-09-15).
create table if not exists optimieren_runden (
  user_id    uuid not null references auth.users(id) on delete cascade,
  projekt_id text not null,            -- projects.id oder 'ohne-projekt' vor dem ersten Speichern
  runden     int  not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, projekt_id)
);
alter table optimieren_runden enable row level security;
create policy "eigene Runden lesen"    on optimieren_runden for select using (auth.uid() = user_id);
create policy "eigene Runden anlegen"  on optimieren_runden for insert with check (auth.uid() = user_id);
create policy "eigene Runden ändern"   on optimieren_runden for update using (auth.uid() = user_id);
-- Nutzerkonten und Dateien brauchen keine Tabelle: Dateien zählt die Analyse je Anfrage,
-- Nutzer gibt es noch nicht (Mehrbenutzer ist nicht gebaut).
