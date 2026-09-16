-- Wünsche-Community (Spec 2026-09-16, Teil W). Jeder Plan darf vorschlagen und
-- abstimmen; das Stimmenbudget je Plan (1/3/10/30) steht in src/lib/plaene.ts und
-- wirkt BEIM LESEN (wendeDeckelAn) — hier wird nichts gelöscht und nichts gedeckelt.

create table if not exists wuensche (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  titel             text not null check (char_length(titel) between 1 and 120),
  beschreibung      text not null default '' check (char_length(beschreibung) <= 1000),
  status            text not null default 'offen'
                      check (status in ('offen','geplant','in_arbeit','fertig','ausgeblendet')),
  zusammengelegt_in uuid references wuensche(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists wuensche_status_idx on wuensche (status, created_at desc);
create index if not exists wuensche_user_idx   on wuensche (user_id, created_at desc);

create table if not exists wunsch_stimmen (
  wunsch_id  uuid not null references wuensche(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (wunsch_id, user_id)   -- je Wunsch höchstens EINE Stimme je Nutzer
);
create index if not exists wunsch_stimmen_user_idx on wunsch_stimmen (user_id, created_at);

alter table wuensche       enable row level security;
alter table wunsch_stimmen enable row level security;

-- Lesen darf jeder Angemeldete — außer Ausgeblendetes.
drop policy if exists "Wünsche lesen" on wuensche;
create policy "Wünsche lesen" on wuensche for select to authenticated
  using (status <> 'ausgeblendet');
drop policy if exists "eigene Wünsche anlegen" on wuensche;
create policy "eigene Wünsche anlegen" on wuensche for insert to authenticated
  with check (auth.uid() = user_id);
-- BEWUSST keine update/delete-Policy für authenticated: Status setzen, zusammenlegen
-- und ausblenden macht ausschließlich die Admin-Route über die Service-Role.

drop policy if exists "eigene Stimmen lesen" on wunsch_stimmen;
create policy "eigene Stimmen lesen" on wunsch_stimmen for select to authenticated
  using (auth.uid() = user_id);
drop policy if exists "eigene Stimmen anlegen" on wunsch_stimmen;
create policy "eigene Stimmen anlegen" on wunsch_stimmen for insert to authenticated
  with check (auth.uid() = user_id);
drop policy if exists "eigene Stimmen löschen" on wunsch_stimmen;
create policy "eigene Stimmen löschen" on wunsch_stimmen for delete to authenticated
  using (auth.uid() = user_id);

-- GRANTS NICHT VERGESSEN (Lehre vom 16.09.): Ohne sie sieht die App "permission
-- denied", und der Supabase-Client liefert still {data: null, error} statt zu werfen.
grant select, insert         on public.wuensche       to authenticated;
grant select, insert, delete on public.wunsch_stimmen to authenticated;
grant select, insert, update, delete on public.wuensche       to service_role;
grant select, insert, update, delete on public.wunsch_stimmen to service_role;
