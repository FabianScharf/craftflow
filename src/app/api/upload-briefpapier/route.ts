import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const form = await req.formData()
  const file = form.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'Keine Datei' }, { status: 400 })
  if (file.type !== 'application/pdf') return NextResponse.json({ error: 'Nur PDF erlaubt' }, { status: 400 })
  if (file.size > 10 * 1024 * 1024) return NextResponse.json({ error: 'Datei zu groß (max. 10 MB)' }, { status: 400 })

  const bytes = await file.arrayBuffer()
  const path = `${user.id}/briefpapier.pdf`

  const { error: upErr } = await supabase.storage
    .from('briefpapier')
    .upload(path, bytes, {
      contentType: 'application/pdf',
      upsert: true,
    })

  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })

  const { data: urlData } = supabase.storage.from('briefpapier').getPublicUrl(path)

  // URL mit Cache-Buster damit immer die neue Datei geladen wird
  const publicUrl = urlData.publicUrl + `?v=${Date.now()}`

  // In betriebsprofil speichern
  await supabase
    .from('betriebsprofil')
    .update({ pdf_briefpapier_url: publicUrl, updated_at: new Date().toISOString() })
    .eq('user_id', user.id)

  return NextResponse.json({ url: publicUrl })
}
