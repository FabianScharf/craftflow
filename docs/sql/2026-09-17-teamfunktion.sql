-- docs/sql/2026-09-17-teamfunktion.sql
-- Teamfunktion (Fabian 2026-09-17): Betrieb = Inhaberkonto, Mitarbeiter arbeiten auf dessen Daten.
--
-- WARUM SO: Die Plan-Matrix bewirbt „1 / 1 / 3 / unbegrenzt Nutzer", aber jedes Konto
-- war genau ein Login. Statt jede Tabelle umzubauen (Datenwanderung, Ausfallrisiko)
-- bleibt alles unter der `user_id` des Inhabers. Neu ist nur, WER diese Zeilen sehen
-- darf: der Inhaber und jedes aktive Mitglied seines Betriebs.
-- Spec: docs/superpowers/specs/2026-09-17-teamfunktion-design.md (Abschnitt 2 + 3).
--
-- Diese Datei ist idempotent: sie darf beliebig oft laufen
-- (create table if not exists / create or replace function / drop policy if exists).
--
-- ACHTUNG BEIM LESEN DER POLICIES: Es wird KEINE Regel gelockert, die vorher enger war.
-- Jede umgestellte Policy sagt vorher „auth.uid() = user_id" und nachher
-- „user_id = any(public.konto_ids())" — und konto_ids() enthält immer auth.uid()
-- selbst, zusätzlich die Inhaber-IDs der Betriebe, in denen man aktives Mitglied ist.
-- Wer in keinem Team ist, sieht danach exakt dasselbe wie vorher.

-- ---------------------------------------------------------------------------
-- 1. Die Mitgliedertabelle
-- ---------------------------------------------------------------------------

create table if not exists public.betrieb_mitglieder (
  id            uuid primary key default gen_random_uuid(),
  inhaber_id    uuid not null references auth.users(id) on delete cascade,
  user_id       uuid references auth.users(id) on delete cascade,
  email         text not null,
  rolle         text not null default 'mitarbeiter' check (rolle in ('mitarbeiter')),
  status        text not null default 'eingeladen' check (status in ('eingeladen','aktiv','entfernt')),
  token         uuid not null default gen_random_uuid(),
  eingeladen_am timestamptz not null default now(),
  angenommen_am timestamptz,
  unique (inhaber_id, email)
);
-- Der häufigste Zugriff: „zu welchem Betrieb gehört dieser Login?" — bei jedem
-- Seitenaufruf, über konto_ids()/konto_id() sogar bei jeder Abfrage.
create index if not exists betrieb_mitglieder_user_idx on public.betrieb_mitglieder (user_id) where status = 'aktiv';
-- Der Einladungslink wird über den Token gefunden; eindeutig, damit ein Token nie
-- auf zwei Einladungen passt.
create unique index if not exists betrieb_mitglieder_token_idx on public.betrieb_mitglieder (token);
alter table public.betrieb_mitglieder enable row level security;
-- GRANTS NICHT VERGESSEN (Lehre vom 16.09.): Ohne sie scheitert jede Abfrage still
-- mit „permission denied" — der Supabase-Client liefert {data:null, error} statt zu werfen.
grant select, insert, update on public.betrieb_mitglieder to authenticated;
grant select, insert, update, delete on public.betrieb_mitglieder to service_role;

-- ---------------------------------------------------------------------------
-- 2. Die beiden Auflösungsfunktionen
-- ---------------------------------------------------------------------------

-- Alle Konto-IDs, deren Daten der Angemeldete sehen darf: die eigene und die jedes
-- Betriebs, in dem er aktives Mitglied ist. Deckel/„ruhend" prüft die App (Ruling R1):
-- der effektive Plan (Testphase 14 Tage, Gutschein, Abo-Status) lebt in
-- effektiverPlan() in TypeScript und läuft ohne Ereignis ab — ihn hier zu spiegeln
-- wäre eine zweite Rechenstelle, die beim nächsten Matrix-Wechsel still falsch wird.
create or replace function public.konto_ids() returns uuid[]
language sql stable security definer set search_path = public as $$
  select array_append(
    coalesce(array_agg(m.inhaber_id), '{}'::uuid[]), auth.uid())
  from public.betrieb_mitglieder m
  where m.user_id = auth.uid() and m.status = 'aktiv'
