// POST   /api/team/[id]  — Einladung erneut senden (neuer Token, alter Link tot)
// DELETE /api/team/[id]  — Mitglied entfernen bzw. offene Einladung zurückziehen
//
// Beides nur der Inhaber (Spec §5). Die `id` ist die Zeilen-ID aus
// betrieb_mitglieder; jede Abfrage trägt zusätzlich `inhaber_id = kontoId`, damit
// eine geratene ID nie ein fremdes Team anfasst — die RLS-Policy „inhaber ändert
// team" ist die zweite Verteidigungslinie, nicht die einzige.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { getSupabaseClient } from '@/lib/supabase'
import { kontoIdFuer, kontoGesperrt } from '@/lib/kontoserver'
import { TEAM_TEXTE } from '@/lib/team'
import { pruefeZugang } from '@/lib/planpruefung'
import { ladeBetriebName, schickeEinladung } from '../gemeinsam'

type Zeile = { id: string; email: string; status: string }
type Kunde = Awaited<ReturnType<typeof createClient>>
type Tor =
  | { antwort: NextResponse }
  | { antwort: null; supabase: Kunde; user: { email?: string }; kontoId: string; zeile: Zeile }

/** Angemeldet, Inhaber, Zeile gehört zu diesem Betrieb — sonst eine fertige Antwort. */
async function inhaberUndZeile(id: string): Promise<Tor> {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return { antwort: NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 }) }

  const konto = await kontoIdFuer(supabase, user)
  const sperre = kontoGesperrt(konto)
  if (sperre) return { antwort: sperre }
  if (!konto.istInhaber) return { antwort: NextResponse.json({ error: TEAM_TEXTE.nurInhaber }, { status: 403 }) }

  const { data, error } = await supabase
    .from('betrieb_mitglieder')
    .select('id, email, status')
    .eq('id', id)
    .eq('inhaber_id', konto.kontoId)
    .maybeSingle()
  if (error) {
    console.error('[team/[id]] Zeile laden:', error.message)
    return { antwort: NextResponse.json({ error: 'Das Mitglied ist gerade nicht abrufbar.' }, { status: 500 }) }
  }
  if (!data) return { antwort: NextResponse.json({ error: 'Dieses Teammitglied gibt es nicht.' }, { status: 404 }) }

  return { antwort: null, supabase, user, kontoId: konto.kontoId, zeile: data as Zeile }
}

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const t = await inhaberUndZeile(id)
  if (t.antwort) return t.antwort
  const { supabase, user, kontoId, zeile } = t

  // Erneut senden gibt es nur für offene Einladungen. Ein aktives Mitglied hat
  // seinen Zugang schon — ein neuer Link würde ihn nur verwirren.
  if (zeile.status !== 'eingeladen') {
    return NextResponse.json({ error: 'Diese Einladung ist bereits angenommen.' }, { status: 400 })
  }
  const zu = await pruefeZugang(supabase, kontoId)
  if (zu) return zu

  // Neuer Token bei jedem Senden: Sonst lebt der alte Link weiter, obwohl der
  // Inhaber denkt, er habe die Einladung „erneuert".
  const { data, error } = await supabase
    .from('betrieb_mitglieder')
    .update({ token: crypto.randomUUID(), eingeladen_am: new Date().toISOString() })
    .eq('id', zeile.id)
    .eq('inhaber_id', kontoId)
    .select('id, token')
    .single()
  if (error || !data) {
    console.error('[team/[id]] Token erneuern:', error?.message)
    return NextResponse.json({ error: 'Die Einladung konnte nicht erneuert werden.' }, { status: 500 })
  }

  const versand = await schickeEinladung({
    an: zeile.email,
    betriebName: await ladeBetriebName(supabase, kontoId),
    einladerEmail: user.email ?? '',
    token: data.token as string,
  })
  if (!versand.ok) {
    console.error('[team/[id]] Mailversand:', versand.error)
    return NextResponse.json({ error: `Die E-Mail ging nicht raus: ${versand.error}`, id: zeile.id }, { status: 502 })
  }

  return NextResponse.json({ ok: true, id: zeile.id })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const t = await inhaberUndZeile(id)
  if (t.antwort) return t.antwort
  const { supabase, kontoId, zeile } = t

  // BEWUSST KEIN pruefeZugang: Entfernen muss auch im gesperrten Betrieb gehen —
  // es ist der Weg, wieder unter den Nutzer-Deckel zu kommen.

  if (zeile.status === 'eingeladen') {
    // Eine nie angenommene Einladung ist keine Historie, sondern ein Tippfehler
    // oder ein Sinneswandel — die Zeile verschwindet, damit `unique (inhaber_id,
    // email)` eine neue Einladung an dieselbe Adresse nicht blockiert.
    //
    // Über die Service-Role, weil es für `authenticated` bewusst keine
    // delete-Policy gibt (Mitglieder werden nie gelöscht, nur entfernt). Die
    // Herkunft der Zeile ist oben mit `inhaber_id = kontoId` geprüft.
    const { error } = await getSupabaseClient()
      .from('betrieb_mitglieder')
      .delete()
      .eq('id', zeile.id)
      .eq('inhaber_id', kontoId)
      .eq('status', 'eingeladen')
    if (error) {
      console.error('[team/[id]] Einladung löschen:', error.message)
      return NextResponse.json({ error: 'Die Einladung konnte nicht zurückgezogen werden.' }, { status: 500 })
    }
    return NextResponse.json({ ok: true, ergebnis: 'zurueckgezogen' })
  }

  // Aktives Mitglied: Zeile bleibt für die Historie stehen (Plan-Constraint
  // „Nichts wird gelöscht"), nur der Zugang ist weg. `user_id` bleibt gesetzt —
  // daran erkennt `ermittleKonto` den Zustand 'entfernt' und zeigt die Sperrseite.
  const { error } = await supabase
    .from('betrieb_mitglieder')
    .update({ status: 'entfernt' })
    .eq('id', zeile.id)
    .eq('inhaber_id', kontoId)
  if (error) {
    console.error('[team/[id]] Mitglied entfernen:', error.message)
    return NextResponse.json({ error: 'Das Mitglied konnte nicht entfernt werden.' }, { status: 500 })
  }
  return NextResponse.json({ ok: true, ergebnis: 'entfernt' })
}
