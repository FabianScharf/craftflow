-- Preisfaktor je Betrieb (Spec 2026-09-16, Teil P). Multipliziert den Endpreis
-- jeder NEU entstehenden Position; Stunden und Stundensaetze bleiben unberuehrt.
-- Grenzen 0,50-3,00 werden zusaetzlich serverseitig geprueft
-- (src/lib/preisfaktor.ts, PATCH /api/settings/betriebsprofil).
alter table betriebsprofil
  add column if not exists preisfaktor numeric(4,2) not null default 1.00;

alter table betriebsprofil
  drop constraint if exists betriebsprofil_preisfaktor_grenzen;
alter table betriebsprofil
  add constraint betriebsprofil_preisfaktor_grenzen
  check (preisfaktor >= 0.5 and preisfaktor <= 3.0);

-- betriebsprofil hat bereits RLS und GRANTs; eine neue Spalte erbt beides.
-- Trotzdem hier ausgeschrieben, weil eine fehlende Berechtigung in Supabase
-- still scheitert ({data: null, error}) statt zu werfen — Lehre vom 16.09.
grant select, insert, update on public.betriebsprofil to authenticated, service_role;