$$;
-- Genau EINE Konto-ID für Zähler (plan_usage): der Betrieb, sonst man selbst.
-- Zähler je Betrieb ist Spec §5: „Zähler (Angebote/Monat, Optimieren-Runden) zählen
-- je Betrieb (Inhaber-user_id)."
create or replace function public.konto_id() returns uuid
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select m.inhaber_id from public.betrieb_mitglieder m
      where m.user_id = auth.uid() and m.status = 'aktiv'
      order by m.angenommen_am limit 1),
    auth.uid())
$$;
grant execute on function public.konto_ids() to authenticated;
grant execute on function public.konto_id() to authenticated;
-- security definer ist hier Pflicht, nicht Bequemlichkeit: die Policy „team lesen"
-- unten ruft konto_ids() auf, und konto_ids() liest betrieb_mitglieder. Als
-- security invoker würde die Policy sich selbst auslösen (Endlosrekursion).

-- Policies auf betrieb_mitglieder: Inhaber sieht/ändert sein Team, Mitglied sieht sein Team.
drop policy if exists "team lesen" on public.betrieb_mitglieder;
create policy "team lesen" on public.betrieb_mitglieder for select
  using (inhaber_id = any(public.konto_ids()) or user_id = auth.uid());
drop policy if exists "inhaber lädt ein" on public.betrieb_mitglieder;
create policy "inhaber lädt ein" on public.betrieb_mitglieder for insert
  with check (inhaber_id = auth.uid());
drop policy if exists "inhaber ändert team" on public.betrieb_mitglieder;
create policy "inhaber ändert team" on public.betrieb_mitglieder for update
  using (inhaber_id = auth.uid()) with check (inhaber_id = auth.uid());
-- Annehmen/Verlassen laufen über die Service-Role (Route prüft Token bzw. Mitgliedschaft).
-- BEWUSST keine delete-Policy: entfernte Mitglieder werden auf status='entfernt'
-- gesetzt, die Zeile bleibt für die Historie stehen (Spec §4).

-- ---------------------------------------------------------------------------
-- 3. Policy-Umstellung: auth.uid() = user_id  →  user_id = any(public.konto_ids())
--    Namen, Befehl und using/with-check-Aufteilung exakt wie im Bestand
--    (.superpowers/sdd/2026-09-17-referenzprojekte/policies-all.txt + policies-rest.txt).
-- ---------------------------------------------------------------------------

-- angebot_events
drop policy if exists "users_own_angebot_events" on public.angebot_events;
create policy "users_own_angebot_events" on public.angebot_events for all
  using (user_id = any(public.konto_ids())) with check (user_id = any(public.konto_ids()));

-- angebot_outcomes
drop policy if exists "users_own_angebot_outcomes" on public.angebot_outcomes;
create policy "users_own_angebot_outcomes" on public.angebot_outcomes for all
  using (user_id = any(public.konto_ids())) with check (user_id = any(public.konto_ids()));

-- bauweise_regeln (der Bauweise-Vault gehört dem Betrieb, nicht dem einzelnen Login —
-- er wird weiterhin NIE über Betriebe hinweg geteilt, siehe CLAUDE.md)
drop policy if exists "eigene Regeln lesen" on public.bauweise_regeln;
create policy "eigene Regeln lesen" on public.bauweise_regeln for select
  using (user_id = any(public.konto_ids()));
drop policy if exists "eigene Regeln anlegen" on public.bauweise_regeln;
create policy "eigene Regeln anlegen" on public.bauweise_regeln for insert
  with check (user_id = any(public.konto_ids()));
drop policy if exists "eigene Regeln aendern" on public.bauweise_regeln;
create policy "eigene Regeln aendern" on public.bauweise_regeln for update
  using (user_id = any(public.konto_ids()));
drop policy if exists "eigene Regeln loeschen" on public.bauweise_regeln;
create policy "eigene Regeln loeschen" on public.bauweise_regeln for delete
  using (user_id = any(public.konto_ids()));

