// GET /api/konto — „Wessen Betrieb sehe ich hier?"
//
// Die Oberfläche braucht das bei jedem Laden: Betriebsname und „Mitarbeiter" in der
// Kopfzeile, ausgeblendete Inhaber-Bereiche (Mein Plan, Team, Betrieb löschen) und die
// Sperrseite für ruhende/entfernte Mitglieder.
//
// BEWUSST KEIN 403 bei „ruhend"/„entfernt" (anders als in allen anderen Routen): Wer
// gesperrt ist, muss erst erfahren, WARUM — sonst zeigt die App eine leere Seite ohne
// Erklärung (Fabian 2026-09-17).

import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { getSupabaseClient } from '@/lib/supabase'
import { kontoIdFuer } from '@/lib/kontoserver'
import { effektiverPlan, type ProfilFuerPlan } from '@/lib/plaene'

export async function GET() {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const konto = await kontoIdFuer(supabase, user)

  // Profil DES KONTOS, nicht des Logins: ein Mitarbeiter sieht Firmenname und Plan
  // seines Betriebs. PGRST116 = keine Zeile (Konto vor dem ersten /settings-Besuch).
  const { data, error } = await supabase
    .from('betriebsprofil')
    .select('firma_name, plan, trial_starts_at, abo_status, plan_gueltig_bis')
    .eq('user_id', konto.kontoId)
    .single()
  if (error && error.code !== 'PGRST116') {
    console.error('[api/konto] Betriebsprofil laden:', error.message)
  }
  const profil = (data ?? null) as (ProfilFuerPlan & { firma_name?: string | null }) | null

  // Gesamtprüfung M2 (17.09.): Für ein ruhendes/entferntes Mitglied ist kontoId die
  // EIGENE ID — der Name oben wäre der eigene, nicht der des Betriebs, aus dem es
  // ausgesperrt ist. Die Sperrseite soll den richtigen Betrieb nennen; RLS lässt das
  // Mitglied dieses Profil nicht mehr lesen, deshalb Service-Role, nur der Name.
  let betriebName: string | null = profil?.firma_name ?? null
  if ((konto.zustand === 'ruhend' || konto.zustand === 'entfernt') && konto.mitglied?.inhaber_id) {
    try {
      const { data: b, error: bErr } = await getSupabaseClient()
        .from('betriebsprofil').select('firma_name').eq('user_id', konto.mitglied.inhaber_id).maybeSingle()
      if (bErr) console.error('[api/konto] Betriebsname (gesperrt):', bErr.message)
      betriebName = ((b?.firma_name ?? '') as string).trim() || null
    } catch (e) {
      console.error('[api/konto] Betriebsname (gesperrt):', e instanceof Error ? e.message : String(e))
    }
  }

  return NextResponse.json({
    kontoId: konto.kontoId,
    istInhaber: konto.istInhaber,
    zustand: konto.zustand,
    betriebName,
    plan: effektiverPlan(profil),
    // Ruling R5 (Controller 2026-09-17): die drei Rohfelder des KONTOS wandern mit,
    // damit der Plan-Hook die Testphase ohne eigene Supabase-Abfrage im Browser
    // rechnen kann. Feldnamen genau wie im betriebsprofil.
    trial_starts_at: profil?.trial_starts_at ?? null,
    abo_status: profil?.abo_status ?? null,
    plan_gueltig_bis: profil?.plan_gueltig_bis ?? null,
  })
}
