import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

const ALLOWED = [
  'reply_to_email', 'email_signatur',
  'smtp_host', 'smtp_port', 'smtp_user', 'smtp_password_encrypted',
  'smtp_from_name', 'smtp_from_email', 'smtp_verified', 'smtp_last_test_at',
]

export async function GET() {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const { data, error } = await supabase
    .from('email_config')
    .select('id, reply_to_email, email_signatur, smtp_host, smtp_port, smtp_user, smtp_from_name, smtp_from_email, smtp_verified, smtp_last_test_at')
    .eq('user_id', user.id)
    .single()

  if (error && error.code !== 'PGRST116') return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ config: data ?? null })
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const body = await req.json() as Record<string, unknown>
  const patch: Record<string, unknown> = { user_id: user.id, updated_at: new Date().toISOString() }
  for (const key of ALLOWED) {
    if (key in body) patch[key] = body[key]
  }

  const { error } = await supabase
    .from('email_config')
    .upsert(patch, { onConflict: 'user_id' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