-- benchmark_cache: Policy „authenticated_read_benchmark" prüft (auth.role() =
-- 'authenticated') und hat keinen user_id-Bezug → bleibt unverändert.

-- betriebskalibrierung (Unique bleibt auf user_id = Inhaber; die Routen schreiben mit kontoId)
drop policy if exists "eigene kalibrierung lesen" on public.betriebskalibrierung;
create policy "eigene kalibrierung lesen" on public.betriebskalibrierung for select
  using (user_id = any(public.konto_ids()));
drop policy if exists "eigene kalibrierung anlegen" on public.betriebskalibrierung;
create policy "eigene kalibrierung anlegen" on public.betriebskalibrierung for insert
  with check (user_id = any(public.konto_ids()));
drop policy if exists "eigene kalibrierung aendern" on public.betriebskalibrierung;
create policy "eigene kalibrierung aendern" on public.betriebskalibrierung for update
  using (user_id = any(public.konto_ids()));

-- betriebsprofil: das Mitglied muss den Betrieb LESEN können (Plan, Firmendaten, CI,
-- PDF-Gestaltung). Dass es Plan/Abo nicht ÄNDERN darf, prüfen die Routen über
-- konto.istInhaber — die gesperrten Spalten stehen in src/lib/profilfelder.ts.
drop policy if exists "users_own_betriebsprofil" on public.betriebsprofil;
create policy "users_own_betriebsprofil" on public.betriebsprofil for all
  using (user_id = any(public.konto_ids())) with check (user_id = any(public.konto_ids()));

-- customers
drop policy if exists "users_own_customers" on public.customers;
create policy "users_own_customers" on public.customers for all
  using (user_id = any(public.konto_ids())) with check (user_id = any(public.konto_ids()));

-- email_templates
drop policy if exists "users_own_email_templates" on public.email_templates;
create policy "users_own_email_templates" on public.email_templates for all
  using (user_id = any(public.konto_ids())) with check (user_id = any(public.konto_ids()));

-- gutscheincodes: „admin full access" (auth.email() = Fabian) und „authenticated can
-- select" (true) haben keinen user_id-Bezug → bleiben unverändert.

-- kostenstellen
drop policy if exists "users_own_kostenstellen" on public.kostenstellen;
create policy "users_own_kostenstellen" on public.kostenstellen for all
  using (user_id = any(public.konto_ids())) with check (user_id = any(public.konto_ids()));

-- materialgruppen
drop policy if exists "users_own_materialgruppen" on public.materialgruppen;
create policy "users_own_materialgruppen" on public.materialgruppen for all
  using (user_id = any(public.konto_ids())) with check (user_id = any(public.konto_ids()));

-- materialpreise
drop policy if exists "eigene Preise lesen" on public.materialpreise;
create policy "eigene Preise lesen" on public.materialpreise for select
  using (user_id = any(public.konto_ids()));
drop policy if exists "eigene Preise anlegen" on public.materialpreise;
create policy "eigene Preise anlegen" on public.materialpreise for insert
  with check (user_id = any(public.konto_ids()));
drop policy if exists "eigene Preise aendern" on public.materialpreise;
create policy "eigene Preise aendern" on public.materialpreise for update
  using (user_id = any(public.konto_ids()));
drop policy if exists "eigene Preise loeschen" on public.materialpreise;
create policy "eigene Preise loeschen" on public.materialpreise for delete
  using (user_id = any(public.konto_ids()));

-- offer_versions
drop policy if exists "users_own_offer_versions" on public.offer_versions;
create policy "users_own_offer_versions" on public.offer_versions for all
  using (user_id = any(public.konto_ids())) with check (user_id = any(public.konto_ids()));

-- optimieren_runden (Zähler je Betrieb — der Name „ändern" trägt bewusst das ä, so
-- steht er im Bestand)
drop policy if exists "eigene Runden lesen" on public.optimieren_runden;
create policy "eigene Runden lesen" on public.optimieren_runden for select
  using (user_id = any(public.konto_ids()));
drop policy if exists "eigene Runden anlegen" on public.optimieren_runden;
create policy "eigene Runden anlegen" on public.optimieren_runden for insert
  with check (user_id = any(public.konto_ids()));
