-- offer_versions: fehlendes Löschrecht
--
-- GEFUNDEN AM 2026-09-07: Ein Projekt liess sich ueberhaupt nicht loeschen.
-- DELETE /api/projects/[id] raeumt zuerst die Angebotsversionen weg und scheiterte
-- dort mit "permission denied for table offer_versions". Die Rolle authenticated
-- hatte auf dieser Tabelle SELECT und INSERT, aber kein DELETE.
--
-- Steht so schon in CLAUDE.md: Jede Tabelle braucht die vollen Rechte fuer
-- authenticated. Bei offer_versions ist es nie passiert.
--
-- Ausfuehren im Supabase SQL-Editor.

grant select, insert, update, delete on table public.offer_versions to authenticated;

-- AUSGEFUEHRT AM 2026-09-07. Ergebnis der Kontrolle: Es gab bereits eine Policy
-- "users_own_offer_versions" fuer ALL — RLS war also nie das Problem, nur das
-- fehlende GRANT. Eine zusaetzliche DELETE-Policy waere doppelt gemoppelt und
-- wurde wieder entfernt.

-- Kontrolle: Rechte und Policies dieser Tabelle anzeigen.
select grantee, privilege_type
  from information_schema.role_table_grants
 where table_name = 'offer_versions' and grantee = 'authenticated'
 order by privilege_type;

select policyname, cmd from pg_policies
 where tablename = 'offer_versions'
 order by cmd;
