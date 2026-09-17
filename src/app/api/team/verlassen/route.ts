// POST /api/team/verlassen — ein Mitarbeiter verlässt den Betrieb.
//
// BEWUSST OHNE kontoGesperrt: Wer ruhend ist (Plan verkleinert), sitzt auf der
// Sperrseite und hat dort genau zwei Knöpfe — „Eigenen Betrieb anlegen" (dieser
// Aufruf) und „Abmelden". Eine 403 an dieser Stelle wäre eine Falle ohne Ausweg.
//
// Über die Service-Role, weil die update-Policy nur dem Inhaber gehört. Die Zeile
// wird über `user_id = user.id` gefunden — es gibt keine Eingabe, mit der man
// eine fremde Mitgliedschaft treffen könnte.
//
// DREI AUSGANGSLAGEN, EIN ERGEBNIS (Controller-Ergänzung aus Task 4, 17.09.):
//   · aktives Mitglied  → verlässt den Betrieb
//   · ruhendes Mitglied → in der Datenbank ebenfalls `status='aktiv'`, fällt also
//     in denselben Fall
//   · schon entferntes  → hier ist nichts mehr zu ändern, die Antwort ist
//     trotzdem `{ ok: true }` (idempotent): Der Knopf auf der Sperrseite darf
//     beim zweiten Druck nicht mit einem Fehler antworten.
//
// WARUM `user_id = null` UND NICHT NUR `status='entfernt'`: `ermittleKonto`
// (src/lib/konto.ts) erkennt ein entferntes Mitglied genau an `status='entfernt'
// && user_id = userId` und zeigt dafür die Sperrseite. Bliebe die `user_id`
// stehen, wäre der Nutzer nach dem Verlassen weiter gesperrt — die Sperrseite
// würde sich selbst wieder aufrufen. Mit gelöster `user_id` findet
// `ermittleKonto` keine Zeile mehr und liefert `zustand: 'inhaber'`: Der Nutzer
// arbeitet als eigener Betrieb weiter, so wie /settings es danach erwartet.
//
// Die Zeile selbst bleibt stehen (Plan-Constraint „Nichts wird gelöscht") und
// trägt weiter Betrieb, Adresse und Daten — nur die Verbindung zum Login ist
// gelöst. Das ist genau der Unterschied zwischen „der Inhaber hat mich entfernt"
// (Zeile behält die user_id, Sperrseite) und „ich gehe selbst" (Zeile löst sich).

import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { getSupabaseClient } from '@/lib/supabase'

export async function POST() {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  // `in('status', …)` nimmt beide Fälle mit: das aktive (oder ruhende) Mitglied
  // UND eine schon entfernte Zeile, deren `user_id` noch am Login hängt.
  const { data, error } = await getSupabaseClient()
    .from('betrieb_mitglieder')
    .update({ status: 'entfernt', user_id: null })
    .eq('user_id', user.id)
    .in('status', ['aktiv', 'entfernt'])
    .select('id')
  if (error) {
    console.error('[team/verlassen] verlassen:', error.message)
    return NextResponse.json({ error: 'Der Betrieb konnte nicht verlassen werden.' }, { status: 500 })
  }

  // Auch „nichts zu tun" ist Erfolg: Der Nutzer ist danach in jedem Fall sein
  // eigener Betrieb, und genau darauf verlässt sich die Sperrseite.
  return NextResponse.json({ ok: true, geloest: (data ?? []).length })
}
