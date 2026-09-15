-- Aufgabe 0 (2026-09-16): Server-seitige Sperre nach der Testphase.
--
-- Befund: Die DB konnte bisher nicht unterscheiden zwischen "hat nie bezahlt"
-- und "zahlt gerade Solo" (beide stehen als plan = 'solo'), und ein per
-- Gutschein/Admin gesetzter Plan lief nie ab. Zwei neue Spalten schliessen die
-- Luecke — src/lib/plaene.ts (effektiverPlan) liest beide:
--   abo_status        'aktiv' | 'beendet' | null  — von Stripe gesetzt
--                      (webhook: checkout.session.completed / subscription.updated
--                      setzen 'aktiv', subscription.deleted setzt 'beendet')
--   plan_gueltig_bis  timestamptz, null = unbefristet — von redeem_coupon gesetzt
--
-- Ergebnis: Ohne aktives Abo UND ohne gültigen Nicht-Solo-Plan liefert
-- effektiverPlan() 'gesperrt' — kein Funktion, kein Deckel, jede API-Route
-- antwortet 402 (src/lib/planpruefung.ts).

alter table betriebsprofil add column if not exists abo_status text;
alter table betriebsprofil add column if not exists plan_gueltig_bis timestamptz;

-- redeem_coupon: WICHTIG — dies ist die bisherige Funktion aus der Beschreibung
-- des Controllers nachgebaut (der Live-Quelltext war beim Schreiben dieser Datei
-- nicht abrufbar, Supabase-Zugriff war während der Wartung nicht erreichbar).
-- Bitte vor dem Ausführen gegen die tatsächliche Definition in der DB prüfen
-- (z. B. via `select pg_get_functiondef('redeem_coupon'::regproc)`) — einzige
-- inhaltliche Änderung gegenüber der bisherigen Funktion ist die neue Zeile
-- `plan_gueltig_bis = v_coupon.valid_until` im UPDATE.
create or replace function redeem_coupon(p_code text)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_coupon gutscheincodes%rowtype;
  v_bestehender text;
begin
  select * into v_coupon
  from gutscheincodes
  where lower(code) = lower(p_code)
  limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'Gutscheincode nicht gefunden.');
  end if;

  if v_coupon.valid_until is not null and v_coupon.valid_until < now() then
    return jsonb_build_object('ok', false, 'error', 'Gutscheincode ist abgelaufen.');
  end if;

  if v_coupon.max_uses is not null and v_coupon.used_count >= v_coupon.max_uses then
    return jsonb_build_object('ok', false, 'error', 'Gutscheincode ist bereits ausgeschöpft.');
  end if;

  select gutschein_code into v_bestehender
  from betriebsprofil
  where user_id = auth.uid();

  if v_bestehender is not null then
    return jsonb_build_object('ok', false, 'error', 'Es ist bereits ein Gutscheincode eingelöst.');
  end if;

  update betriebsprofil
  set plan = v_coupon.plan,
      gutschein_code = v_coupon.code,
      plan_gueltig_bis = v_coupon.valid_until
  where user_id = auth.uid();

  update gutscheincodes
  set used_count = used_count + 1
  where code = v_coupon.code;

  return jsonb_build_object('ok', true, 'plan', v_coupon.plan, 'code', v_coupon.code);
end;
$$;

-- Backfill: bereits eingelöste Gutscheine bekommen nachträglich ihr Ablaufdatum —
-- sonst wären sie ab jetzt fälschlich unbefristet gültig statt laut Coupon-
-- Definition irgendwann abzulaufen.
update betriebsprofil bp
set plan_gueltig_bis = g.valid_until
from gutscheincodes g
where bp.gutschein_code is not null
  and lower(bp.gutschein_code) = lower(g.code)
  and bp.plan_gueltig_bis is null;
