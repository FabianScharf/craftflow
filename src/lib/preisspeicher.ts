import type { SupabaseClient } from '@supabase/supabase-js'
import { bauePreisBlock, MAX_PREISE_IM_PROMPT, type FixierterPreis } from './materialpreise'

// Serverseitige DB-Helfer für fixierte Einkaufspreise. Bewusst getrennt von
// src/lib/materialpreise.ts, damit die reine Logik dort ohne Supabase testbar
// bleibt — gleiche Aufteilung wie learn.ts / bauweise.ts.

export async function ladeAktivePreise(
  supabase: SupabaseClient,
  userId: string,
): Promise<FixierterPreis[]> {
  const { data, error } = await supabase
    .from('materialpreise')
    .select('id, bezeichnung, ek, einheit, stand')
    .eq('user_id', userId)
    .eq('aktiv', true)
    .order('updated_at', { ascending: false })
    .limit(MAX_PREISE_IM_PROMPT)
  // Supabase wirft nicht, sondern liefert { data: null, error }. Wer nur data
  // liest, haelt einen Ausfall fuer "keine Preise vorhanden" — und kalkuliert
  // still mit geschaetzten Werten weiter.
  if (error) { console.error('[preise] ladeAktivePreise:', error.message); return [] }
  return (data ?? []).map(r => ({
    id: r.id as string,
    bezeichnung: r.bezeichnung as string,
    ek: Number(r.ek),
    einheit: r.einheit as string,
    stand: r.stand as string,
  }))
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
