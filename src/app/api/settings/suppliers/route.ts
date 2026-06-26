import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

const SELECT = 'id, company_name, ansprechpartner, general_email, phone, website, lieferant_nr, kategorien, notes, aktiv, street, zip, city, created_at'

export async function GET() {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const { data, error } = await supabase
    .from('suppliers')
    .select(SELECT)
    .eq('user_id', user.id)
    .order('company_name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ suppliers: data ?? [] })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const body = await req.json() as Record<string, unknown>
  if (!body.company_name) return NextResponse.json({ error: 'company_name erforderlich' }, { status: 400 })

  const { data, error } = await supabase
    .from('suppliers')
    .insert({ ...body, user_id: user.id })
    .select(SELECT)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ supplier: data })
}

export async function PUT(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const { id, ...rest } = await req.json() as { id: string } & Record<string, unknown>
  if (!id) return NextResponse.json({ error: 'id erforderlich' }, { status: 400 })

  const { data, error } = await supabase
    .from('suppliers')
    .update({ ...rest, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', user.id)
    .select(SELECT)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ supplier: data })
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const { id } = await req.json() as { id: string }
  if (!id) return NextResponse.json({ error: 'id erforderlich' }, { status: 400 })

  const { error } = await supabase
    .from('suppliers')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
