-- Kommentare unter einem Wunsch (Fabians Entscheidung 2026-09-19).
--
-- BESONDERHEIT: „Sofort öffentlich" — es gibt KEINEN Freigabeschritt. Was hier
-- landet, steht binnen fünf Minuten (Cache der Website) auf
-- www.getcraftflow.de/werkstatt/wunsch/<id>. Alle Schranken müssen deshalb hier
-- und in der Route greifen, nicht in einer nachgelagerten Prüfung.
--
-- Die Lehre vom 16.09. (C-2) gilt hier doppelt: Der Anon-Key liegt im
-- Browser-Bündel, PostgREST ist öffentlich erreichbar. Eine Regel, die nur die
-- Urheberschaft prüft, ließe jeden Angemeldeten einen Kommentar mit
-- vom_entwickler = true direkt gegen die REST-API anlegen — und der stünde dann
-- als offizielle Antwort von CraftFlow auf der öffentlichen Seite. Das Flag muss
-- beim Insert erzwungen werden, nicht nur beim Anzeigen gefiltert.

create table if not exists wunsch_kommentare (
  id             uuid primary key default gen_random_uuid(),
  wunsch_id      uuid not null references wuensche(id) on delete cascade,
  user_id        uuid not null references auth.users(id) on delete cascade,
  text           text not null check (char_length(text) between 1 and 1000),
  -- true = Antwort von CraftFlow. Nur die Admin-Route (Service-Role) setzt das.
  vom_entwickler boolean not null default false,
  created_at     timestamptz not null default now()
);
create index if not exists wunsch_kommentare_wunsch_idx on wunsch_kommentare (wunsch_id, created_at);
create index if not exists wunsch_kommentare_user_idx   on wunsch_kommentare (user_id, created_at desc);

alter table wunsch_kommentare enable row level security;

-- Lesen darf jeder Angemeldete — aber nur zu Wünschen, die nicht ausgeblendet
-- sind. Sonst wäre ein ausgeblendeter Wunsch über seine Kommentare doch wieder
-- sichtbar.
drop policy if exists "Kommentare lesen" on wunsch_kommentare;
create policy "Kommentare lesen" on wunsch_kommentare for select to authenticated
  using (exists (
    select 1 from public.wuensche w
    where w.id = wunsch_kommentare.wunsch_id and w.status <> 'ausgeblendet'
  ));

-- Schreiben: nur unter eigenem Namen und NIEMALS als CraftFlow.
drop policy if exists "eigene Kommentare anlegen" on wunsch_kommentare;
create policy "eigene Kommentare anlegen" on wunsch_kommentare for insert to authenticated
  with check (auth.uid() = user_id and vom_entwickler = false);

-- Löschen: nur die eigenen. Wer etwas bereut, bekommt es selbst wieder weg —
-- ohne auf eine Antwort auf eine Mail zu warten.
drop policy if exists "eigene Kommentare löschen" on wunsch_kommentare;
create policy "eigene Kommentare löschen" on wunsch_kommentare for delete to authenticated
  using (auth.uid() = user_id);

-- BEWUSST KEIN update für authenticated: Sonst könnte jemand einen harmlosen
-- Satz schreiben und ihn später — wenn er längst öffentlich steht und niemand
-- mehr hinschaut — zu Werbung oder Schlimmerem umschreiben. Wer etwas anderes
-- sagen will, löscht und schreibt neu; dann stimmt auch das Datum wieder.

-- Der Anzeigename ist eine Einstellung des KONTOS, nicht des einzelnen
-- Kommentars (Fabian: „Nutzer wählt, aber nur einmal, nicht je Kommentar").
-- Voreingestellt die anonymste Form: Wer erkannt werden will, entscheidet sich
-- aktiv dafür.
alter table betriebsprofil
  add column if not exists wunsch_name_art text not null default 'region';
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'betriebsprofil_wunsch_name_art_check'
  ) then
    alter table betriebsprofil
      add constraint betriebsprofil_wunsch_name_art_check
      check (wunsch_name_art in ('region','vorname','betrieb'));
  end if;
end $$;

-- GRANTS NICHT VERGESSEN (Lehre vom 16.09.): Ohne sie sieht die App
-- „permission denied", und der Supabase-Client liefert still {data: null, error}
-- statt zu werfen.
grant select, insert, delete         on public.wunsch_kommentare to authenticated;
grant select, insert, update, delete on public.wunsch_kommentare to service_role;
