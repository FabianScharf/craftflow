import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

    const { searchParams } = req.nextUrl
    const offerId = searchParams.get('offerId')
    const versionId = searchParams.get('versionId')

    if (versionId) {
      const { data, error } = await supabase
        .from('offer_versions')
        .select('id, version_number, created_at, description, data')
        .eq('id', versionId)
        .eq('user_id', user.id)
        .single()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json(data)
    }

    if (!offerId) return NextResponse.json({ error: 'offerId oder versionId erforderlich' }, { status: 400 })

    const { data, error } = await supabase
      .from('offer_versions')
      .select('id, version_number, created_at, description')
      .eq('offer_id', offerId)
      .eq('user_id', user.id)
      .order('version_number', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ versions: data ?? [] })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unbekannter Fehler'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

    const { offerId, description, data } = await req.json() as {
      offerId: string; description: string; data: unknown
    }
    if (!offerId || !data) return NextResponse.json({ error: 'offerId und data erforderlich' }, { status: 400 })

    const { data: existing } = await supabase
      .from('offer_versions')
      .select('version_number')
      .eq('offer_id', offerId)
      .eq('user_id', user.id)
      .order('version_number', { ascending: false })
      .limit(1)

    const nextVersion = ((existing?.[0]?.version_number ?? 0) as number) + 1

    const { error } = await supabase
      .from('offer_versions')
      .insert({ user_id: user.id, offer_id: offerId, version_number: nextVersion, description: description ?? null, data })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true, version: nextVersion })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unbekannter Fehler'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
