import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json() as { email?: string }
    if (!email) return NextResponse.json({ error: 'E-Mail fehlt' }, { status: 400 })

    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'RESEND_API_KEY nicht gesetzt' }, { status: 500 })

    const timestamp = new Date().toLocaleString('de-DE', { timeZone: 'Europe/Berlin' })

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'noreply@fscrafted.de',
        to: 'anfrage@fscrafted.de',
        subject: `Neuer CraftFlow Beta-Nutzer: ${email}`,
        text: `Ein neuer Nutzer hat sich registriert: ${email}\n\nZeit: ${timestamp}`,
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      return NextResponse.json({ error: err }, { status: 502 })
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Fehler' }, { status: 500 })
  }
}