drop policy if exists "eigene Runden ändern" on public.optimieren_runden;
create policy "eigene Runden ändern" on public.optimieren_runden for update
  using (user_id = any(public.konto_ids()));

-- plan_usage (Angebotszähler je Monat)
drop policy if exists "Users can read own usage" on public.plan_usage;
create policy "Users can read own usage" on public.plan_usage for select
  using (user_id = any(public.konto_ids()));
drop policy if exists "Users can insert own usage" on public.plan_usage;
create policy "Users can insert own usage" on public.plan_usage for insert
  with check (user_id = any(public.konto_ids()));
drop policy if exists "Users can update own usage" on public.plan_usage;
create policy "Users can update own usage" on public.plan_usage for update
  using (user_id = any(public.konto_ids()));

-- product_categories
drop policy if exists "users_own_product_categories" on public.product_categories;
create policy "users_own_product_categories" on public.product_categories for all
  using (user_id = any(public.konto_ids())) with check (user_id = any(public.konto_ids()));

-- projects (zwei Policies mit gleicher Wirkung im Bestand — beide umgestellt, damit
-- nicht eine davon den Mitarbeiter weiterhin aussperrt bzw. verwirrt)
drop policy if exists "Nutzer sehen nur eigene Projekte" on public.projects;
create policy "Nutzer sehen nur eigene Projekte" on public.projects for all
  using (user_id = any(public.konto_ids())) with check (user_id = any(public.konto_ids()));
drop policy if exists "users_own_projects" on public.projects;
create policy "users_own_projects" on public.projects for all
  using (user_id = any(public.konto_ids())) with check (user_id = any(public.konto_ids()));

-- supplier_categories / supplier_contacts: hängen über supplier_id an suppliers,
-- haben selbst keine user_id → im EXISTS wird s.user_id umgestellt.
drop policy if exists "users_own_supplier_categories" on public.supplier_categories;
create policy "users_own_supplier_categories" on public.supplier_categories for all
  using (exists (select 1 from public.suppliers s
    where s.id = supplier_categories.supplier_id and s.user_id = any(public.konto_ids())))
  with check (exists (select 1 from public.suppliers s
    where s.id = supplier_categories.supplier_id and s.user_id = any(public.konto_ids())));

drop policy if exists "users_own_supplier_contacts" on public.supplier_contacts;
create policy "users_own_supplier_contacts" on public.supplier_contacts for all
  using (exists (select 1 from public.suppliers s
    where s.id = supplier_contacts.supplier_id and s.user_id = any(public.konto_ids())))
  with check (exists (select 1 from public.suppliers s
    where s.id = supplier_contacts.supplier_id and s.user_id = any(public.konto_ids())));

-- suppliers
drop policy if exists "users_own_suppliers" on public.suppliers;
create policy "users_own_suppliers" on public.suppliers for all
  using (user_id = any(public.konto_ids())) with check (user_id = any(public.konto_ids()));

-- textbausteine
drop policy if exists "textbausteine_own" on public.textbausteine;
create policy "textbausteine_own" on public.textbausteine for all
  using (user_id = any(public.konto_ids())) with check (user_id = any(public.konto_ids()));

-- wuensche: Lesen darf jeder Angemeldete (unverändert, nur neu gesetzt). Beim Anlegen
-- bleiben status/zusammengelegt_in erzwungen (C-2 vom 16.09.: der Anon-Key liegt im
-- Browser-Bündel, PostgREST ist öffentlich erreichbar — die Route ist nicht die
-- einzige Tür). Neu ist nur der Urheber: der Betrieb statt des einzelnen Logins.
drop policy if exists "Wünsche lesen" on public.wuensche;
create policy "Wünsche lesen" on public.wuensche for select to authenticated
  using (status <> 'ausgeblendet');
drop policy if exists "eigene Wünsche anlegen" on public.wuensche;
create policy "eigene Wünsche anlegen" on public.wuensche for insert to authenticated
  with check (user_id = any(public.konto_ids()) and status = 'offen' and zusammengelegt_in is null);

