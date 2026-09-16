import type { SupabaseClient } from '@supabase/supabase-js'
import { bauePreisBlock, MAX_PREISE_IM_PROMPT, type FixierterPreis } from './materialpreise'
import { deckel, erlaubt, type Plan } from './plaene'
import { ladeEffektivenPlan } from './planpruefung'
import { ablehnung, deckelAblehnung } from './plantexte'

// Serverseitige DB-Helfer für fixierte Einkaufspreise. Bewusst getrennt von
// src/lib/materialpreise.ts, damit die reine Logik dort ohne Supabase testbar
// bleibt — gleiche Aufteilung wie learn.ts / bauweise.ts.

type PreisMitStand = FixierterPreis & { created_at: string; updated_at: string }

function zuFixierterPreis(r: Record<string, unknown>): PreisMitStand {
  return {
    id: r.id as string,
    bezeichnung: r.bezeichnung as string,
    ek: Number(r.ek),
    einheit: r.einheit as string,
    stand: r.stand as string,
    created_at: r.created_at as string,
    updated_at: r.updated_at as string,
  }
}

// Reihenfolge fürs Prompt bleibt `updated_at` absteigend — egal ob die Auswahl
// selbst per Deckel (älteste N nach created_at) oder per DB-Sortierung
// (unbegrenzter Plan) zustande kam.
function sortiereFuerPrompt(preise: PreisMitStand[]): FixierterPreis[] {
  return [...preise]
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
    .map(({ updated_at: _updatedAt, ...rest }) => rest)
}

// Deckel VOR limit() (Fabian, 15.09.): Bei einem endlichen Plan-Deckel wird ZUERST
// nach `created_at` aufsteigend sortiert und mit `limit(grenze)` geholt — das SIND
// die ältesten N, exakt dieselbe Auswahl, die die GET-Anzeige (wendeDeckelAn über
// ALLE Einträge) als aktivDurchPlan markiert. Erst danach wird für den Prompt in
// die bisherige Reihenfolge (`updated_at` absteigend) umsortiert — vorher hätte
// die DB-seitige Recency-Sortierung samt Limit schon Einträge aussortiert, die
// laut Deckel eigentlich aktiv gewesen wären: Prompt und GET-Anzeige zeigten
// dadurch unterschiedliche aktive Preise.
export async function ladeAktivePreise(
  supabase: SupabaseClient,
  userId: string,
): Promise<FixierterPreis[]> {
  const plan = await ladeEffektivenPlan(supabase, userId)
  const grenze = deckel(plan, 'materialpreise')

  if (grenze !== null) {
    const { data, error } = await supabase
      .from('materialpreise')
      .select('id, bezeichnung, ek, einheit, stand, created_at, updated_at')
      .eq('user_id', userId)
      .eq('aktiv', true)
      .order('created_at', { ascending: true })
      .limit(grenze)
    // Supabase wirft nicht, sondern liefert { data: null, error }. Wer nur data
    // liest, haelt einen Ausfall fuer "keine Preise vorhanden" — und kalkuliert
    // still mit geschaetzten Werten weiter.
    if (error) { console.error('[preise] ladeAktivePreise:', error.message); return [] }
    return sortiereFuerPrompt((data ?? []).map(zuFixierterPreis))
  }

  const { data, error } = await supabase
    .from('materialpreise')
    .select('id, bezeichnung, ek, einheit, stand, created_at, updated_at')
    .eq('user_id', userId)
    .eq('aktiv', true)
    .order('updated_at', { ascending: false })
    .limit(MAX_PREISE_IM_PROMPT)
  if (error) { console.error('[preise] ladeAktivePreise:', error.message); return [] }
  return (data ?? []).map(zuFixierterPreis).map(({ updated_at: _updatedAt, ...rest }) => rest)
}

export async function preisBlockFuerNutzer(
  supabase: SupabaseClient,
  userId: string,
): Promise<string> {
  return bauePreisBlock(await ladeAktivePreise(supabase, userId))
}

// Gleiche Bezeichnung => aktualisieren statt doppelt anlegen. Zwei Eintraege
// fuer dasselbe Material waeren nicht aufloesbar: findePreis nimmt den
// laengsten Treffer, bei gleicher Laenge waere das Ergebnis zufaellig — und
// der Nutzer saehe zwei widersprechende Preise in den Einstellungen.
export async function speicherePreis(
  supabase: SupabaseClient,
  userId: string,
  p: { bezeichnung: string; ek: number; einheit: string },
): Promise<{ ok: true; aktualisiert: boolean } | { ok: false; grund: string }> {
  const heute = new Date().toISOString().slice(0, 10)
  const jetzt = new Date().toISOString()

  const { data: vorhanden, error: suchFehler } = await supabase
    .from('materialpreise')
    .select('id')
    .eq('user_id', userId)
    .ilike('bezeichnung', p.bezeichnung)
    .maybeSingle()
  if (suchFehler) return { ok: false, grund: suchFehler.message }

  // Deckel nur vor dem Insert-Zweig prüfen — ein Update ersetzt einen
  // bestehenden Preis und ist kein Wachstum (Fabian, 15.09.).
  if (!vorhanden) {
    const plan = await ladeEffektivenPlan(supabase, userId)
    if (!erlaubt(plan, 'materialpreise')) return { ok: false, grund: ablehnung('materialpreise').error }
    const grenze = deckel(plan, 'materialpreise')
    if (grenze !== null) {
      const { count } = await supabase
        .from('materialpreise')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('aktiv', true)
      if ((count ?? 0) >= grenze) {
        return { ok: false, grund: deckelAblehnung('materialpreise', plan === 'gesperrt' ? 'solo' : (plan as Plan), grenze).error }
      }
    }
  }

  const { error } = vorhanden
    ? await supabase.from('materialpreise')
        .update({ ek: p.ek, einheit: p.einheit, stand: heute, aktiv: true, updated_at: jetzt })
        .eq('id', (vorhanden as { id: string }).id)
        .eq('user_id', userId)
    : await supabase.from('materialpreise')
        .insert({ user_id: userId, bezeichnung: p.bezeichnung, ek: p.ek, einheit: p.einheit, stand: heute })

  // Der echte Grund MUSS zurueck. Die Meldung "konnte nicht gespeichert werden"
  // ohne Ursache hat am 2026-09-05 rund 20 Minuten Fehlersuche gekostet —
  // die Datenbank hatte laengst gesagt, woran es lag.
  if (error) return { ok: false, grund: error.message }
  return { ok: true, aktualisiert: !!vorhanden }
}
