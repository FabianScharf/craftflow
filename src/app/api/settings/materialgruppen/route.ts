import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const { data, error } = await supabase
    .from('materialgruppen')
    .select('id, name, aufschlag_prozent, beschreibung, reihenfolge, aktiv')
    .eq('user_id', user.id)
    .order('reihenfolge')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ materialgruppen: data ?? [] })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const { name, aufschlag_prozent } = await req.json() as { name: string; aufschlag_prozent: number }
  if (!name || aufschlag_prozent == null) {
    return NextResponse.json({ error: 'name und aufschlag_prozent erforderlich' }, { status: 400 })
  }

  const { data: maxRow } = await supabase
    .from('materialgruppen').select('reihenfolge').eq('user_id', user.id).order('reihenfolge', { ascending: false }).limit(1).single()
  const reihenfolge = ((maxRow?.reihenfolge as number | null) ?? 0) + 1

  const { data, error } = await supabase
    .from('materialgruppen')
    .insert({ user_id: user.id, name, aufschlag_prozent, reihenfolge })
    .select('id, name, aufschlag_prozent, beschreibung, reihenfolge, aktiv')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ materialgruppe: data })
}

export async function PUT(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const { id, name, aufschlag_prozent } = await req.json() as { id: string; name?: string; aufschlag_prozent?: number }
  if (!id) return NextResponse.json({ error: 'id erforderlich' }, { status: 400 })

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (name != null) patch.name = name
  if (aufschlag_prozent != null) patch.aufschlag_prozent = aufschlag_prozent

  const { error } = await supabase
    .from('materialgruppen')
    .update(patch)
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const { id } = await req.json() as { id: string }
  if (!id) return NextResponse.json({ error: 'id erforderlich' }, { status: 400 })

  const { error } = await supabase
    .from('materialgruppen')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
