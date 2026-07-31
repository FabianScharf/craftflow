import type { SupabaseClient } from '@supabase/supabase-js'
import { baueRegelBlock, MAX_REGELN_IM_PROMPT } from './learn'

// Serverseitige DB-Helfer für den Bauweise-Vault. Bewusst getrennt von
// src/lib/learn.ts, damit die reine Logik dort ohne Supabase testbar bleibt.

export type AktiveRegel = { id: string; bereich: string; wenn: string; dann: string }

// Sortierung: zuletzt mitgeschickte zuerst, dann die neuesten. Bei mehr als
// MAX_REGELN_IM_PROMPT Regeln fallen die ältesten/ungenutzten heraus — das
// Vault-UI zeigt dem Nutzer, welche das sind (kein stilles Abschneiden).
export async function ladeAktiveRegeln(supabase: SupabaseClient, userId: string): Promise<AktiveRegel[]> {
  const { data, error } = await supabase
    .from('bauweise_regeln')
    .select('id, bereich, wenn, dann')
    .eq('user_id', userId)
    .eq('aktiv', true)
    .order('zuletzt_gesendet', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(MAX_REGELN_IM_PROMPT)
  if (error) { console.error('[learn] ladeAktiveRegeln:', error.message); return [] }
  return (data ?? []) as AktiveRegel[]
}

export async function regelBlockFuerNutzer(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ block: string; ids: string[] }> {
  const regeln = await ladeAktiveRegeln(supabase, userId)
  return { block: baueRegelBlock(regeln), ids: regeln.map(r => r.id) }
}

// Feuere-und-vergiss: darf die Antwort an den Nutzer nicht verzögern und im
// Fehlerfall nichts kaputt machen.
export function zaehleRegelnHoch(supabase: SupabaseClient, ids: string[]): void {
  if (ids.length === 0) return
  void supabase
    .rpc('bauweise_regeln_gesendet', { regel_ids: ids })
    .then(() => {}, (e: unknown) => console.error('[learn] zaehleRegelnHoch:', e))
}
