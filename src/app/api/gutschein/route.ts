import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const { code } = await req.json() as { code?: string }
  if (!code?.trim()) return NextResponse.json({ error: 'Kein Code angegeben' }, { status: 400 })

  const { data, error } = await supabase.rpc('redeem_coupon', { p_code: code.trim() })

  if (error) {
    console.error('[gutschein] rpc error:', error.message)
    return NextResponse.json({ error: 'Serverfehler beim Einlösen' }, { status: 500 })
  }

  const result = data as { ok: boolean; error?: string; plan?: string; code?: string }
  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? 'Ungültiger Code' }, { status: 400 })
  }

  return NextResponse.json({ ok: true, plan: result.plan })
}
