import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

    const { name, street, zip, city } = await req.json() as {
      name: string; street: string; zip: string; city: string
    }

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Name ist erforderlich' }, { status: 400 })
    }

    const { data: existing } = await supabase
      .from('customers')
      .select('id')
      .eq('user_id', user.id)
      .ilike('name', name.trim())
      .eq('zip', zip?.trim() || '')
      .limit(1)

    if (existing?.length) {
      return NextResponse.json({ duplicate: true }, { status: 409 })
    }

    const { error } = await supabase.from('customers').insert({
      user_id: user.id,
      name: name.trim(),
      street: street || null,
      zip: zip || null,
      city: city || null,
    })

    if (error) {
      console.error('[customers] insert error:', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Fehler' }, { status: 500 })
  }
}
