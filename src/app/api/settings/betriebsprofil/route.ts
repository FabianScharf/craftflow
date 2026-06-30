import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const { data, error } = await supabase
    .from('betriebsprofil')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (error && error.code !== 'PGRST116') {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ profil: data ?? null })
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const body = await req.json() as Record<string, unknown>
  const allowed = [
    'firma_name', 'firma_zusatz', 'inhaber', 'strasse', 'plz', 'ort',
    'telefon', 'email', 'website', 'ust_id', 'steuernummer',
    'iban', 'bic', 'bank_name',
    'farbe_primaer', 'farbe_akzent', 'logo_url',
    'angebotsnummer_prefix', 'angebotsnummer_naechste', 'angebot_gueltig_tage',
    'zahlungsziel_tage', 'angebot_einleitung', 'angebot_abschluss',
    'zahlungskonditionen_text', 'mwst_satz', 'onboarding_abgeschlossen',
    'anrede_vorlage', 'widerrufsbelehrung_text', 'agb_text',
    'pdf_layout', 'pdf_zeige_bic', 'pdf_zeige_telefon', 'pdf_zeige_website', 'pdf_hinweis',
    'pdf_zeige_massivholz', 'pdf_massivholz_text', 'pdf_zeige_unterschrift', 'pdf_unterschrift_text',
    'pdf_eigenes_briefpapier', 'pdf_briefpapier_url',
    'plan',
  ]
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const key of allowed) {
    if (key in body) patch[key] = body[key]
  }

  const { error } = await supabase
    .from('betriebsprofil')
    .update(patch)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
