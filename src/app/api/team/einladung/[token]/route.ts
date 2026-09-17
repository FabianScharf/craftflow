// GET /api/team/einladung/[token] — was die ÖFFENTLICHE Einladungsseite anzeigen darf.
//
// Öffentlich (PUBLIC_PATHS in src/middleware.ts): Der Empfänger hat noch kein
// Konto, wenn er auf den Link klickt. Ohne diesen Eintrag käme eine 307 auf
// /login zurück, und die Seite bliebe leer (derselbe Fehler wie beim
// Stripe-Webhook am 16.09.).
//
// WAS HIER RAUSGEHT, IST BEWUSST KNAPP (Plan-Constraint: „Keine Nutzerdaten in
// öffentlichen Routen außer Firmenname des Einladers"): Firmenname, Status und
// die MASKIERTE Adresse (a***@b.de). Der Token liegt in einer Mail — er kann in
// falsche Hände geraten, und dann darf er keine Adresse verraten. Die Adresse
// des Einladers, die Teamgröße und der Plan stehen hier nicht.

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getSupabaseClient } from '@/lib/supabase'
import { maskiereEmail } from '@/lib/team'
import { istToken } from '../../gemeinsam'

const NICHT_GEFUNDEN = { error: 'Diese Einladung gibt es nicht mehr.' }

export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  // Formprüfung vor der Abfrage: Ein Nicht-uuid kann keine Einladung sein, und
  // eine uuid-Spalte mit Müll zu vergleichen liefert nur einen Datenbankfehler.
  if (!istToken(token)) return NextResponse.json(NICHT_GEFUNDEN, { status: 404 })

  // Service-Role: Der Aufrufer ist nicht angemeldet, RLS würde nichts zurückgeben.
  // Die Abfrage geht ausschließlich über den Token — es gibt keinen Weg, damit eine
  // andere Zeile zu erwischen (unique index auf token).
  const service = getSupabaseClient()
  const { data, error } = await service
    .from('betrieb_mitglieder')
    .select('inhaber_id, email, status')
    .eq('token', token)
    .maybeSingle()
  if (error) {
    console.error('[team/einladung] laden:', error.message)
    return NextResponse.json({ error: 'Die Einladung ist gerade nicht abrufbar.' }, { status: 500 })
  }
  // 'entfernt' = zurückgezogen. Dann verrät die Route auch den Firmennamen nicht
  // mehr — ein toter Link soll gar nichts erzählen.
  if (!data || data.status === 'entfernt') return NextResponse.json(NICHT_GEFUNDEN, { status: 404 })

  const { data: profil, error: pErr } = await service
    .from('betriebsprofil')
    .select('firma_name')
    .eq('user_id', data.inhaber_id as string)
    .maybeSingle()
  if (pErr) console.error('[team/einladung] Firmenname:', pErr.message)
  const name = ((profil?.firma_name ?? '') as string).trim()

  return NextResponse.json(
    {
      betriebName: name || null,
      email: maskiereEmail(data.email as string),
      status: data.status as string,
    },
    // Niemals zwischenspeichern: Die Antwort hängt am Token und ändert sich in der
    // Sekunde, in der die Einladung angenommen wird.
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
