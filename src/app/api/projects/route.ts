import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

    const { data, error } = await supabase
      .from('projects')
      .select('id, title, status, updated_at, created_at')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Fehler' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

    const body = await req.json()
    const { title, status = 'entwurf', data } = body as { title: string; status?: string; data: unknown }

    if (!title?.trim()) return NextResponse.json({ error: 'Titel fehlt' }, { status: 400 })
    if (!data) return NextResponse.json({ error: 'Daten fehlen' }, { status: 400 })

    const { data: row, error } = await supabase
      .from('projects')
      .insert({ user_id: user.id, title: title.trim(), status, data })
      .select('id, title, status, updated_at')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(row, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Fehler' }, { status: 500 })
  }
}
