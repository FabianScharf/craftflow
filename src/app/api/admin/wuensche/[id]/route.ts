// Status setzen, zusammenlegen, ausblenden — nur Fabian. Dieselbe Bauart wie
// src/app/api/admin/gutscheincodes/route.ts: eine guard()-Funktion, die die
// E-Mail prüft, und ein Service-Role-Client für den Schreibzugriff (die
// RLS-Policies erlauben authenticated bewusst kein update).
//
// ZUSAMMENLEGEN: Die Stimmen des Quell-Wunsches wandern zum Ziel, ohne die Regel
// „eine Stimme je Wunsch je Nutzer" zu verletzen — planeZusammenlegenStimmen()
// (reine Funktion, getestet) entscheidet, verworfene Duplikate werden einfach
// nicht übernommen. Die Quelle selbst verliert dabei alle ihre Stimmen (sie wird
// ausgeblendet) und bekommt `zusammengelegt_in` gesetzt.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { getSupabaseClient } from '@/lib/supabase'
import { istWunschStatus, planeZusammenlegenStimmen, type Stimme } from '@/lib/wuensche'

const ADMIN_EMAIL = 'l.m.p.1@gmx.de'

async function guard(): Promise<boolean> {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  return !error && !!user && user.email === ADMIN_EMAIL
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await guard()) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })
  const { id } = await params
  const body = await req.json().catch(() => ({})) as { status?: unknown; zusammengelegt_in?: unknown }

  const service = getSupabaseClient()
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }

  if ('status' in body) {
    if (!istWunschStatus(body.status)) {
      return NextResponse.json({ error: `„${String(body.status)}“ ist kein gültiger Status.` }, { status: 400 })
    }
    patch.status = body.status
  }

  if ('zusammengelegt_in' in body) {
    const ziel = body.zusammengelegt_in
    if (ziel !== null && typeof ziel !== 'string') {
      return NextResponse.json({ error: 'Ziel des Zusammenlegens muss eine Kennung oder null sein.' }, { status: 400 })
    }
    if (ziel === id) {
      return NextResponse.json({ error: 'Ein Wunsch kann nicht in sich selbst zusammengelegt werden.' }, { status: 400 })
    }
    patch.zusammengelegt_in = ziel

    if (ziel !== null) {
      const { data: stimmenRoh, error: sErr } = await service
        .from('wunsch_stimmen')
        .select('wunsch_id, user_id, created_at')
        .in('wunsch_id', [id, ziel])
      if (sErr) {
        console.error('[admin/wuensche] Stimmen laden:', sErr.message)
        return NextResponse.json({ error: 'Stimmen konnten nicht geladen werden.' }, { status: 500 })
      }
      const stimmen = (stimmenRoh ?? []) as Stimme[]
      const stimmenQuelle = stimmen.filter(s => s.wunsch_id === id)
      const stimmenZiel = stimmen.filter(s => s.wunsch_id === ziel)
      const { uebertragen } = planeZusammenlegenStimmen(id, ziel, stimmenQuelle, stimmenZiel)

      // Alle Quell-Stimmen entfernen — übertragene wie verworfene Duplikate. Die
      // Quelle wird ausgeblendet, ihre Stimmen dürfen dort nicht liegen bleiben.
      const { error: delErr } = await service.from('wunsch_stimmen').delete().eq('wunsch_id', id)
      if (delErr) {
        console.error('[admin/wuensche] Stimmen löschen:', delErr.message)
        return NextResponse.json({ error: 'Stimmen konnten nicht übertragen werden.' }, { status: 500 })
      }
      if (uebertragen.length > 0) {
        const { error: insErr } = await service.from('wunsch_stimmen').insert(uebertragen)
        if (insErr) {
          console.error('[admin/wuensche] Stimmen übertragen:', insErr.message)
          return NextResponse.json({ error: 'Stimmen konnten nicht übertragen werden.' }, { status: 500 })
        }
      }
      // Ausblenden, sofern der Aufruf nicht ausdrücklich einen anderen Status setzt.
      if (!('status' in body)) patch.status = 'ausgeblendet'
    }
  }

  if (Object.keys(patch).length === 1) {
    return NextResponse.json({ error: 'Nichts zu ändern.' }, { status: 400 })
  }

  const { error } = await service.from('wuensche').update(patch).eq('id', id)
  if (error) {
    console.error('[admin/wuensche] Update:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
