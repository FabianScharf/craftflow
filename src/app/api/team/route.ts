// GET /api/team — die Mitgliederliste des Betriebs.
//
// Lesen darf sie JEDER im Betrieb (Spec §5: „Team — Inhaber: ja, Mitarbeiter:
// Liste sehen, nicht ändern"). Die E-Mail-Adressen der Mitglieder stehen darin:
// betriebsintern, wie eine Personalliste. Geändert wird hier nichts — dafür sind
// /api/team/einladen und /api/team/[id] da, und die prüfen `istInhaber`.

import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { getSupabaseClient } from '@/lib/supabase'
import { kontoIdFuer, kontoGesperrt } from '@/lib/kontoserver'
import { istImDeckel, type Mitglied } from '@/lib/konto'
import { plaetzeFrei, sortiereNachAnnahme } from '@/lib/team'
import { deckel } from '@/lib/plaene'
import { ladeEffektivenPlan } from '@/lib/planpruefung'
import { ladeMitglieder } from './gemeinsam'

/**
 * Anmeldeadresse des Inhabers. Ein Mitarbeiter kann sie nicht selbst lesen (sie
 * liegt in auth.users), deshalb hier über die Service-Role — und NUR die Adresse
 * des eigenen Betriebs, nie eine beliebige.
 */
async function inhaberEmail(kontoId: string): Promise<string | null> {
  try {
    const { data, error } = await getSupabaseClient().auth.admin.getUserById(kontoId)
    if (error) { console.error('[api/team] Inhaber-Adresse:', error.message); return null }
    return data.user?.email ?? null
  } catch (e) {
    console.error('[api/team] Inhaber-Adresse:', e instanceof Error ? e.message : e)
    return null
  }
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const konto = await kontoIdFuer(supabase, user)
  const sperre = kontoGesperrt(konto)
  if (sperre) return sperre
  const kontoId = konto.kontoId

  const alle = await ladeMitglieder(supabase, kontoId)
  if (!alle) return NextResponse.json({ error: 'Die Teamliste ist gerade nicht abrufbar.' }, { status: 500 })

  // Entfernte Mitglieder bleiben in der Datenbank (nichts wird gelöscht), aber sie
  // gehören nicht in die Liste — sonst wächst sie bei jedem Personalwechsel.
  const sichtbar = alle.filter(m => m.status !== 'entfernt')
  const aktive = alle.filter(m => m.status === 'aktiv')
  const eingeladene = sichtbar.filter(m => m.status === 'eingeladen')

  const plan = await ladeEffektivenPlan(supabase, kontoId)
  const grenze = deckel(plan, 'nutzer')
  const { frei } = plaetzeFrei(plan, aktive.length, eingeladene.length)

  return NextResponse.json({
    inhaber: { email: konto.istInhaber ? (user.email ?? null) : await inhaberEmail(kontoId) },
    mitglieder: sortiereNachAnnahme(sichtbar).map((m: Mitglied) => ({
      id: m.id,
      email: m.email,
      status: m.status,
      angenommen_am: m.angenommen_am,
      eingeladen_am: m.eingeladen_am,
      // „Ruhend" ist kein Datenbankzustand, sondern das Ergebnis des Deckels
      // (Ruling R1): aktives Mitglied außerhalb der Plätze des Plans.
      ruhend: m.status === 'aktiv' && !istImDeckel(m, aktive, grenze),
    })),
    // `belegt` zählt den Inhaber mit — er belegt immer Platz 1 (Spec §2).
    plaetze: { deckel: grenze, belegt: 1 + aktive.length, frei },
  })
}
