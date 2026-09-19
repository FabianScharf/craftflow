import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { kontoIdFuer, kontoGesperrt } from '@/lib/kontoserver'
import { pruefeFunktion } from '@/lib/planpruefung'
import { verschluessele, schluesselVorhanden } from '@/lib/geheimnis'

const ALLOWED = [
  'reply_to_email', 'email_signatur',
  'smtp_host', 'smtp_port', 'smtp_user', 'smtp_password_encrypted',
  'smtp_from_name', 'smtp_from_email', 'smtp_verified', 'smtp_last_test_at',
]

export async function GET() {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })
  const konto = await kontoIdFuer(supabase, user)
  const sperre = kontoGesperrt(konto); if (sperre) return sperre
  const kontoId = konto.kontoId

  const { data, error } = await supabase
    .from('email_config')
    .select('id, reply_to_email, email_signatur, smtp_host, smtp_port, smtp_user, smtp_from_name, smtp_from_email, smtp_verified, smtp_last_test_at')
    .eq('user_id', kontoId)
    .single()

  if (error && error.code !== 'PGRST116') return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ config: data ?? null })
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })
  const konto = await kontoIdFuer(supabase, user)
  const sperre = kontoGesperrt(konto); if (sperre) return sperre
  const kontoId = konto.kontoId
  const funktionsSperre = await pruefeFunktion(supabase, kontoId, 'smtp')
  if (funktionsSperre) return funktionsSperre

  const body = await req.json() as Record<string, unknown>
  const patch: Record<string, unknown> = { user_id: kontoId, updated_at: new Date().toISOString() }
  for (const key of ALLOWED) {
    if (key in body) patch[key] = body[key]
  }

  // DAS PASSWORT WIRD VERSCHLÜSSELT GESPEICHERT (19.09.2026).
  //
  // Die Spalte hieß immer `smtp_password_encrypted`, verschlüsselt wurde aber
  // nie — der Wert ging unverändert in die Datenbank und von dort an
  // nodemailer. Wer Datenbankzugriff hatte, las die Mailpasswörter aller
  // Betriebe im Klartext.
  //
  // Ohne Schlüssel wird ABGELEHNT statt im Klartext gespeichert. Lieber eine
  // klare Fehlermeldung als ein Passwort, das ungeschützt liegt und dessen
  // Spaltenname etwas anderes behauptet.
  if ('smtp_password_encrypted' in patch) {
    const roh = String(patch.smtp_password_encrypted ?? '')
    if (!roh) {
      // Leeres Feld heißt „nicht ändern" — sonst löscht ein Speichern der
      // übrigen Felder das hinterlegte Passwort.
      delete patch.smtp_password_encrypted
    } else if (!schluesselVorhanden()) {
      console.error('[email-config] GEHEIMNIS_SCHLUESSEL fehlt — Passwort nicht gespeichert.')
      return NextResponse.json(
        { error: 'Das Passwort kann gerade nicht sicher gespeichert werden. Bitte melde dich bei fabian@fscrafted.de.' },
        { status: 503 },
      )
    } else {
      patch.smtp_password_encrypted = verschluessele(roh)
    }
  }

  const { error } = await supabase
    .from('email_config')
    .upsert(patch, { onConflict: 'user_id' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
