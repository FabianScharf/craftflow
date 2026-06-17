import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseClient } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const { name, street, zip, city } = await req.json() as {
      name: string
      street: string
      zip: string
      city: string
    }

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Name ist erforderlich' }, { status: 400 })
    }

    const supabase = getSupabaseClient()

    // Duplicate check: same name (case-insensitive) + same zip
    const { data: existing } = await supabase
      .from('customers')
      .select('id')
      .ilike('name', name.trim())
      .eq('zip', zip.trim() || '')
      .limit(1)

    if (existing?.length) {
      return NextResponse.json({ duplicate: true }, { status: 409 })
    }

    const { error } = await supabase.from('customers').insert({
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
