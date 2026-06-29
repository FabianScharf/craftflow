import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export const maxDuration = 30

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

    const body = await req.json() as {
      type: string
      projectId?: string
      data?: Record<string, unknown>
    }
    const { type, projectId, data = {} } = body

    // ── outcome_init: Erstes Speichern eines Projekts ──────────────────
    if (type === 'outcome_init' && projectId) {
      const { data: existing } = await supabase
        .from('angebot_outcomes')
        .select('id')
        .eq('project_id', projectId)
        .maybeSingle()

      if (!existing) {
        await supabase.from('angebot_outcomes').insert({
          project_id:       projectId,
          user_id:          user.id,
          moebel_typ:       data.moebel_typ ?? '',
          material:         data.material ?? '',
          ist_massivholz:   data.ist_massivholz ?? false,
          preis_kalkuliert: data.preis_kalkuliert ?? 0,
          region:           data.plz ?? '',
          status:           'offen',
          include_in_benchmark: true,
        })
      }
      return NextResponse.json({ ok: true })
    }

    // ── pdf_export: PDF wurde erstellt ────────────────────────────────
    if (type === 'pdf_export' && projectId) {
      await supabase.from('angebot_events').insert({
        project_id: projectId,
        user_id:    user.id,
        event_type: 'pdf_export',
        event_data: { preis_netto: data.preis_netto ?? 0 },
      })
      await supabase
        .from('angebot_outcomes')
        .update({ pdf_exportiert_at: new Date().toISOString() })
        .eq('project_id', projectId)

      return NextResponse.json({ ok: true })
    }

    // ── optim_message: KI-Optimierung Nachricht gesendet ─────────────
    if (type === 'optim_message' && projectId) {
      const nettoVorher   = (data.netto_vorher   as number) ?? 0
      const nettoNachher  = (data.netto_nachher  as number | null) ?? null
      const hadUpdate     = (data.had_update     as boolean) ?? false
      const deltaNetto    = hadUpdate && nettoNachher !== null ? nettoNachher - nettoVorher : null
      const deltaProzent  = deltaNetto !== null && nettoVorher > 0
        ? Math.round((deltaNetto / nettoVorher) * 10000) / 100
        : null

      await supabase.from('optim_events').insert({
        project_id:          projectId,
        user_id:             user.id,
        msg_nr:              data.msg_nr ?? 1,
        netto_vorher:        nettoVorher,
        netto_nachher:       hadUpdate ? nettoNachher : null,
        delta_netto:         deltaNetto,
        delta_prozent:       deltaProzent,
        positionen_vorher:   data.positionen_vorher ?? 0,
        positionen_nachher:  hadUpdate ? (data.positionen_nachher ?? 0) : null,
        had_update:          hadUpdate,
      })

      // Preis-Snapshot in angebot_outcomes aktualisieren
      if (hadUpdate && nettoNachher !== null && nettoNachher > 0) {
        try {
          await supabase.rpc('increment_preis_geaendert', { p_project_id: projectId, p_preis: nettoNachher })
        } catch {
          // Fallback: einfaches Update ohne Zähler
          await supabase
            .from('angebot_outcomes')
            .update({ preis_kalkuliert: nettoNachher })
            .eq('project_id', projectId)
        }
      }

      return NextResponse.json({ ok: true })
    }

    // ── status_change: Projektstatus geändert ─────────────────────────
    if (type === 'status_change' && projectId) {
      const newStatus  = (data.status as string) ?? 'offen'
      const tage       = (data.tage_seit_erstellung as number) ?? null

      await supabase
        .from('angebot_outcomes')
        .update({
          status:           newStatus,
          tage_bis_status:  tage,
          preis_final:      (data.preis_final as number) ?? null,
          updated_at:       new Date().toISOString(),
        })
        .eq('project_id', projectId)

      await supabase.from('angebot_events').insert({
        project_id: projectId,
        user_id:    user.id,
        event_type: 'status_change',
        event_data: { status: newStatus, tage },
      })

      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[tracking]', e)
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Fehler' }, { status: 500 })
  }
}
