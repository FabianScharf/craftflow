import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { pruefeFunktion } from '@/lib/planpruefung'

export async function GET(_req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

    // Lieferantenverwaltung ist ab Starter (Audit 2026-09-17, I3).
    const sperre = await pruefeFunktion(supabase, user.id, 'lieferanten')
    if (sperre) return sperre

    const { data, error } = await supabase
      .from('product_categories')
      .select('id, name')
      .eq('user_id', user.id)
      .order('name')

    if (error) throw error
    return NextResponse.json({ categories: data })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unbekannter Fehler'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
