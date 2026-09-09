import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { getSupabaseClient } from '@/lib/supabase'
import { RUNDSCHREIBEN, rundschreibenFinden, merkerName, willkommensMail } from '@/lib/mail/vorlagen'
import { sendeMail, mailAbsender } from '@/lib/mail/resend'

/**
 * Rundschreiben an Bestandsnutzer — Liste, Vorschau, Test, Probelauf, Versand.
 *
 * Nur für den Admin, bedient über Einstellungen → Admin. Die Mails selbst stehen
 * im Register am Ende von src/lib/mail/vorlagen.ts; diese Route weiß nichts über Inhalte.
 *
 *   GET                              Liste aller Rundschreiben mit Versandstand
 *   GET ?kennung=…&vorschau=1        die fertige Mail als HTML (für die Vorschau in der App)
 *   GET ?system=willkommen&vorschau=1  dasselbe für die automatische Willkommens-Mail
 *   POST { kennung, modus }          modus: "probelauf" | "test" | "senden" (+ bestaetigung: "SENDEN")
 *   POST { kennung: "system:willkommen", modus: "test" }  Willkommens-Mail an den Admin
 *
 * Wer ein Rundschreiben bekommen hat, trägt den Merker `rundschreiben_<kennung>` in
 * den app_metadata. Ein zweiter Lauf trifft nur noch, wer beim ersten fehlte.
 * Empfänger sind alle Konten mit bestätigter E-Mail.
 */
export const maxDuration = 300

const ADMIN_EMAIL = 'l.m.p.1@gmx.de'

type Konto = { id: string; email: string; meta: Record<string, unknown> }

async function guard() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user || user.email !== ADMIN_EMAIL) return null
  return user
}

async function alleKonten(): Promise<{ konten: Konto[]; unbestaetigt: number }> {
  const admin = getSupabaseClient()
  const konten: Konto[] = []
  let unbestaetigt = 0
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw new Error(error.message)
    for (const u of data.users) {
      if (!u.email) continue
      if (!u.email_confirmed_at) { unbestaetigt++; continue }
      konten.push({ id: u.id, email: u.email, meta: (u.app_metadata ?? {}) as Record<string, unknown> })
    }
    if (data.users.length < 200) break
  }
  return { konten, unbestaetigt }
}

export async function GET(req: NextRequest) {
  const user = await guard()
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  if (req.nextUrl.searchParams.get('system') === 'willkommen' && req.nextUrl.searchParams.get('vorschau')) {
    return new NextResponse(willkommensMail({ firma: 'Schreinerei Muster' }).html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
  }
  const kennung = req.nextUrl.searchParams.get('kennung')
  if (kennung && req.nextUrl.searchParams.get('vorschau')) {
    const r = rundschreibenFinden(kennung)
    if (!r) return NextResponse.json({ error: 'Unbekanntes Rundschreiben' }, { status: 404 })
    return new NextResponse(r.mail().html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
  }

  let stand: Awaited<ReturnType<typeof alleKonten>>
  try { stand = await alleKonten() } catch (e) {
    return NextResponse.json({ error: `Konten konnten nicht geladen werden: ${e instanceof Error ? e.message : e}` }, { status: 500 })
  }
  const liste = RUNDSCHREIBEN.map(r => {
    const merker = merkerName(r.kennung)
    const versandt = stand.konten.filter(k => k.meta[merker]).map(k => String(k.meta[merker]))
    return {
      kennung: r.kennung, titel: r.titel, erstellt: r.erstellt, betreff: r.mail().subject,
      gesendet: versandt.length, offen: stand.konten.length - versandt.length,
      zuletzt: versandt.sort().at(-1) ?? null,
    }
  })
  return NextResponse.json({ rundschreiben: liste, konten: stand.konten.length, unbestaetigt: stand.unbestaetigt, absender: mailAbsender() })
}

export async function POST(req: NextRequest) {
  const user = await guard()
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const body = await req.json().catch(() => ({})) as { kennung?: string; modus?: string; bestaetigung?: string }

  // Die Willkommens-Mail ist keine Rundschreiben — sie geht automatisch raus. Hier
  // nur der Testversand an den Admin, damit man sie vor dem Release sieht.
  if (body.kennung === 'system:willkommen') {
    if (body.modus !== 'test') return NextResponse.json({ ok: false, meldung: 'Die Willkommens-Mail wird nur automatisch verschickt — hier nur „Test an mich“.' }, { status: 400 })
    const e = await sendeMail(user.email!, willkommensMail({ firma: 'Schreinerei Muster' }))
    return NextResponse.json(e.ok
      ? { ok: true, meldung: `Willkommens-Mail als Test an ${user.email} verschickt (Absender: ${mailAbsender()}).` }
      : { ok: false, meldung: `Testmail fehlgeschlagen: ${e.error}` })
  }

  const r = body.kennung ? rundschreibenFinden(body.kennung) : undefined
  if (!r) return NextResponse.json({ ok: false, meldung: 'Unbekanntes Rundschreiben.' }, { status: 400 })
  const modus = body.modus ?? 'probelauf'
  const mail = r.mail()
  const merker = merkerName(r.kennung)

  if (modus === 'test') {
    const e = await sendeMail(user.email!, mail)
    return NextResponse.json(e.ok
      ? { ok: true, meldung: `Testmail an ${user.email} verschickt (Absender: ${mailAbsender()}).` }
      : { ok: false, meldung: `Testmail fehlgeschlagen: ${e.error}` })
  }

  let stand: Awaited<ReturnType<typeof alleKonten>>
  try { stand = await alleKonten() } catch (e) {
    return NextResponse.json({ ok: false, meldung: `Konten konnten nicht geladen werden: ${e instanceof Error ? e.message : e}` })
  }
  const offen = stand.konten.filter(k => !k.meta[merker])
  const bereits = stand.konten.length - offen.length

  if (modus === 'probelauf') {
    return NextResponse.json({
      ok: true,
      meldung: `${offen.length} Empfänger würden „${r.titel}“ bekommen. Übersprungen: ${bereits} bereits versorgt, ${stand.unbestaetigt} unbestätigt.`,
      empfaenger: offen.map(k => k.email).sort(), absender: mailAbsender(), betreff: mail.subject,
    })
  }

  if (modus === 'senden') {
    if (body.bestaetigung !== 'SENDEN') return NextResponse.json({ ok: false, meldung: 'Bestätigung fehlt — Feld muss genau SENDEN enthalten.' }, { status: 400 })
    const admin = getSupabaseClient()
    const fehler: string[] = []
    let gesendet = 0
    for (const k of offen) {
      const e = await sendeMail(k.email, mail)
      if (!e.ok) { fehler.push(`${k.email}: ${e.error}`); continue }
      gesendet++
      // Erst nach erfolgreichem Versand markieren — sonst würde ein Fehlversuch die
      // Mail für immer verhindern.
      await admin.auth.admin.updateUserById(k.id, { app_metadata: { ...k.meta, [merker]: new Date().toISOString() } })
        .catch(err => fehler.push(`${k.email}: gesendet, aber Markierung fehlgeschlagen (${err?.message ?? err})`))
      // Resend erlaubt 2 Anfragen pro Sekunde.
      await new Promise(res => setTimeout(res, 600))
    }
    return NextResponse.json({
      ok: fehler.length === 0,
      meldung: `${gesendet} von ${offen.length} Mails verschickt.` + (fehler.length ? ` ${fehler.length} Fehler.` : ''),
      fehler,
    })
  }

  return NextResponse.json({ ok: false, meldung: `Unbekannter Modus: ${modus}` }, { status: 400 })
}
