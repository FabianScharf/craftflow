-- PDF-Gestaltung: Schriftart und Spalten der Positionstabelle
--
-- Aus dem Feedback von Constantin Ludewigt (Tischlerei Lilie) vom 2026-08-26:
--   "Es wäre cool, wenn man eine Schriftart wählen könnte, wir nutzen zumindest in
--    unserem Betrieb für alle Dokumente eine einheitliche Schriftart."
--
-- Und aus dem Vergleich mit dem Referenzangebot: Dort hat die Positionstabelle die
-- Spalten Menge und Einheitspreis, in CraftFlow gab es sie nicht. Beides ist eine
-- Betriebsentscheidung, keine Vorgabe — manche Betriebe wollen bewusst nur
-- Endsummen ausweisen, um nicht ueber Einzelpreise verhandeln zu muessen.
--
-- Ausfuehren im Supabase SQL-Editor.

alter table public.betriebsprofil
  add column if not exists pdf_schriftart text default 'opensans',
  add column if not exists pdf_zeige_menge boolean default false,
  add column if not exists pdf_zeige_einheitspreis boolean default false;

-- Kontrolle
select column_name, data_type, column_default
  from information_schema.columns
 where table_name = 'betriebsprofil'
   and column_name in ('pdf_schriftart', 'pdf_zeige_menge', 'pdf_zeige_einheitspreis')
 order by column_name;
