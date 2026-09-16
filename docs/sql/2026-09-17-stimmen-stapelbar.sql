-- Stimmen stapelbar: eine Zeile je Stimme, mehrere je Nutzer und Wunsch erlaubt.
-- WARUM (Fabian, 16.09.2026 abends — Stimmenkonto): Jeder Nutzer hat ein festes
-- Stimmenkonto je Plan (Solo 1 / Starter 3 / Pro 10 / Enterprise 30) und darf davon
-- beliebig viele auf EINEN Wunsch legen. Der bisherige Primärschlüssel
-- (wunsch_id, user_id) erlaubte das nicht — er erzwang genau eine Stimme je Wunsch
-- und Nutzer. Ab jetzt trägt jede Stimme eine eigene id; Stapeln ist erlaubt.
alter table public.wunsch_stimmen drop constraint if exists wunsch_stimmen_pkey;
alter table public.wunsch_stimmen add column if not exists id uuid not null default gen_random_uuid();
alter table public.wunsch_stimmen add primary key (id);
-- Index (user_id, created_at) bleibt: „älteste N zählen" (wendeDeckelAn) liest genau so.
-- RLS-Policies und GRANTs bleiben unverändert (select/insert/delete je eigener user_id).
