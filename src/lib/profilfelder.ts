// Welche Felder des Betriebsprofils der Nutzer selbst über
// `PATCH /api/settings/betriebsprofil` schreiben darf — und welche NIE.
//
// ANLASS (Audit 2026-09-17, Critical): `'plan'` stand in der Liste. Ein einziger
// Aufruf `PATCH /api/settings/betriebsprofil {"plan":"enterprise"}` reichte, um sich
// selbst Enterprise zu geben: `effektiverPlan()` gibt einen Nicht-Solo-Plan ohne
// `abo_status` und ohne `plan_gueltig_bis` unbefristet frei — die Bezahlschranke war
// damit vollständig umgangen.
//
// Die Abrechnungsfelder setzt ausschließlich:
//   plan, abo_status, stripe_customer_id  → der Stripe-Webhook
//   plan, plan_gueltig_bis, gutschein_code → die DB-Funktion redeem_coupon
//   plan (nur Fabians eigenes Konto)      → PATCH /api/admin/plan
//   trial_starts_at                        → die Registrierung
//
// Reine Daten ohne Importe, damit `npm run test` die Liste direkt prüfen kann
// (tests/profilfelder.test.mjs).

/** Felder, die der Nutzer selbst ändern darf. */
export const PROFIL_FELDER: readonly string[] = [
  'firma_name', 'firma_zusatz', 'inhaber', 'strasse', 'plz', 'ort',
  'telefon', 'email', 'website', 'ust_id', 'steuernummer',
  'iban', 'bic', 'bank_name',
  'farbe_primaer', 'farbe_akzent', 'logo_url',
  'angebotsnummer_prefix', 'angebotsnummer_naechste', 'angebot_gueltig_tage',
  'zahlungsziel_tage', 'angebot_einleitung', 'angebot_abschluss',
  'zahlungskonditionen_text', 'mwst_satz', 'onboarding_abgeschlossen',
  'anrede_vorlage', 'widerrufsbelehrung_text', 'agb_text',
  'pdf_layout', 'pdf_zeige_bic', 'pdf_zeige_telefon', 'pdf_zeige_website', 'pdf_hinweis',
  'pdf_zeige_massivholz', 'pdf_massivholz_text', 'pdf_zeige_unterschrift', 'pdf_unterschrift_text',
  'pdf_eigenes_briefpapier', 'pdf_briefpapier_url',
  'pdf_margin_top', 'pdf_margin_bottom', 'pdf_margin_left', 'pdf_margin_right',
  'pdf_schriftart', 'pdf_zeige_menge', 'pdf_zeige_einheitspreis',
  'kleinunternehmer',
  'benchmark_zustimmung',
  'preisfaktor',
  // Mit welchem Namen die Kommentare dieses Kontos oeffentlich erscheinen.
  // Einmal gewaehlt, gilt fuer alle (Fabian, 19.09.). Geprueft wird der Wert in
  // der Route — ein unbekannter Wert wuerde sonst am CHECK der Spalte scheitern.
  'wunsch_name_art',
]

/**
 * Felder, die über diese Route NIEMALS gesetzt werden dürfen — sie entscheiden über
 * Geld und Zugang. Die Liste ist der Prüfstein des Tests: Taucht eines davon je
 * wieder in PROFIL_FELDER auf, schlägt `npm run test` fehl.
 */
export const GESPERRTE_PROFIL_FELDER: readonly string[] = [
  'plan', 'abo_status', 'plan_gueltig_bis', 'trial_starts_at',
  'gutschein_code',
  'stripe_customer_id', 'stripe_subscription_id', 'stripe_price_id',
]

export const PROFIL_BOOL_FELDER: readonly string[] = [
  'pdf_eigenes_briefpapier', 'pdf_zeige_bic', 'pdf_zeige_telefon', 'pdf_zeige_website',
  'pdf_zeige_massivholz', 'pdf_zeige_unterschrift', 'benchmark_zustimmung',
  'pdf_zeige_menge', 'pdf_zeige_einheitspreis', 'kleinunternehmer',
  'onboarding_abgeschlossen',
]

export const PROFIL_ZAHL_FELDER: readonly string[] = [
  'pdf_margin_top', 'pdf_margin_bottom', 'pdf_margin_left', 'pdf_margin_right',
  'mwst_satz', 'zahlungsziel_tage', 'angebot_gueltig_tage', 'angebotsnummer_naechste',
]

/**
 * true, wenn das Feld frei beschreibbar ist. Zusätzlich zur Whitelist wird
 * ausdrücklich gegen die Sperrliste geprüft (Gürtel und Hosenträger): Wer künftig
 * ein Feld in PROFIL_FELDER nachträgt, kann ein gesperrtes nicht versehentlich
 * mit hereinholen — jeder `stripe_*`-Name ist ebenfalls gesperrt.
 */
export function darfGeschriebenWerden(feld: string): boolean {
  if (GESPERRTE_PROFIL_FELDER.includes(feld)) return false
  if (feld.startsWith('stripe_')) return false
  return PROFIL_FELDER.includes(feld)
}