-- wunsch_stimmen: das Stimmenbudget hängt am Betrieb (Spec §5, Ruling R3) — die
-- Route schreibt ab jetzt kontoId in user_id.
drop policy if exists "eigene Stimmen lesen" on public.wunsch_stimmen;
create policy "eigene Stimmen lesen" on public.wunsch_stimmen for select to authenticated
  using (user_id = any(public.konto_ids()));
drop policy if exists "eigene Stimmen anlegen" on public.wunsch_stimmen;
create policy "eigene Stimmen anlegen" on public.wunsch_stimmen for insert to authenticated
  with check (user_id = any(public.konto_ids()));
drop policy if exists "eigene Stimmen löschen" on public.wunsch_stimmen;
create policy "eigene Stimmen löschen" on public.wunsch_stimmen for delete to authenticated
  using (user_id = any(public.konto_ids()));

-- email_config (eigener SMTP je Betrieb): In den Policy-Exporten vom 17.09. taucht
-- diese Tabelle NICHT auf — sie hatte also keine benannte Policy. Die Route liest sie
-- aber mit dem Cookie-Client, also mit RLS. Damit ein Mitarbeiter die Mail-Einstellung
-- des Betriebs sehen und pflegen kann (Spec §5: Einstellungen → E-Mail ist erlaubt),
-- werden die Policies hier ANGELEGT. Der Block ist gegen eine fehlende Tabelle
-- abgesichert, damit die Datei überall durchläuft.
-- HINWEIS FÜR DEN CONTROLLER: Wenn auf email_config RLS ausgeschaltet ist, sind diese
-- Policies wirkungslos — und dann kann heute JEDER Angemeldete über PostgREST die
-- SMTP-Zugangsdaten aller Betriebe lesen. Bitte separat prüfen (nicht Teil dieser Aufgabe,
-- weil „RLS einschalten" ohne Live-Test die Mail-Funktion abschalten könnte).
do $$
begin
  if exists (select 1 from information_schema.tables
             where table_schema = 'public' and table_name = 'email_config') then
    execute 'drop policy if exists "eigene email_config lesen" on public.email_config';
    execute 'create policy "eigene email_config lesen" on public.email_config for select
               using (user_id = any(public.konto_ids()))';
    execute 'drop policy if exists "eigene email_config anlegen" on public.email_config';
    execute 'create policy "eigene email_config anlegen" on public.email_config for insert
               with check (user_id = any(public.konto_ids()))';
    execute 'drop policy if exists "eigene email_config aendern" on public.email_config';
    execute 'create policy "eigene email_config aendern" on public.email_config for update
               using (user_id = any(public.konto_ids())) with check (user_id = any(public.konto_ids()))';
  else
    raise notice 'email_config existiert nicht — Policies uebersprungen.';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 4. Zähler-RPCs auf konto_id() (Ruling R2)
--    Funktionstext wörtlich aus docs/sql/2026-09-16-angebot-reservieren.sql,
--    getauscht ist NUR auth.uid() → public.konto_id(). Damit verbraucht ein
--    Mitarbeiter den Angebotszähler des Betriebs, nicht einen eigenen.
-- ---------------------------------------------------------------------------

create or replace function public.reserviere_angebot(p_monat text, p_limit int)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_count int;
  v_konto uuid := public.konto_id();
begin
  -- p_limit = null → unbegrenzter Plan (z. B. Enterprise Fair-Use-Zählung):
  -- immer erhöhen, kein Deckel zu prüfen.
  if p_limit is null then
    insert into plan_usage (user_id, monat, angebote_count)
    values (v_konto, p_monat, 1)
    on conflict (user_id, monat) do update
      set angebote_count = plan_usage.angebote_count + 1
    returning angebote_count into v_count;
    return jsonb_build_object('ok', true, 'count', v_count);
  end if;

  -- Endlicher Deckel: die UPDATE-Zeile wird nur bei freiem Platz angefasst.
  -- Existiert für den Monat noch keine Zeile, legt der INSERT-Zweig sie mit
  -- angebote_count = 1 an (erster Aufruf des Monats zählt immer, solange
  -- p_limit >= 1 — was bei jedem echten Plan-Deckel der Fall ist).
  insert into plan_usage (user_id, monat, angebote_count)
  values (v_konto, p_monat, 1)
  on conflict (user_id, monat) do update
    set angebote_count = plan_usage.angebote_count + 1
    where plan_usage.angebote_count < p_limit
  returning angebote_count into v_count;

  if v_count is null then
    -- UPDATE griff nicht (WHERE nicht erfüllt) → Deckel erreicht, nichts wurde
    -- erhöht. Aktuellen Stand für die Fehlermeldung separat holen.
    select angebote_count into v_count from plan_usage
      where user_id = v_konto and monat = p_monat;
    return jsonb_build_object('ok', false, 'count', coalesce(v_count, 0));
  end if;

  return jsonb_build_object('ok', true, 'count', v_count);
end;
$function$;

-- Gibt eine zuvor reservierte Zählung wieder frei (Angebot ohne Positionen,
-- fehlgeschlagener KI-Aufruf, JSON-Parse-Fehler). Nie unter 0.
create or replace function public.gib_angebot_frei(p_monat text)
returns void
language sql
security definer
set search_path = public
as $function$
  update plan_usage
  set angebote_count = greatest(angebote_count - 1, 0)
  where user_id = public.konto_id() and monat = p_monat;
$function$;

grant execute on function public.reserviere_angebot(text, int) to authenticated;
grant execute on function public.gib_angebot_frei(text) to authenticated;
grant select, insert, update on public.plan_usage to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 5. Storage: der erste Pfadteil ist die Konto-ID (nicht mehr zwingend auth.uid())
--    Pfadkonvention bleibt <konto_id>/… — die Routen schreiben ab jetzt mit kontoId.
--    Die beiden öffentlichen Lese-Policies („Logo files are publicly readable",
--    „briefpapier_public_read") bleiben absichtlich unangetastet: sie prüfen nur
--    bucket_id und gehen niemanden etwas an.
-- ---------------------------------------------------------------------------

drop policy if exists "Users can upload own logo" on storage.objects;
create policy "Users can upload own logo" on storage.objects for insert to authenticated
  with check (bucket_id = 'logos'
    and (storage.foldername(name))[1] = any(select k::text from unnest(public.konto_ids()) as t(k)));

drop policy if exists "Users can update own logo" on storage.objects;
create policy "Users can update own logo" on storage.objects for update to authenticated
  using (bucket_id = 'logos'
    and (storage.foldername(name))[1] = any(select k::text from unnest(public.konto_ids()) as t(k)));

drop policy if exists "briefpapier_own_upload" on storage.objects;
create policy "briefpapier_own_upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'briefpapier'
    and (storage.foldername(name))[1] = any(select k::text from unnest(public.konto_ids()) as t(k)));

drop policy if exists "briefpapier_own_delete" on storage.objects;
create policy "briefpapier_own_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'briefpapier'
    and (storage.foldername(name))[1] = any(select k::text from unnest(public.konto_ids()) as t(k)));

