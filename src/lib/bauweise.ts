import type { SupabaseClient } from '@supabase/supabase-js'
import { after } from 'next/server'
import { baueRegelBlock, MAX_REGELN_IM_PROMPT } from './learn'
import { wendeDeckelAn, deckel, erlaubt, type Plan } from './plaene'
import { ladeEffektivenPlan } from './planpruefung'
import { ablehnung, deckelAblehnung } from './plantexte'

// Serverseitige DB-Helfer für den Bauweise-Vault. Bewusst getrennt von
// src/lib/learn.ts, damit die reine Logik dort ohne Supabase testbar bleibt.

export type AktiveRegel = { id: string; bereich: string; wenn: string; dann: string; created_at: string }

// Sortierung: zuletzt mitgeschickte zuerst, dann die neuesten — das bleibt die
// Reihenfolge fürs Prompt. Der Deckel selbst rechnet nach `created_at` (älteste
// N aktiv, Fabian 15.09.) — deshalb steht das Feld im select und wird danach
// gefiltert, bevor der Block gebaut wird.
export async function ladeAktiveRegeln(supabase: SupabaseClient, userId: string): Promise<AktiveRegel[]> {
  const { data, error } = await supabase
    .from('bauweise_regeln')
    .select('id, bereich, wenn, dann, created_at')
    .eq('user_id', userId)
    .eq('aktiv', true)
    .order('zuletzt_gesendet', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(MAX_REGELN_IM_PROMPT)
  if (error) { console.error('[learn] ladeAktiveRegeln:', error.message); return [] }
  const plan = await ladeEffektivenPlan(supabase, userId)
  return wendeDeckelAn(data as AktiveRegel[], deckel(plan, 'bauweiseRegeln')).filter(r => r.aktivDurchPlan)
}

export async function regelBlockFuerNutzer(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ block: string; ids: string[] }> {
  const regeln = await ladeAktiveRegeln(supabase, userId)
  return { block: baueRegelBlock(regeln), ids: regeln.map(r => r.id) }
}

// Läuft nach dem Senden der Antwort, verzögert sie also nicht — wird von der
// Plattform aber garantiert noch ausgeführt. Reines `void promise` wäre hier
// falsch: Vercel friert die Function nach der Antwort ein und nicht abgewartete
// Arbeit darf verloren gehen. Dann fehlen `gesendet_zahl`/`zuletzt_gesendet` —
// und weil die 60er-Priorisierung auf `zuletzt_gesendet` beruht, wäre auch die
// Auswahl der mitgeschickten Regeln still falsch.
export function zaehleRegelnHoch(supabase: SupabaseClient, ids: string[]): void {
  if (ids.length === 0) return
  after(async () => {
    const { error } = await supabase.rpc('bauweise_regeln_gesendet', { regel_ids: ids })
    if (error) console.error('[learn] zaehleRegelnHoch:', error.message)
  })
}

// Speichert eine gelernte Regel direkt. Wird vom Werkzeug `regel_merken` in
// /api/optimize genutzt — ein HTTP-Selbstaufruf der eigenen Settings-Route
// waere ein unnoetiger Umweg samt zweiter Auth-Pruefung.
//
// Gleicher Bereich + gleiches `wenn` => aktualisieren statt eine zweite,
// womoeglich widersprechende Regel anzulegen. Ausnahme: ein leeres `wenn`
// ("gilt immer") ist keine Identitaet — siehe istGleicheRegel in learn.ts.
export async function speichereRegel(
  supabase: SupabaseClient,
  userId: string,
  r: { bereich: string; wenn: string; dann: string; beleg: string },
): Promise<{ ok: true; aktualisiert: boolean } | { ok: false; grund: string }> {
  const jetzt = new Date().toISOString()
  const wenn = r.wenn.trim()

  let vorhandenId: string | null = null
  if (wenn !== '') {
    const { data, error } = await supabase
      .from('bauweise_regeln')
      .select('id')
      .eq('user_id', userId)
      .eq('bereich', r.bereich)
      .ilike('wenn', wenn)
      .maybeSingle()
    if (error) return { ok: false, grund: error.message }
    vorhandenId = (data as { id: string } | null)?.id ?? null
  }

  // Deckel nur vor dem Insert-Zweig prüfen — ein Update ersetzt eine bestehende
  // Regel und ist kein Wachstum (Fabian, 15.09.).
  if (!vorhandenId) {
    const plan = await ladeEffektivenPlan(supabase, userId)
    if (!erlaubt(plan, 'bauweise')) return { ok: false, grund: ablehnung('bauweise').error }
    const grenze = deckel(plan, 'bauweiseRegeln')
    if (grenze !== null) {
      const { count } = await supabase
        .from('bauweise_regeln')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('aktiv', true)
      if ((count ?? 0) >= grenze) {
        return { ok: false, grund: deckelAblehnung('bauweiseRegeln', plan === 'gesperrt' ? 'solo' : (plan as Plan), grenze).error }
      }
    }
  }

  const { error } = vorhandenId
    ? await supabase.from('bauweise_regeln')
        .update({ dann: r.dann, beleg: r.beleg, aktiv: true, konflikt_hinweis: false, updated_at: jetzt })
        .eq('id', vorhandenId).eq('user_id', userId)
    : await supabase.from('bauweise_regeln')
        .insert({
          user_id: userId, bereich: r.bereich, wenn, dann: r.dann,
          herkunft: 'gelernt', beleg: r.beleg, quelle_text: r.beleg,
        })

  // Der echte Grund muss zurueck — siehe Vorfall 2026-09-05 (fehlende Rechte,
  // sichtbar war nur "konnte nicht gespeichert werden").
  if (error) return { ok: false, grund: error.message }
  return { ok: true, aktualisiert: !!vorhandenId }
}
