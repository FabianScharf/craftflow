import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const { data, error } = await supabase
    .from('kostenstellen')
    .select('id, code, bezeichnung, stundensatz, aktiv, gruppe, reihenfolge, ist_standard')
    .eq('user_id', user.id)
    .order('reihenfolge')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ kostenstellen: data ?? [] })
}

export async function PUT(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const body = await req.json() as { id: string; stundensatz?: number; aktiv?: boolean }
  const { id } = body
  if (!id) return NextResponse.json({ error: 'id erforderlich' }, { status: 400 })

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.stundensatz != null) patch.stundensatz = body.stundensatz
  if (body.aktiv != null) patch.aktiv = body.aktiv

  const { error } = await supabase
    .from('kostenstellen')
    .update(patch)
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const { code, bezeichnung, stundensatz, gruppe } = await req.json() as {
    code: string; bezeichnung: string; stundensatz: number; gruppe?: string
  }
  if (!code || !bezeichnung || stundensatz == null) {
    return NextResponse.json({ error: 'code, bezeichnung und stundensatz erforderlich' }, { status: 400 })
  }

  const { data: maxRow } = await supabase
    .from('kostenstellen').select('reihenfolge').eq('user_id', user.id).order('reihenfolge', { ascending: false }).limit(1).single()
  const reihenfolge = ((maxRow?.reihenfolge as number | null) ?? 0) + 1

  const { data, error } = await supabase
    .from('kostenstellen')
    .insert({ user_id: user.id, code, bezeichnung, stundensatz, gruppe: gruppe ?? null, reihenfolge, ist_standard: false })
    .select('id, code, bezeichnung, stundensatz, aktiv, gruppe, reihenfolge, ist_standard')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ kostenstelle: data })
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const { id } = await req.json() as { id: string }
  if (!id) return NextResponse.json({ error: 'id erforderlich' }, { status: 400 })

  const { error } = await supabase
    .from('kostenstellen')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)
    .eq('ist_standard', false)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
