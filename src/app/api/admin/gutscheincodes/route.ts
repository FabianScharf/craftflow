import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

const ADMIN_EMAIL = 'l.m.p.1@gmx.de'

async function guard() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user || user.email !== ADMIN_EMAIL) return { supabase: null, error: 'Kein Zugriff' }
  return { supabase, error: null }
}

export async function GET() {
  const { supabase, error } = await guard()
  if (!supabase) return NextResponse.json({ error }, { status: 403 })

  const { data, error: dbErr } = await supabase
    .from('gutscheincodes')
    .select('*')
    .order('created_at', { ascending: false })

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  return NextResponse.json({ codes: data ?? [] })
}

export async function POST(req: NextRequest) {
  const { supabase, error } = await guard()
  if (!supabase) return NextResponse.json({ error }, { status: 403 })

  const body = await req.json() as { code: string; plan?: string; max_uses?: number | null; valid_until?: string | null; beschreibung?: string }
  if (!body.code?.trim()) return NextResponse.json({ error: 'Code fehlt' }, { status: 400 })

  const { data, error: dbErr } = await supabase
    .from('gutscheincodes')
    .insert({
      code: body.code.trim(),
      plan: body.plan ?? 'enterprise',
      max_uses: body.max_uses ?? null,
      valid_until: body.valid_until ?? null,
      beschreibung: body.beschreibung ?? null,
    })
    .select()
    .single()

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  return NextResponse.json({ code: data })
}

export async function PATCH(req: NextRequest) {
  const { supabase, error } = await guard()
  if (!supabase) return NextResponse.json({ error }, { status: 403 })

  const body = await req.json() as { code: string; max_uses?: number | null; valid_until?: string | null; beschreibung?: string }
  if (!body.code) return NextResponse.json({ error: 'Code fehlt' }, { status: 400 })

  const patch: Record<string, unknown> = {}
  if ('max_uses' in body) patch.max_uses = body.max_uses
  if ('valid_until' in body) patch.valid_until = body.valid_until
  if ('beschreibung' in body) patch.beschreibung = body.beschreibung

  const { error: dbErr } = await supabase
    .from('gutscheincodes')
    .update(patch)
    .eq('code', body.code)

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const { supabase, error } = await guard()
  if (!supabase) return NextResponse.json({ error }, { status: 403 })

  const { code } = await req.json() as { code: string }
  if (!code) return NextResponse.json({ error: 'Code fehlt' }, { status: 400 })

  const { error: dbErr } = await supabase
    .from('gutscheincodes')
    .delete()
    .eq('code', code)

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