drop policy if exists "eigene Projektdateien lesen" on storage.objects;
create policy "eigene Projektdateien lesen" on storage.objects for select to authenticated
  using (bucket_id = 'projektdateien'
    and (storage.foldername(name))[1] = any(select k::text from unnest(public.konto_ids()) as t(k)));

drop policy if exists "eigene Projektdateien anlegen" on storage.objects;
create policy "eigene Projektdateien anlegen" on storage.objects for insert to authenticated
  with check (bucket_id = 'projektdateien'
    and (storage.foldername(name))[1] = any(select k::text from unnest(public.konto_ids()) as t(k)));

drop policy if exists "eigene Projektdateien ersetzen" on storage.objects;
create policy "eigene Projektdateien ersetzen" on storage.objects for update to authenticated
  using (bucket_id = 'projektdateien'
    and (storage.foldername(name))[1] = any(select k::text from unnest(public.konto_ids()) as t(k)));

drop policy if exists "eigene Projektdateien löschen" on storage.objects;
create policy "eigene Projektdateien löschen" on storage.objects for delete to authenticated
  using (bucket_id = 'projektdateien'
    and (storage.foldername(name))[1] = any(select k::text from unnest(public.konto_ids()) as t(k)));

grant select, insert, update, delete on storage.objects to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 6. Bewusst NICHT umgestellt
-- ---------------------------------------------------------------------------
-- consent_log  — Zustimmungsprotokoll (AGB/Datenschutz/AVV). Das ist die Erklärung
--                EINER Person, kein Betriebsdatum; ein Mitarbeiter darf sie nicht
--                sehen und der Inhaber nicht für ihn abgeben. Bleibt auth.uid().
-- optim_events — Ereignis-Log des Optimieren-Chats, kein Export vorhanden.
-- gutscheincodes — globale Codes, kein user_id-Bezug (Admin-Policy + true-Select).
-- benchmark_cache — auth.role()-Policy, kein user_id-Bezug.
--
-- Für consent_log und optim_events lag kein Policy-Export vor (sie tauchen in
-- weder policies-all.txt noch policies-rest.txt auf → vermutlich gar keine benannte
-- Policy). Der Block unten protokolliert, was dort tatsächlich steht, ohne etwas zu
-- ändern — Ergebnis erscheint als NOTICE im SQL-Lauf.
do $$
declare r record; n int := 0;
begin
  for r in select tablename, policyname, cmd, coalesce(qual, '-') as qual,
                  coalesce(with_check, '-') as wc
             from pg_policies
            where schemaname = 'public'
              and tablename in ('consent_log', 'optim_events')
            order by tablename, policyname
  loop
    n := n + 1;
    raise notice 'NICHT umgestellt (bewusst): %.% [%] using=% check=%',
      r.tablename, r.policyname, r.cmd, r.qual, r.wc;
  end loop;
  if n = 0 then
    raise notice 'consent_log/optim_events: keine Policies gefunden — nichts umzustellen.';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 7. Gegenprobe (nach dem Lauf ausführen; erwartet >= 45)
