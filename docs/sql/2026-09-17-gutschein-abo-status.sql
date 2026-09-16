-- Gutschein nach gekündigtem Abo (Audit 2026-09-17, I6) — NOCH NICHT AUSGEFÜHRT.
--
-- BEFUND: `redeem_coupon` setzt `plan` und `plan_gueltig_bis`, lässt `abo_status`
-- aber unangetastet. Steht dort nach einer Kündigung `'beendet'`, bleibt der Nutzer
-- gesperrt, OBWOHL er gerade einen gültigen Code eingelöst hat und ein „ok" zurück
-- bekommt (src/app/api/gutschein/route.ts). Grund: Schritt 3 von `effektiverPlan()`
-- (src/lib/plaene.ts) verlangt ausdrücklich „kein beendetes Abo" — sonst wäre eine
-- Kündigung wirkungslos, weil der Plan in der DB stehen bleibt (Fabians Regel).
--
-- FIX: Beim Einlösen `abo_status = NULL` setzen. NULL heißt genau das, was hier
-- zutrifft: „kein Abo im Spiel, der Plan kommt aus einem Gutschein". Der Gutschein
-- läuft dann über `plan_gueltig_bis` ab wie jeder andere auch. Bucht der Nutzer
-- später ein echtes Abo, setzt der Stripe-Webhook `abo_status` wieder auf 'aktiv'.
--
-- Einzige inhaltliche Änderung gegenüber der Fassung vom 2026-09-16
-- (docs/sql/2026-09-16-abo-status.sql) ist die Zeile `abo_status = NULL` im UPDATE.
--
-- KEIN Backfill: Wer in der Vergangenheit einen Code eingelöst hat und trotzdem
-- gesperrt war, hat sich längst gemeldet — ein pauschales Aufheben von 'beendet'
-- würde dagegen auch Konten treffen, deren Gutschein damals schlicht abgelaufen ist.

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
  -- Plan upgraden + Code merken + Ablauf des Gutschein-Plans merken (16.09.2026)
  -- + abo_status zurücksetzen (NEU, 17.09.2026): Ohne diese Zeile bleibt ein
  --   'beendet' aus einem früheren Abo stehen und der Gutschein wirkt nicht.
  UPDATE betriebsprofil
     SET plan = v_coupon.plan, gutschein_code = v_coupon.code,
         plan_gueltig_bis = v_coupon.valid_until,
         abo_status = NULL,
         updated_at = NOW()
   WHERE user_id = auth.uid();
  -- used_count erhöhen
  UPDATE gutscheincodes SET used_count = used_count + 1 WHERE code = v_coupon.code;
  RETURN jsonb_build_object('ok', true, 'plan', v_coupon.plan, 'code', v_coupon.code);
END;
$function$;
