-- Aus dem Schwerpunkt wird eine Mehrfachauswahl.
-- Fabian am 2026-09-07: "Der Punkt, was baust du hauptsaechlich, und dass man dort
-- nur ein Feld anklicken kann, finde ich nicht optimal."
--
-- Idempotent: Laeuft die Datei zweimal, passiert beim zweiten Mal nichts.

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_name = 'betriebskalibrierung'
      and column_name = 'schwerpunkt'
      and data_type <> 'ARRAY'
  ) then
    alter table betriebskalibrierung
      alter column schwerpunkt drop default;
    alter table betriebskalibrierung
      alter column schwerpunkt type text[]
      using case
        when schwerpunkt is null or schwerpunkt = '' then '{}'::text[]
        else array[schwerpunkt]
      end;
    alter table betriebskalibrierung
      alter column schwerpunkt set default '{}'::text[];
    alter table betriebskalibrierung
      alter column schwerpunkt set not null;
  end if;
end $$;

comment on column betriebskalibrierung.schwerpunkt is
  'Mehrfachauswahl. Kein Betrieb baut nur eine Sache — die alte Einfachauswahl zwang zu einer falschen Antwort.';
