// Status setzen, zusammenlegen, ausblenden — nur Fabian. Dieselbe Bauart wie
// src/app/api/admin/gutscheincodes/route.ts: eine guard()-Funktion, die die
// E-Mail prüft, und ein Service-Role-Client für den Schreibzugriff (die
// RLS-Policies erlauben authenticated bewusst kein update).
//
// ZUSAMMENLEGEN (Stimmenkonto, 16.09. abends): Die Stimmen des Quell-Wunsches wandern
// per einfachem SQL-Update (`set wunsch_id = ziel where wunsch_id = quelle`) zum Ziel —
// eine einzelne Update-Anweisung, damit ids/created_at erhalten bleiben, statt wie
// früher löschen+einfügen. Eine Dubletten-Regel braucht es nicht mehr: Seit Stimmen
// stapelbar sind (eigene id statt Primärschlüssel (wunsch_id, user_id)), kann ein
// Nutzer am Ziel schon Stimmen liegen haben — es kommen einfach weitere dazu. Die reine
// Funktion `planeZusammenlegenStimmen` bildet dieselbe Regel ab und bleibt für den Test
// erhalten, wird von dieser Route aber nicht mehr aufgerufen.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { getSupabaseClient } from '@/lib/supabase'
import { istWunschStatus } from '@/lib/wuensche'

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
    // Wiedereröffnen hebt eine frühere Zusammenlegung auf: Ohne das bliebe
    // zusammengelegt_in gesetzt, und die normale (gefilterte) Liste zeigt den
    // Wunsch trotz status='offen' weiterhin nicht — nur der Admin-Umschalter
    // "Ausgeblendete und zusammengelegte anzeigen" (I-1) würde ihn noch finden.
    // Kein zweiter Schritt nötig: "offen" heißt wieder ein eigenständiger Wunsch.
    if (body.status === 'offen') patch.zusammengelegt_in = null
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
      // Eine einzige Update-Anweisung verschiebt alle Quell-Stimmen zum Ziel — ids und
      // created_at bleiben erhalten, ein PK-Konflikt ist ausgeschlossen (Stimmen sind
      // stapelbar, die id ist der Primärschlüssel, nicht mehr (wunsch_id, user_id)).
      const { error: moveErr } = await service
        .from('wunsch_stimmen')
        .update({ wunsch_id: ziel })
        .eq('wunsch_id', id)
      if (moveErr) {
        console.error('[admin/wuensche] Stimmen verschieben:', moveErr.message)
        return NextResponse.json({ error: 'Stimmen konnten nicht übertragen werden.' }, { status: 500 })
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
