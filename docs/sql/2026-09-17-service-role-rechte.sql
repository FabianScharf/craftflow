-- Gefunden im Live-Test der Teamfunktion (17.09., Fabians iCloud-Konto): Die Annahme
-- einer Einladung scheiterte mit „permission denied for table projects“ — die
-- Service-Role (mit der die Server-Routen an RLS vorbei lesen) hatte auf den im
-- Dashboard angelegten Tabellen nur REFERENCES/TRIGGER/TRUNCATE, kein SELECT/INSERT/
-- UPDATE/DELETE. Standard bei Supabase ist ALL für service_role; hier fehlte es.
-- Vergabe auf alle heutigen und künftigen Tabellen/Sequenzen in public.
grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;
alter default privileges in schema public grant select, insert, update, delete on tables to service_role;
alter default privileges in schema public grant usage, select on sequences to service_role;
