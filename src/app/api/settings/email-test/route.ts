import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import nodemailer from 'nodemailer'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const { host, port, user: smtpUser, password, fromEmail, fromName } = await req.json() as {
    host: string; port: number; user: string; password?: string; fromEmail: string; fromName: string
  }

  if (!host || !smtpUser || !fromEmail) {
    return NextResponse.json({ success: false, error: 'Host, Benutzer und Absender-E-Mail erforderlich' }, { status: 400 })
  }

  let smtpPassword = password
  if (!smtpPassword) {
    const { data } = await supabase
      .from('email_config')
      .select('smtp_password_encrypted')
      .eq('user_id', user.id)
      .single()
    smtpPassword = (data?.smtp_password_encrypted as string | null) ?? ''
  }

  try {
    const transporter = nodemailer.createTransport({
      host,
      port: Number(port) || 587,
      secure: Number(port) === 465,
      auth: { user: smtpUser, pass: smtpPassword },
    })

    await transporter.verify()
    await transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to: user.email ?? fromEmail,
      subject: 'CraftFlow — SMTP-Test erfolgreich',
      text: 'Die SMTP-Konfiguration funktioniert. Diese Test-E-Mail wurde von CraftFlow versendet.',
    })

    await supabase
      .from('email_config')
      .upsert(
        { user_id: user.id, smtp_verified: true, smtp_last_test_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      )

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ success: false, error: msg })
  }
}
