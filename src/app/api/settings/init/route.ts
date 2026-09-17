import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { kontoIdFuer, kontoGesperrt } from '@/lib/kontoserver'

export async function POST() {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })
  const konto = await kontoIdFuer(supabase, user)
  const sperre = kontoGesperrt(konto); if (sperre) return sperre

  // Nur der Inhaber legt ein Betriebsprofil an — ein Mitarbeiter arbeitet auf dem
  // Profil des Inhabers und darf nie ein eigenes danebenlegen (Task 2a-Brief).
  if (!konto.istInhaber) return NextResponse.json({ ok: true })

  const { error } = await supabase.rpc('init_betriebsprofil', { p_user_id: konto.kontoId })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
