import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export const maxDuration = 15

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

    const body = await req.json() as { consents: string[]; versions: Record<string, string> }
    const { consents, versions } = body

    const userAgent = req.headers.get('user-agent')?.slice(0, 200) ?? null
    // IP nur als 3-Oktet-Präfix (kein Personenbezug)
    const rawIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? ''
    const ipHint = rawIp.split('.').slice(0, 3).join('.') + '.x'

    const rows = consents.map(type => ({
      user_id:      user.id,
      consent_type: type,
      version:      versions[type] ?? 'unknown',
      user_agent:   userAgent,
      ip_hint:      ipHint,
    }))

    await supabase.from('consent_log').insert(rows)

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[consent]', e)
    return NextResponse.json({ error: 'Fehler beim Speichern' }, { status: 500 })
  }
}
