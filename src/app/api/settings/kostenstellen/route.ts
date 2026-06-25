import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const { data, error } = await supabase
    .from('kostenstellen')
    .select('id, code, bezeichnung, stundensatz, aktiv, gruppe, reihenfolge')
    .eq('user_id', user.id)
    .order('reihenfolge')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ kostenstellen: data ?? [] })
}

export async function PUT(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const { id, stundensatz } = await req.json() as { id: string; stundensatz: number }
  if (!id || stundensatz == null) return NextResponse.json({ error: 'id und stundensatz erforderlich' }, { status: 400 })

  const { error } = await supabase
    .from('kostenstellen')
    .update({ stundensatz, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
