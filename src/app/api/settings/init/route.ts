import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function POST() {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const { error } = await supabase.rpc('init_betriebsprofil', { p_user_id: user.id })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
