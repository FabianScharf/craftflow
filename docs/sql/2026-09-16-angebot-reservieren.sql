-- Fix-Runde 16.09.: Angebot wird VOR dem KI-Aufruf atomar reserviert, nicht mehr
-- per Lesen+Vergleichen+Hochzählen danach.
--
-- Befund: /api/analyze las den Stand aus plan_usage, verglich ihn mit dem
-- Plan-Deckel und zählte NACH dem KI-Aufruf hoch (zaehleAngebotHoch). Zwei
-- gleichzeitige Anfragen im letzten freien Platz sahen beide "noch Platz frei"
-- (klassisches TOCTOU-Race) — der Deckel liess sich damit knapp überschreiten,
-- und jede der beiden Anfragen hatte bereits den vollen (teuren) Claude-Aufruf
-- bezahlt, bevor irgendetwas hochgezählt wurde.
--
-- reserviere_angebot() macht Prüfen und Erhöhen in einem einzigen atomaren
-- `insert … on conflict … do update … where` — die Datenbank entscheidet, nicht
-- zwei nacheinander laufende JS-Anweisungen. gib_angebot_frei() macht die
-- Reservierung rückgängig, wenn im Anschluss doch kein echtes Angebot entstand
-- (KI-Fehler, JSON-Parse-Fehler, Antwort ohne Positionen — src/lib/angebotszaehler.ts).
--
-- Tabelle plan_usage (user_id, monat, angebote_count) existiert bereits
-- (unique constraint auf user_id+monat, genutzt vom bisherigen .upsert()).

create or replace function public.reserviere_angebot(p_monat text, p_limit int)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_count int;
begin
  -- p_limit = null → unbegrenzter Plan (z. B. Enterprise Fair-Use-Zählung):
  -- immer erhöhen, kein Deckel zu prüfen.
  if p_limit is null then
    insert into plan_usage (user_id, monat, angebote_count)
    values (auth.uid(), p_monat, 1)
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
  values (auth.uid(), p_monat, 1)
  on conflict (user_id, monat) do update
    set angebote_count = plan_usage.angebote_count + 1
    where plan_usage.angebote_count < p_limit
  returning angebote_count into v_count;

  if v_count is null then
    -- UPDATE griff nicht (WHERE nicht erfüllt) → Deckel erreicht, nichts wurde
    -- erhöht. Aktuellen Stand für die Fehlermeldung separat holen.
    select angebote_count into v_count from plan_usage
      where user_id = auth.uid() and monat = p_monat;
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
  where user_id = auth.uid() and monat = p_monat;
$function$;
