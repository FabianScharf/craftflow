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
// Reihenfolge NIE destruktiv: erst am Ziel einfügen, dann erst die Quelle löschen
// (siehe Kommentare unten) — schlägt ein Schritt fehl, sind Stimmen höchstens
// vorübergehend doppelt gezählt, nie unwiderruflich weg.

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

      // Reihenfolge bewusst NICHT destruktiv: erst einfügen, dann erst löschen.
      // Schlägt das Einfügen fehl, bleiben die Quell-Stimmen unangetastet und der
      // Wunsch ist noch nicht als zusammengelegt markiert — nichts geht verloren,
      // ein erneuter Versuch holt es nach. `upsert` mit ignoreDuplicates fängt den
      // Primärschlüssel ab, falls derselbe Nutzer zwischen Lesen und Schreiben
      // (siehe unten) selbst schon für das Ziel gestimmt hat.
      if (uebertragen.length > 0) {
        const { error: insErr } = await service
          .from('wunsch_stimmen')
          .upsert(uebertragen, { onConflict: 'wunsch_id,user_id', ignoreDuplicates: true })
        if (insErr) {
          console.error('[admin/wuensche] Stimmen übertragen:', insErr.message)
          return NextResponse.json({ error: 'Stimmen konnten nicht übertragen werden.' }, { status: 500 })
        }
      }
      // Bewusst in Kauf genommen: Stimmt jemand GENAU zwischen dem Lesen oben und
      // dem Löschen hier für die Quelle ab, geht diese eine Stimme unter (die Zeile
      // existierte beim Lesen noch nicht, wird aber gleich mitgelöscht). Admin-Aktion
      // mit sehr geringem Verkehr — kein Grund für eine Transaktion oder einen Lock.
      const { error: delErr } = await service.from('wunsch_stimmen').delete().eq('wunsch_id', id)
      if (delErr) {
        console.error('[admin/wuensche] Stimmen löschen:', delErr.message)
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
