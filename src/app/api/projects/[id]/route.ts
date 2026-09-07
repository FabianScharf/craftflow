import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (error || !data) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })
    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Fehler' }, { status: 500 })
  }
}

/**
 * PATCH ist ein Deckname fuer PUT.
 *
 * GEFUNDEN IM CHECK-UP 2026-09-07: Die Projektliste schickt seit jeher PATCH, die
 * Route kannte nur PUT — jeder Statuswechsel lief in ein 405. Die Antwort wurde
 * nirgends geprueft, also zeigte die Oberflaeche den neuen Status an, waehrend in der
 * Datenbank der alte stehenblieb. Nach dem Neuladen war er wieder da.
 *
 * Folgenschwer, weil die Lernschleife auf dem Status "gewonnen" aufbaut: Sie haette
 * nie ein einziges gewonnenes Angebot gesehen.
 */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return PUT(req, ctx)
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

    const body = await req.json()
    const { title, status, data } = body as { title?: string; status?: string; data?: unknown }

    const update: Record<string, unknown> = {}
    if (title !== undefined) update.title = title.trim()
    if (status !== undefined) update.status = status
    if (data !== undefined) update.data = data

    const { data: row, error } = await supabase
      .from('projects')
      .update(update)
      .eq('id', id)
      .eq('user_id', user.id)
      .select('id, title, status, updated_at')
      .single()

    if (error || !row) return NextResponse.json({ error: error?.message ?? 'Nicht gefunden' }, { status: 404 })
    return NextResponse.json(row)
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Fehler' }, { status: 500 })
  }
}

/**
 * Projekt loeschen.
 *
 * Gab es bis 2026-09-07 gar nicht — weder hier noch in der Oberflaeche. Aufgefallen
 * im Check-Up, als Testprojekte nicht wegzubekommen waren. Jedem Nutzer faellt das
 * spaetestens nach dem zehnten Testangebot auf.
 *
 * Die Angebotsversionen werden zuerst entfernt: Ob die Fremdschluessel-Beziehung
 * kaskadiert, ist nicht garantiert, und verwaiste Versionen wuerden die Lernschleife
 * mit Daten fuettern, deren Projekt es nicht mehr gibt.
 */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

    // Erst pruefen, ob es dem Nutzer gehoert. Ohne diese Pruefung koennte ein
    // Loeschversuch auf eine fremde Kennung stillschweigend "erfolgreich" wirken.
    const { data: vorhanden, error: findeErr } = await supabase
      .from('projects')
      .select('id')
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle()
    if (findeErr) return NextResponse.json({ error: findeErr.message }, { status: 500 })
    if (!vorhanden) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })

    const { error: versionErr } = await supabase
      .from('offer_versions')
      .delete()
      .eq('offer_id', id)
      .eq('user_id', user.id)
    if (versionErr) {
      // Supabase wirft nicht — ohne diese Pruefung bliebe ein Fehlschlag unbemerkt
      // und das Projekt waere weg, die Versionen nicht.
      return NextResponse.json({ error: `Versionen: ${versionErr.message}` }, { status: 500 })
    }

    const { error } = await supabase
      .from('projects')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Fehler' }, { status: 500 })
  }
}
