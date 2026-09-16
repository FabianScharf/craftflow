-- docs/sql/2026-09-16-bloecke-storage.sql
-- Privater Bucket für Projektdateien (Spec 2026-09-16, Teil C).
-- Pfad: <user_id>/<projekt_id>/<uuid>-<dateiname>. Gelesen wird ausschließlich
-- serverseitig bzw. über signierte URLs, die der Server erzeugt — der Bucket ist
-- NICHT öffentlich (anders als 'logos' und 'briefpapier').

insert into storage.buckets (id, name, public, file_size_limit)
values ('projektdateien', 'projektdateien', false, 10485760)
on conflict (id) do update
  set public = false, file_size_limit = 10485760;

-- Nur der eigene Ordner. (storage.foldername(name))[1] ist der erste Pfadteil,
-- also die user_id.
drop policy if exists "eigene Projektdateien lesen" on storage.objects;
create policy "eigene Projektdateien lesen" on storage.objects for select to authenticated
  using (bucket_id = 'projektdateien' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "eigene Projektdateien anlegen" on storage.objects;
create policy "eigene Projektdateien anlegen" on storage.objects for insert to authenticated
  with check (bucket_id = 'projektdateien' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "eigene Projektdateien ersetzen" on storage.objects;
create policy "eigene Projektdateien ersetzen" on storage.objects for update to authenticated
  using (bucket_id = 'projektdateien' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "eigene Projektdateien löschen" on storage.objects;
create policy "eigene Projektdateien löschen" on storage.objects for delete to authenticated
  using (bucket_id = 'projektdateien' and (storage.foldername(name))[1] = auth.uid()::text);

-- GRANTS NICHT VERGESSEN (Lehre vom 16.09.): Policies allein lassen jede Abfrage
-- still scheitern. Für storage.objects sind sie in Supabase üblicherweise gesetzt —
-- hier ausgeschrieben, damit ein frisch aufgesetztes Projekt nicht daran hängt.
grant select, insert, update, delete on storage.objects to authenticated, service_role;
