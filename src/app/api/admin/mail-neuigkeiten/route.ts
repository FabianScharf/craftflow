import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { getSupabaseClient } from '@/lib/supabase'
import { neuigkeitenMail, NEUIGKEITEN_KENNUNG } from '@/lib/mail/vorlagen'
import { sendeMail, mailAbsender } from '@/lib/mail/resend'

/**
 * Einmalige „Was ist neu“-Mail an alle Bestandsnutzer (September 2026).
 *
 * Nur für den Admin, bedient über Einstellungen → Admin. Drei Stufen, damit
 * niemand versehentlich an alle schickt:
 *   modus "probelauf" — zählt und listet die Empfänger, verschickt nichts
 *   modus "test"      — schickt die Mail nur an den Admin selbst
 *   modus "senden"    — schickt an alle, braucht zusätzlich bestaetigung: "SENDEN"
 *
 * Wer die Mail bekommen hat, wird in den app_metadata markiert (Kennung mit
 * Monat). Ein zweiter Lauf trifft deshalb nur noch, wer beim ersten fehlte —
 * ein Abbruch in der Mitte lässt sich so gefahrlos wiederholen.
 *
 * Empfänger: alle Konten mit bestätigter E-Mail. Unbestätigte Adressen haben die
 * App nie gesehen und sind nicht verifiziert — an die schicken wir nichts.
 */
export const maxDuration = 300

const ADMIN_EMAIL = 'l.m.p.1@gmx.de'

type Empfaenger = { id: string; email: string; meta: Record<string, unknown>; erstellt: string }

async function alleEmpfaenger(): Promise<{ liste: Empfaenger[]; unbestaetigt: number; bereits: number }> {
  const admin = getSupabaseClient()
  const liste: Empfaenger[] = []
  let unbestaetigt = 0, bereits = 0
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw new Error(error.message)
    for (const u of data.users) {
      if (!u.email) continue
      if (!u.email_confirmed_at) { unbestaetigt++; continue }
      const meta = (u.app_metadata ?? {}) as Record<string, unknown>
      if (meta[NEUIGKEITEN_KENNUNG]) { bereits++; continue }
      liste.push({ id: u.id, email: u.email, meta, erstellt: u.created_at })
    }
    if (data.users.length < 200) break
  }
  return { liste, unbestaetigt, bereits }
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user || user.email !== ADMIN_EMAIL) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const body = await req.json().catch(() => ({})) as { modus?: string; bestaetigung?: string }
  const modus = body.modus ?? 'probelauf'
  const mail = neuigkeitenMail()

  if (modus === 'test') {
    const r = await sendeMail(user.email, mail)
    return NextResponse.json(r.ok
      ? { ok: true, meldung: `Testmail an ${user.email} verschickt (Absender: ${mailAbsender()}).` }
      : { ok: false, meldung: `Testmail fehlgeschlagen: ${r.error}` })
  }

  let empf: Awaited<ReturnType<typeof alleEmpfaenger>>
  try { empf = await alleEmpfaenger() } catch (e) {
    return NextResponse.json({ ok: false, meldung: `Empfänger konnten nicht geladen werden: ${e instanceof Error ? e.message : e}` })
  }

  if (modus === 'probelauf') {
    return NextResponse.json({
      ok: true,
      meldung: `${empf.liste.length} Empfänger würden die Mail bekommen. Übersprungen: ${empf.bereits} bereits versorgt, ${empf.unbestaetigt} unbestätigt.`,
      empfaenger: empf.liste.map(e => e.email).sort(),
      absender: mailAbsender(),
      betreff: mail.subject,
    })
  }

  if (modus === 'senden') {
    if (body.bestaetigung !== 'SENDEN') return NextResponse.json({ ok: false, meldung: 'Bestätigung fehlt — Feld muss genau SENDEN enthalten.' }, { status: 400 })
    const admin = getSupabaseClient()
    const fehler: string[] = []
    let gesendet = 0
    for (const e of empf.liste) {
      const r = await sendeMail(e.email, mail)
      if (!r.ok) { fehler.push(`${e.email}: ${r.error}`); continue }
      gesendet++
      await admin.auth.admin.updateUserById(e.id, { app_metadata: { ...e.meta, [NEUIGKEITEN_KENNUNG]: new Date().toISOString() } })
        .catch(err => fehler.push(`${e.email}: gesendet, aber Markierung fehlgeschlagen (${err?.message ?? err})`))
      // Resend erlaubt 2 Anfragen pro Sekunde.
      await new Promise(r => setTimeout(r, 600))
    }
    return NextResponse.json({
      ok: fehler.length === 0,
      meldung: `${gesendet} von ${empf.liste.length} Mails verschickt.` + (fehler.length ? ` ${fehler.length} Fehler.` : ''),
      fehler,
    })
  }

  return NextResponse.json({ ok: false, meldung: `Unbekannter Modus: ${modus}` }, { status: 400 })
}
