-- Materialpreise: vom Nutzer fixierte Einkaufspreise.
-- Im Supabase-Dashboard (SQL Editor) einmal ausfuehren.
-- Gehoert zu docs/superpowers/specs/2026-09-05-lernabfrage-im-chat-design.md
--
-- Bewusst getrennt von bauweise_regeln: Der Bauweise-Vault bleibt preisfrei
-- (Engine-Invariante "der Vault beeinflusst nie vkStunde, aufschlag oder Preise").

create table if not exists materialpreise (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  bezeichnung text not null,
  ek          numeric(12,2) not null check (ek >= 0),
  einheit     text not null default 'Stk',
  lieferant   text not null default '',
  stand       date not null default current_date,
  aktiv       boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists materialpreise_user_idx on materialpreise (user_id, aktiv);

comment on column materialpreise.stand is
  'Datum der letzten Bestaetigung. EK-Preise veralten — das UI markiert Eintraege aelter als 12 Monate.';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'materialpreise_einheit_check') then
    alter table materialpreise add constraint materialpreise_einheit_check
      check (einheit in ('Stk', 'm2', 'lfdm', 'm3', 'kg', 'pauschal'));
  end if;
end $$;

-- NICHT WEGLASSEN. Supabase vergibt diese Rechte bei neuen Tabellen nicht
-- zuverlaessig automatisch; ohne sie existiert die Tabelle, die Policies greifen,
-- und trotzdem scheitert jedes Speichern.
-- Vorfall 2026-09-05: bauweise_regeln hatte nur REFERENCES/TRIGGER/TRUNCATE,
-- waehrend die funktionierende Tabelle projects zusaetzlich
-- SELECT/INSERT/UPDATE/DELETE besass.
grant select, insert, update, delete on table materialpreise to authenticated;

alter table materialpreise enable row level security;

drop policy if exists "eigene Preise lesen"    on materialpreise;
drop policy if exists "eigene Preise anlegen"  on materialpreise;
drop policy if exists "eigene Preise aendern"  on materialpreise;
drop policy if exists "eigene Preise loeschen" on materialpreise;

create policy "eigene Preise lesen"    on materialpreise for select using (auth.uid() = user_id);
create policy "eigene Preise anlegen"  on materialpreise for insert with check (auth.uid() = user_id);
create policy "eigene Preise aendern"  on materialpreise for update using (auth.uid() = user_id);
create policy "eigene Preise loeschen" on materialpreise for delete using (auth.uid() = user_id);
