-- Gesamtprüfung Teamfunktion (17.09., Befund I1): Ruling R1 ließ die Deckelprüfung in der
-- App — aber ein RUHENDES Mitglied (Plan des Inhabers verkleinert) blieb in konto_ids()
-- und hätte über die Browser-Konsole (Anon-Key + Sitzung) weiter Tabellen und Storage des
-- Inhabers lesen können. Jetzt schreibt die App den Zustand in eine Spalte, und die
-- SQL-Funktionen schließen ruhende Mitglieder aus. Die App bleibt die Rechenstelle
-- (effektiver Plan), SQL liest nur das Ergebnis.
alter table public.betrieb_mitglieder add column if not exists ruht boolean not null default false;

create or replace function public.konto_ids() returns uuid[]
language sql stable security definer set search_path = public as $$
  select array_append(
    coalesce(array_agg(m.inhaber_id), '{}'::uuid[]), auth.uid())
  from public.betrieb_mitglieder m
  where m.user_id = auth.uid() and m.status = 'aktiv' and not m.ruht
$$;

create or replace function public.konto_id() returns uuid
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select m.inhaber_id from public.betrieb_mitglieder m
      where m.user_id = auth.uid() and m.status = 'aktiv' and not m.ruht
      order by m.angenommen_am limit 1),
    auth.uid())
$$;
