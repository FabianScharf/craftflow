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

export async function zaehleAngebotHoch(
  supabase: SupabaseClient,
  userId: string,
  monat: string,
  count: number,
): Promise<void> {
  const { error } = await supabase
    .from('plan_usage')
    .upsert({ user_id: userId, monat, angebote_count: count + 1 }, { onConflict: 'user_id,monat' })
  if (error) console.error('[angebotszaehler] zaehleAngebotHoch:', error.message)
}
