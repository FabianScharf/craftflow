import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { pruefeZugang } from '@/lib/planpruefung'
import { kontoIdFuer, kontoGesperrt } from '@/lib/kontoserver'

export async function GET() {
  try {
    console.log('[projects] start GET')
    const supabase = await createClient()
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

    const konto = await kontoIdFuer(supabase, user)
    const sperre = kontoGesperrt(konto)
    if (sperre) return sperre

    const { data, error } = await supabase
      .from('projects')
      .select('id, title, status, updated_at, created_at')
      .eq('user_id', konto.kontoId)
      .order('updated_at', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (e) {
    console.error('[projects] error GET:', e)
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Fehler' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    console.log('[projects] start POST')
    const supabase = await createClient()
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

    const konto = await kontoIdFuer(supabase, user)
    const sperre = kontoGesperrt(konto)
    if (sperre) return sperre
    const zu = await pruefeZugang(supabase, konto.kontoId)
    if (zu) return zu

    const body = await req.json()
    const { title, status = 'offen', data } = body as { title: string; status?: string; data: unknown }

    if (!title?.trim()) return NextResponse.json({ error: 'Titel fehlt' }, { status: 400 })
    if (!data) return NextResponse.json({ error: 'Daten fehlen' }, { status: 400 })

    const { data: row, error } = await supabase
      .from('projects')
      .insert({ user_id: konto.kontoId, title: title.trim(), status, data })
      .select('id, title, status, updated_at')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(row, { status: 201 })
  } catch (e) {
    console.error('[projects] error POST:', e)
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Fehler' }, { status: 500 })
  }
}
