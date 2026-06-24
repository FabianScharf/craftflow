import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'
import { createClient } from '@/utils/supabase/server'

function getGmailClient() {
  const clientId = process.env.GMAIL_CLIENT_ID
  const clientSecret = process.env.GMAIL_CLIENT_SECRET
  const refreshToken = process.env.GMAIL_REFRESH_TOKEN
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('Gmail-Konfiguration fehlt (GMAIL_CLIENT_ID / GMAIL_CLIENT_SECRET / GMAIL_REFRESH_TOKEN)')
  }
  const auth = new google.auth.OAuth2(clientId, clientSecret)
  auth.setCredentials({ refresh_token: refreshToken })
  return google.gmail({ version: 'v1', auth })
}

function fill(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`)
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

    const { supplierId, templateId, variables = {} } = await req.json() as {
      supplierId: string
      templateId?: string
      variables?: Record<string, string>
    }

    if (!supplierId) return NextResponse.json({ error: 'supplierId fehlt' }, { status: 400 })

    const { data: supplier, error: supplierErr } = await supabase
      .from('suppliers')
      .select('id, company_name, general_email')
      .eq('id', supplierId)
      .eq('user_id', user.id)
      .single()

    if (supplierErr || !supplier) {
      return NextResponse.json({ error: 'Lieferant nicht gefunden' }, { status: 404 })
    }

    const { data: contacts } = await supabase
      .from('supplier_contacts')
      .select('first_name, last_name, email, position')
      .eq('supplier_id', supplierId)
      .order('is_primary', { ascending: false })
      .limit(1)

    const contact = contacts?.[0] ?? null
    const toEmail = contact?.email ?? supplier.general_email

    if (!toEmail) {
      return NextResponse.json({ error: 'Kein E-Mail-Empfänger für diesen Lieferanten hinterlegt' }, { status: 400 })
    }

    const { data: template, error: templateErr } = templateId
      ? await supabase.from('email_templates').select('subject, body').eq('id', templateId).eq('user_id', user.id).single()
      : await supabase.from('email_templates').select('subject, body').eq('is_default', true).eq('user_id', user.id).single()

    if (templateErr || !template) {
      return NextResponse.json({ error: 'Kein E-Mail-Template gefunden' }, { status: 404 })
    }

    const contactName = contact ? `${contact.first_name} ${contact.last_name}`.trim() : ''
    const vars: Record<string, string> = {
      lieferant_name: supplier.company_name,
      ansprechpartner: contactName,
      ...variables,
    }

    const subject = fill(template.subject, vars)
    const body = fill(template.body, vars)

    const toHeader = contactName ? `"${contactName}" <${toEmail}>` : toEmail
    const encodedSubject = `=?utf-8?B?${Buffer.from(subject).toString('base64')}?=`

    const rawMessage = [
      `To: ${toHeader}`,
      `Subject: ${encodedSubject}`,
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset=utf-8',
      '',
      body,
    ].join('\r\n')

    const gmail = getGmailClient()
    const { data: draft } = await gmail.users.drafts.create({
      userId: 'me',
      requestBody: { message: { raw: Buffer.from(rawMessage).toString('base64url') } },
    })

    return NextResponse.json({ draftId: draft.id, to: toEmail, subject })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unbekannter Fehler'
    console.error('[draft] unhandled error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
