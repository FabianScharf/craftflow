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

-- redeem_coupon: echter Quelltext aus der Datenbank (Fix-Runde 1, Controller
-- 16.09.) — die vorherige Fassung dieser Datei war aus einer Textbeschreibung
-- nachgebaut, weil Supabase während der Wartung nicht erreichbar war. Einzige
-- inhaltliche Änderung gegenüber der bisherigen Funktion ist die neue Zeile
-- `plan_gueltig_bis = v_coupon.valid_until` im UPDATE.
CREATE OR REPLACE FUNCTION public.redeem_coupon(p_code text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $function$
DECLARE
  v_coupon gutscheincodes%ROWTYPE;
  v_bp_plan TEXT;
  v_bp_code TEXT;
BEGIN
  -- Code suchen
  SELECT * INTO v_coupon FROM gutscheincodes WHERE LOWER(code) = LOWER(p_code);
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'Ungültiger Code'); END IF;
  -- Ablaufdatum prüfen
  IF v_coupon.valid_until IS NOT NULL AND v_coupon.valid_until < NOW() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Code abgelaufen');
  END IF;
  -- Max-Uses prüfen
  IF v_coupon.max_uses IS NOT NULL AND v_coupon.used_count >= v_coupon.max_uses THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Code bereits ausgeschöpft');
  END IF;
  -- Nutzer-Profil prüfen (bereits eingelöst?)
  SELECT plan, gutschein_code INTO v_bp_plan, v_bp_code FROM betriebsprofil WHERE user_id = auth.uid();
  IF v_bp_code IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Du hast bereits einen Gutschein eingelöst');
  END IF;
  -- Plan upgraden + Code merken + Ablauf des Gutschein-Plans merken (neu, 16.09.2026)
  UPDATE betriebsprofil
     SET plan = v_coupon.plan, gutschein_code = v_coupon.code,
         plan_gueltig_bis = v_coupon.valid_until, updated_at = NOW()
   WHERE user_id = auth.uid();
  -- used_count erhöhen
  UPDATE gutscheincodes SET used_count = used_count + 1 WHERE code = v_coupon.code;
  RETURN jsonb_build_object('ok', true, 'plan', v_coupon.plan, 'code', v_coupon.code);
END;
$function$;

-- Backfill: bereits eingelöste Gutscheine bekommen nachträglich ihr Ablaufdatum —
-- sonst wären sie ab jetzt fälschlich unbefristet gültig statt laut Coupon-
-- Definition irgendwann abzulaufen.
update betriebsprofil bp
set plan_gueltig_bis = g.valid_until
from gutscheincodes g
where bp.gutschein_code is not null
  and lower(bp.gutschein_code) = lower(g.code)
  and bp.plan_gueltig_bis is null;
