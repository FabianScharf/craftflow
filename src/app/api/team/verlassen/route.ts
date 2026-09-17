// POST /api/team/verlassen — ein Mitarbeiter verlässt den Betrieb.
//
// BEWUSST OHNE kontoGesperrt: Wer ruhend ist (Plan verkleinert), sitzt auf der
// Sperrseite und hat dort genau zwei Knöpfe — „Eigenen Betrieb anlegen" (dieser
// Aufruf) und „Abmelden". Eine 403 an dieser Stelle wäre eine Falle ohne Ausweg.
//
// Über die Service-Role, weil die update-Policy nur dem Inhaber gehört. Die Zeile
// wird über `user_id = user.id` gefunden — es gibt keine Eingabe, mit der man
// eine fremde Mitgliedschaft treffen könnte.

import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { getSupabaseClient } from '@/lib/supabase'

export async function POST() {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  // Zeile bleibt stehen, nur der Zugang geht (Plan-Constraint „Nichts wird
  // gelöscht"). Danach ist der Nutzer wieder sein eigener Betrieb: `ermittleKonto`
  // findet keine aktive Mitgliedschaft mehr, nur eine entfernte — und die zählt
  // erst, wenn keine aktive existiert.
  const { data, error } = await getSupabaseClient()
    .from('betrieb_mitglieder')
    .update({ status: 'entfernt' })
    .eq('user_id', user.id)
    .eq('status', 'aktiv')
    .select('id, inhaber_id')
  if (error) {
    console.error('[team/verlassen] verlassen:', error.message)
    return NextResponse.json({ error: 'Der Betrieb konnte nicht verlassen werden.' }, { status: 500 })
  }
  if ((data ?? []).length === 0) {
    return NextResponse.json({ error: 'Du bist in keinem Betrieb Mitarbeiter.' }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}
