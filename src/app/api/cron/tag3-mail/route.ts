// Tag-3-Mail (Fabian 2026-09-17): einmal täglich von Vercel aufgerufen (vercel.json
// → crons, 08:00 UTC = 10:00 Sommerzeit, 09:00 Winterzeit — Fabian: „immer um 10 Uhr vormittags“), schickt jedem fälligen Konto GENAU EINE
// persönliche Nachfrage-Mail und setzt danach den Merker am Konto (app_metadata),
// wie bei der Willkommens-Mail. Regeln in src/lib/mail/tag3.ts (tag3Faellig).
//
// Zugang: Vercel schickt `Authorization: Bearer <CRON_SECRET>`; zusätzlich darf der
// Admin (Cookie-Sitzung) die Route von Hand aufrufen — mit `?vorschau=1` (zeigt die
// Mail als HTML) oder `?sofort=<email>` (schickt an genau diese Adresse, auch wenn sie
// noch keine drei Tage alt ist — Fabian: die zwei neuen Nutzer sollen sie direkt
// bekommen) oder `?test=<email>` (Testversand ohne Merker). Ohne alles: 401. Die Route steht in PUBLIC_PATHS der Middleware, sonst
// käme für Vercel eine 307 auf /login zurück (derselbe Fehler wie beim Stripe-Webhook).

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { getSupabaseClient } from '@/lib/supabase'
import { istAdmin } from '@/lib/admin'
import { sendeMail } from '@/lib/mail/resend'
import { tag3Faellig, tag3Mail, TAG3_MERKER } from '@/lib/mail/tag3'

export const maxDuration = 60

async function zugang(req: NextRequest): Promise<'cron' | 'admin' | null> {
  const secret = process.env.CRON_SECRET
  const auth = req.headers.get('authorization') ?? ''
  if (secret && auth === `Bearer ${secret}`) return 'cron'
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user && istAdmin(user.email)) return 'admin'
  return null
}

const maskiere = (e: string) => e.replace(/^(.).*(@.*)$/, '$1***$2')

export async function GET(req: NextRequest) {
  const wer = await zugang(req)
  if (!wer) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 401 })
  const sp = req.nextUrl.searchParams

  if (wer === 'admin' && sp.get('vorschau')) {
    return new NextResponse(tag3Mail({ inhaber: 'Max Mustermann', firma: 'Schreinerei Muster' }).html,
      { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
  }
  // Testversand an eine beliebige Adresse (Fabian: „Schicke die Mail bitte erst nochmal
  // an mich“) — nur Admin, kein Merker, Beispielname.
  const test = wer === 'admin' ? (sp.get('test') ?? '').trim().toLowerCase() : ''
  if (test) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(test)) return NextResponse.json({ error: 'Adresse ungültig' }, { status: 400 })
    const ergebnis = await sendeMail(test, tag3Mail({ inhaber: 'Fabian Scharf', firma: 'FS Crafted' }))
    return NextResponse.json(ergebnis.ok ? { ok: true, test: maskiere(test) } : { error: ergebnis.error }, { status: ergebnis.ok ? 200 : 502 })
  }
  const sofort = wer === 'admin' ? (sp.get('sofort') ?? '').trim().toLowerCase() : ''

  const admin = getSupabaseClient()
  const jetzt = new Date()
  const gesendet: string[] = []
  const fehler: string[] = []
  let uebersprungen = 0

  for (let page = 1; page <= 50; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    for (const u of data.users) {
      const meta = (u.app_metadata ?? {}) as Record<string, unknown>
      const email = (u.email ?? '').toLowerCase()
      if (istAdmin(email)) continue
      const istSofort = sofort !== '' && email === sofort
      if (sofort && !istSofort) continue
      const f = tag3Faellig({ created_at: u.created_at, email_confirmed_at: u.email_confirmed_at, email: u.email, meta },
        jetzt, istSofort ? 0 : undefined)
      if (!f.faellig) { uebersprungen++; if (istSofort) fehler.push(`${maskiere(email)}: ${f.grund}`); continue }

      const { data: profil } = await admin.from('betriebsprofil').select('inhaber, firma_name').eq('user_id', u.id).maybeSingle()
      const ergebnis = await sendeMail(email, tag3Mail({ inhaber: profil?.inhaber, firma: profil?.firma_name }))
      if (!ergebnis.ok) { fehler.push(`${maskiere(email)}: ${ergebnis.error}`); continue }
      // Erst NACH dem Versand markieren — ein Fehlversuch darf die Mail nicht für immer verhindern.
      const { error: mErr } = await admin.auth.admin.updateUserById(u.id, { app_metadata: { ...meta, [TAG3_MERKER]: jetzt.toISOString() } })
      if (mErr) console.error('[tag3-mail] Markierung fehlgeschlagen', u.id, mErr.message)
      gesendet.push(maskiere(email))
    }
    if (data.users.length < 200) break
  }
  return NextResponse.json({ ok: true, wer, gesendet, uebersprungen, fehler })
}
