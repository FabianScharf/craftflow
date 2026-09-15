// Serverseitiges Zugangstor — der Grund für Aufgabe 0: Nach der Testphase sperrt
// bisher nur der Browser (usePlan.isBlocked), keine einzige API-Route prüft das.
// Wer die Paywall umgeht, nutzt die KI unbegrenzt und unbezahlt.
//
// pruefeZugang() ist die EINE Stelle, die jede kostenpflichtige Route zuerst
// aufruft. Aufgabe 3 erweitert diese Datei — die beiden Exporte hier bleiben stabil.

import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { effektiverPlan, sperrgrund, type EffektiverPlan, type ProfilFuerPlan } from './plaene'
import { zugangAblehnung } from './plantexte'

async function ladeProfilFuerZugang(supabase: SupabaseClient, userId: string): Promise<ProfilFuerPlan | null> {
  const { data, error } = await supabase
    .from('betriebsprofil')
    .select('plan, trial_starts_at, abo_status, plan_gueltig_bis')
    .eq('user_id', userId)
    .single()
  if (error) { console.error('[planpruefung] Profil laden:', error.message); return null }
  return data as ProfilFuerPlan | null
}

/** Nur der effektive Plan — für Routen, die ihn zusätzlich brauchen (z. B. Deckel-Prüfung). */
export async function ladeEffektivenPlan(supabase: SupabaseClient, userId: string): Promise<EffektiverPlan> {
  return effektiverPlan(await ladeProfilFuerZugang(supabase, userId))
}

/**
 * Erste Prüfung nach dem Login in jeder kostenpflichtigen Route:
 *   const zu = await pruefeZugang(supabase, userId)
 *   if (zu) return zu
 *
 * null = Zugang gewährt. Sonst eine fertige 402-Antwort mit Text und Ziel-Plan.
 */
export async function pruefeZugang(supabase: SupabaseClient, userId: string): Promise<NextResponse | null> {
  const profil = await ladeProfilFuerZugang(supabase, userId)
  if (effektiverPlan(profil) !== 'gesperrt') return null
  return NextResponse.json(zugangAblehnung(sperrgrund(profil) ?? 'testphase'), { status: 402 })
}
