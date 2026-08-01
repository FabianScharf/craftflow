-- Bauweise-Vault: nutzerindividuell gelernte Kalkulationsregeln.
-- Im Supabase-Dashboard (SQL Editor) einmal ausführen.
-- Gehört zu docs/superpowers/specs/2026-07-31-lernfunktion-bauweise-vault-design.md

create table if not exists bauweise_regeln (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  bereich          text not null,
  wenn             text not null default '',
  dann             text not null,
  herkunft         text not null default 'gelernt',
  quelle_text      text not null default '',
  beleg            text not null default '',
  aktiv            boolean not null default true,
  gesendet_zahl    integer not null default 0,
  zuletzt_gesendet timestamptz,
  konflikt_hinweis boolean not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists bauweise_regeln_user_idx on bauweise_regeln (user_id, aktiv);

-- updated_at hat keinen Trigger — wird bewusst explizit von den Routes gesetzt
-- (POST/PUT in src/app/api/settings/bauweise/route.ts), nicht automatisch.
comment on column bauweise_regeln.updated_at is
  'Kein DB-Trigger. Wird explizit von den Routes (POST/PUT /api/settings/bauweise) gesetzt.';

-- Check-Constraints als Verteidigung in der Tiefe hinter der Routen-Validierung
-- (pruefeBereich in src/app/api/settings/bauweise/route.ts). Idempotent: nur
-- anlegen, wenn noch nicht vorhanden, damit das Skript gefahrlos erneut
-- ausgeführt werden kann.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'bauweise_regeln_bereich_check'
  ) then
    alter table bauweise_regeln
      add constraint bauweise_regeln_bereich_check
      check (bereich in ('Material', 'Konstruktion', 'Zeit', 'Oberfläche', 'Montage', 'Sonstiges'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'bauweise_regeln_herkunft_check'
  ) then
    alter table bauweise_regeln
      add constraint bauweise_regeln_herkunft_check
      check (herkunft in ('gelernt', 'manuell'));
  end if;
end $$;

alter table bauweise_regeln enable row level security;

drop policy if exists "eigene Regeln lesen"   on bauweise_regeln;
drop policy if exists "eigene Regeln anlegen" on bauweise_regeln;
drop policy if exists "eigene Regeln aendern" on bauweise_regeln;
drop policy if exists "eigene Regeln loeschen" on bauweise_regeln;

create policy "eigene Regeln lesen"    on bauweise_regeln for select using (auth.uid() = user_id);
create policy "eigene Regeln anlegen"  on bauweise_regeln for insert with check (auth.uid() = user_id);
create policy "eigene Regeln aendern"  on bauweise_regeln for update using (auth.uid() = user_id);
create policy "eigene Regeln loeschen" on bauweise_regeln for delete using (auth.uid() = user_id);

-- Zähler in EINER Abfrage hochsetzen. security invoker → RLS greift, ein Nutzer
-- kann damit nur seine eigenen Regeln hochzählen.
create or replace function bauweise_regeln_gesendet(regel_ids uuid[])
returns void
language sql
security invoker
set search_path = public
as $$
  update bauweise_regeln
     set gesendet_zahl    = gesendet_zahl + 1,
         zuletzt_gesendet = now()
   where id = any(regel_ids);
$$;
