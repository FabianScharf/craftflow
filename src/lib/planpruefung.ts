// Serverseitiges Zugangstor — der Grund für Aufgabe 0: Nach der Testphase sperrt
// bisher nur der Browser (usePlan.isBlocked), keine einzige API-Route prüft das.
// Wer die Paywall umgeht, nutzt die KI unbegrenzt und unbezahlt.
//
// pruefeZugang() ist die EINE Stelle, die jede kostenpflichtige Route zuerst
// aufruft. Aufgabe 3 erweitert diese Datei — die beiden Exporte hier bleiben stabil.

import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { effektiverPlan, erlaubt, deckel, sperrgrund, type EffektiverPlan, type ProfilFuerPlan, type Funktion, type DeckelArt, type Plan } from './plaene'
import { zugangAblehnung, ablehnung, deckelAblehnung } from './plantexte'

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

/**
 * Zweite Prüfung nach `pruefeZugang` — für Routen, deren Funktion erst ab einem
 * bestimmten Plan freigeschaltet ist (z. B. Lernschleife ab Pro):
 *   const sperre = await pruefeFunktion(supabase, userId, 'lernschleife')
 *   if (sperre) return sperre
 *
 * Ruft intern zuerst pruefeZugang auf: 'gesperrt' (Testphase/Gutschein abgelaufen)
 * liefert dessen 402-Antwort, eine fehlende Funktion im sonst gültigen Plan die
 * 403-Antwort aus ablehnung(). null = erlaubt.
 */
export async function pruefeFunktion(supabase: SupabaseClient, userId: string, f: Funktion): Promise<NextResponse | null> {
  const profil = await ladeProfilFuerZugang(supabase, userId)
  const plan = effektiverPlan(profil)
  if (plan === 'gesperrt') return NextResponse.json(zugangAblehnung(sperrgrund(profil) ?? 'testphase'), { status: 402 })
  if (erlaubt(plan, f)) return null
  return NextResponse.json(ablehnung(f), { status: 403 })
}

/** null = unter dem Deckel. `anzahl` ist der Stand VOR der neuen Anlage. */
export function pruefeDeckel(plan: EffektiverPlan, art: DeckelArt, anzahl: number): NextResponse | null {
  const grenze = deckel(plan, art)
  if (grenze === null || anzahl < grenze) return null
  // deckelAblehnung erwartet einen konkreten Plan; 'gesperrt' kommt hier praktisch
  // nie an (pruefeZugang/pruefeFunktion fangen das vorher ab) — Solo als Fallback-Text.
  return NextResponse.json(deckelAblehnung(art, plan === 'gesperrt' ? 'solo' : (plan as Plan), grenze), { status: 403 })
}
