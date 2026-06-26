import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const { suppliers } = await req.json() as { suppliers: Record<string, unknown>[] }
  if (!Array.isArray(suppliers) || suppliers.length === 0) {
    return NextResponse.json({ error: 'Keine Daten' }, { status: 400 })
  }

  const rows = suppliers.map(s => ({ ...s, user_id: user.id }))
  const { data, error } = await supabase.from('suppliers').insert(rows).select('id')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, count: data?.length ?? 0 })
}
