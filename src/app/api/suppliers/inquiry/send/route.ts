import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import nodemailer from 'nodemailer'
import { kontoIdFuer, kontoGesperrt } from '@/lib/kontoserver'
import { pruefeFunktion } from '@/lib/planpruefung'
import { entschluessele } from '@/lib/geheimnis'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })
  const konto = await kontoIdFuer(supabase, user)
  const kontoSperre = kontoGesperrt(konto); if (kontoSperre) return kontoSperre
  const kontoId = konto.kontoId
  const sperre = await pruefeFunktion(supabase, kontoId, 'lieferanten')
  if (sperre) return sperre
  // Versand läuft ausschließlich über die eigene SMTP-Konfiguration des Betriebs
  // (kein CraftFlow-eigener Versandweg hier) — das ist ab Pro (Funktion 'smtp').
  const smtpSperre = await pruefeFunktion(supabase, kontoId, 'smtp')
  if (smtpSperre) return smtpSperre

  // SMTP-Konfiguration laden
  const { data: emailCfg } = await supabase
    .from('email_config')
    .select('smtp_host, smtp_port, smtp_user, smtp_password_encrypted, smtp_from_email, smtp_from_name, email_signatur, smtp_verified')
    .eq('user_id', kontoId)
    .single()

  if (!emailCfg?.smtp_host || !emailCfg?.smtp_user || !emailCfg?.smtp_from_email) {
    return NextResponse.json({
      error: 'SMTP nicht konfiguriert. Bitte in Einstellungen → E-Mail & Versand einrichten.',
    }, { status: 400 })
  }

  if (!emailCfg.smtp_verified) {
    return NextResponse.json({
      error: 'SMTP-Verbindung nicht verifiziert. Bitte erst Verbindung testen.',
    }, { status: 400 })
  }

  const { to, subject, body } = await req.json() as {
    to: string
    subject: string
    body: string
  }

  if (!to || !subject || !body) {
    return NextResponse.json({ error: 'Empfänger, Betreff und Text erforderlich' }, { status: 400 })
  }

  const signatur = emailCfg.email_signatur
    ? `\n\n--\n${emailCfg.email_signatur}`
    : ''

  try {
    const transporter = nodemailer.createTransport({
      host: emailCfg.smtp_host,
      port: Number(emailCfg.smtp_port) || 587,
      secure: Number(emailCfg.smtp_port) === 465,
      auth: {
        user: emailCfg.smtp_user,
        // Entschlüsselt (19.09.2026). Altbestand im Klartext kommt unverändert
        // zurück, damit der Versand nicht stillsteht — siehe src/lib/geheimnis.ts.
        pass: entschluessele(emailCfg.smtp_password_encrypted as string | null),
      },
    })

    await transporter.sendMail({
      from: `"${emailCfg.smtp_from_name || 'CraftFlow'}" <${emailCfg.smtp_from_email}>`,
      to,
      subject,
      text: body + signatur,
    })

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unbekannter Fehler'
    console.error('[inquiry/send] SMTP error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
