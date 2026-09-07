// Supabase-Zugriff fuer die Betriebskalibrierung. Getrennt von kalibrierung.ts,
// weil die Rechenbibliothek nichts importieren darf — sonst sind die Tests ohne
// Bundler nicht mehr ausfuehrbar.
//
// Supabase wirft nicht. Es liefert { data: null, error }. Wer nur `data` liest,
// haelt einen Ausfall fuer einen Normalfall — deshalb wird jeder Fehler ausdruecklich
// geprueft und im Klartext zurueckgegeben.
import type { SupabaseClient } from '@supabase/supabase-js'
import { KEINE_FAKTOREN, type Faktoren } from './zeitfaktoren'

export type Kalibrierung = {
  mitarbeiter: string
  maschinen: string[]
  schwerpunkt: string[]
  montage_selbst: string
  stueckzahlen: string
  antwort_grund: string
  antwort_lack: string
  antwort_massiv: string
  antwort_montage: string
  faktor_werkstatt: number
  faktor_oberflaeche: number
  faktor_massivholz: number
  faktor_montage: number
  abgeschlossen: boolean
  hinweis_gezeigt: boolean
}

export async function ladeKalibrierung(
  supabase: SupabaseClient, userId: string,
): Promise<Kalibrierung | null> {
  if (!userId) return null
  const { data, error } = await supabase
    .from('betriebskalibrierung')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) { console.error('[kalibrierung] laden:', error.message); return null }
  return (data as Kalibrierung | null) ?? null
}

/**
 * Die vier Faktoren fuer die Kalkulation. Fehlt die Kalibrierung oder ist sie nicht
 * abgeschlossen, wird mit Branchenwerten gerechnet — also mit 1,0 in allen vier
 * Bereichen. Eine uebersprungene Frage darf nie wie eine beantwortete wirken.
 */
export async function ladeFaktoren(
  supabase: SupabaseClient, userId: string,
): Promise<Faktoren> {
  const k = await ladeKalibrierung(supabase, userId)
  if (!k || !k.abgeschlossen) return { ...KEINE_FAKTOREN }
  const zahl = (v: unknown) => {
    const n = Number(v)
    return Number.isFinite(n) && n > 0 ? n : 1
  }
  return {
    werkstatt:   zahl(k.faktor_werkstatt),
    oberflaeche: zahl(k.faktor_oberflaeche),
    massivholz:  zahl(k.faktor_massivholz),
    montage:     zahl(k.faktor_montage),
  }
}

export async function speichereKalibrierung(
  supabase: SupabaseClient, userId: string, daten: Partial<Kalibrierung>,
): Promise<{ ok: boolean; grund?: string }> {
  if (!userId) return { ok: false, grund: 'Nicht eingeloggt' }
  const { error } = await supabase
    .from('betriebskalibrierung')
    .upsert({ ...daten, user_id: userId, updated_at: new Date().toISOString() },
            { onConflict: 'user_id' })
  if (error) return { ok: false, grund: error.message }
  return { ok: true }
}
