import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { getSupabaseClient } from '@/lib/supabase'
import { willkommensMail } from '@/lib/mail/vorlagen'
import { sendeMail } from '@/lib/mail/resend'

/**
 * Willkommens-Mail für neue Nutzer — einmalig, nach der E-Mail-Bestätigung.
 *
 * Wird vom Startbildschirm aufgerufen, solange die Erst-Anmeldung noch nicht
 * abgeschlossen ist. Ob die Mail schon raus ist, steht in den app_metadata des
 * Auth-Nutzers (`willkommensmail_am`) — kein neues Datenbankfeld, keine Migration.
 *
 * Zwei Sicherungen gegen falsche Empfänger:
 *  - Nur Konten, die NACH dem Start der Funktion angelegt wurden. Sonst bekäme
 *    jeder Bestandsnutzer beim nächsten Login eine „Willkommen“-Mail.
 *  - Nur bestätigte Adressen — an unbestätigte schickt man nichts.
 *
 * Der Fehlerfall ist immer 200 mit `gesendet: false`: Die Mail ist nett, der
 * Login ist wichtig. Nichts hier darf die App für den Nutzer stören.
 */
export const WILLKOMMEN_AB = '2026-09-09T00:00:00Z'

export async function POST() {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const meta = (user.app_metadata ?? {}) as Record<string, unknown>
  if (meta.willkommensmail_am) return NextResponse.json({ gesendet: false, grund: 'bereits gesendet' })
  if (!user.email || !user.email_confirmed_at) return NextResponse.json({ gesendet: false, grund: 'E-Mail nicht bestätigt' })
  if (new Date(user.created_at) < new Date(WILLKOMMEN_AB)) return NextResponse.json({ gesendet: false, grund: 'Bestandskonto' })

  // Firmenname für die Anrede — optional, ohne ihn bleibt die Anrede neutral.
  const { data: profil } = await supabase.from('betriebsprofil').select('firma_name').eq('user_id', user.id).maybeSingle()

  const ergebnis = await sendeMail(user.email, willkommensMail({ firma: profil?.firma_name }))
  if (!ergebnis.ok) {
    console.error('[mail/willkommen]', user.id, ergebnis.error)
    return NextResponse.json({ gesendet: false, grund: ergebnis.error })
  }

  // Erst NACH erfolgreichem Versand markieren — sonst würde ein Fehlversuch die
  // Mail für immer verhindern.
  try {
    const admin = getSupabaseClient()
    await admin.auth.admin.updateUserById(user.id, {
      app_metadata: { ...meta, willkommensmail_am: new Date().toISOString() },
    })
  } catch (e) {
    console.error('[mail/willkommen] Markierung fehlgeschlagen', user.id, e)
  }

  return NextResponse.json({ gesendet: true })
}
