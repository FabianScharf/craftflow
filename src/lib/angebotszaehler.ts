// Zählt Angebote je Monat je Nutzer (Tabelle plan_usage). Ausgelagert aus
// /api/usage, damit /api/analyze (zählt jetzt hier, nicht mehr die PDF-Erstellung)
// dieselbe Logik nutzt statt einer zweiten Kopie.

import type { SupabaseClient } from '@supabase/supabase-js'

/** Monatsschlüssel wie überall in der Deckel-Logik: "YYYY-MM". */
export function aktuellerMonat(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export async function ladeAngebotsstand(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ count: number; monat: string }> {
  const monat = aktuellerMonat()
  const { data } = await supabase
    .from('plan_usage')
    .select('angebote_count')
    .eq('user_id', userId)
    .eq('monat', monat)
    .single()
  return { count: data?.angebote_count ?? 0, monat }
}

/**
 * Reserviert atomar einen Angebots-Platz für den Monat — VOR dem teuren KI-Aufruf
 * (Fix-Runde 16.09.), nicht mehr per Lesen+Vergleichen+Hochzählen danach. Das alte
 * Muster (ladeAngebotsstand → vergleichen → zaehleAngebotHoch nach Erfolg) hatte
 * eine Race Condition: zwei gleichzeitige Anfragen im letzten freien Platz sahen
 * beide "noch Platz frei" und beide zählten hoch — der Deckel liess sich damit
 * knapp überschreiten. `reserviere_angebot` (SQL, security definer) macht Prüfen
 * und Erhöhen in einem atomaren `insert … on conflict … do update … where`.
 *
 * `limit`: null = unbegrenzt (Plan-Deckel), dann erhöht die SQL-Funktion immer.
 * Rückgabe `{ ok: false, count }`: Deckel erreicht, NICHTS wurde erhöht — `count`
 * ist der aktuelle Stand für die Fehlermeldung. Ruft der Aufrufer im Anschluss
 * `gibAngebotFrei` auf (z. B. weil die KI keine Positionen lieferte), wird die
 * Reservierung wieder freigegeben — sie zählt dann nicht als verbrauchtes Angebot.
 */
export async function reserviereAngebot(
  supabase: SupabaseClient,
  monat: string,
  limit: number | null,
): Promise<{ ok: boolean; count: number }> {
  const { data, error } = await supabase.rpc('reserviere_angebot', { p_monat: monat, p_limit: limit })
  // Supabase wirft nicht, sondern liefert { data: null, error } — ein Ausfall hier
  // darf nicht als "Platz frei" durchgehen (das würde den Deckel aushebeln), also
  // fail-closed wie bei pruefeZugang: kein erfolgreicher Zugriff ohne Bestätigung.
  if (error) {
    console.error('[angebotszaehler] reserviereAngebot:', error.message)
    return { ok: false, count: 0 }
  }
  return data as { ok: boolean; count: number }
}

/**
 * Gibt eine zuvor reservierte Reservierung wieder frei (Angebot ohne Positionen,
 * fehlgeschlagener KI-Aufruf, JSON-Parse-Fehler — s. /api/analyze). Nie blockierend:
 * ein Fehler hier wird geloggt, darf die Antwort an den Nutzer aber nicht aufhalten.
 */
export async function gibAngebotFrei(
  supabase: SupabaseClient,
  monat: string,
): Promise<void> {
  const { error } = await supabase.rpc('gib_angebot_frei', { p_monat: monat })
  if (error) console.error('[angebotszaehler] gibAngebotFrei:', error.message)
}