-- ---------------------------------------------------------------------------
-- select count(*) from pg_policies
--  where qual like '%konto_ids%' or with_check like '%konto_ids%';
--
-- Und die Funktionen selbst:
-- select public.konto_id(), public.konto_ids();

-- ═══════════════════════════════════════════════════════════════════════════
-- NACHTRAG CONTROLLER (2026-09-17, vor dem Ausführen), Live-Stand geprüft:
--   email_config:  RLS an, EINE bestehende Policy "email_config_user_isolation"
--                  [ALL] (user_id = auth.uid()) — die fehlte im Export. Sie bleibt
--                  sonst neben den neuen stehen und sperrt Mitarbeiter beim Löschen.
--   consent_log:   RLS AUS, keine Policy. Persönliche Zustimmung (AGB/AVV) — nur der
--                  Nutzer selbst, NIE der Betrieb (Inventar §1.2).
--   optim_events:  RLS AUS, keine Policy. Ereignis-Log je Projekt — betriebsintern.
-- Beides Altlasten: bis hierher konnte jeder Angemeldete über PostgREST alle Zeilen
-- dieser zwei Tabellen lesen. Die Routen schreiben mit dem Cookie-Client, die
-- Policies unten lassen genau das weiter zu.
-- ═══════════════════════════════════════════════════════════════════════════
drop policy if exists "email_config_user_isolation" on public.email_config;
drop policy if exists "eigene email_config loeschen" on public.email_config;
create policy "eigene email_config loeschen" on public.email_config for delete
  using (user_id = any(public.konto_ids()));

alter table public.consent_log enable row level security;
drop policy if exists "eigene Zustimmung lesen" on public.consent_log;
create policy "eigene Zustimmung lesen" on public.consent_log for select
  using (user_id = auth.uid());
drop policy if exists "eigene Zustimmung anlegen" on public.consent_log;
create policy "eigene Zustimmung anlegen" on public.consent_log for insert
  with check (user_id = auth.uid());

alter table public.optim_events enable row level security;
drop policy if exists "eigene Optimieren-Ereignisse lesen" on public.optim_events;
create policy "eigene Optimieren-Ereignisse lesen" on public.optim_events for select
  using (user_id = any(public.konto_ids()));
drop policy if exists "eigene Optimieren-Ereignisse anlegen" on public.optim_events;
create policy "eigene Optimieren-Ereignisse anlegen" on public.optim_events for insert
  with check (user_id = any(public.konto_ids()));
