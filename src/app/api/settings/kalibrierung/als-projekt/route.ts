import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { today } from '@/lib/types'
import { pruefeZugang } from '@/lib/planpruefung'
import { REFERENZPROJEKTE, mitSaetzen, projektDatenAus } from '@/lib/referenzprojekte'

// Dieselbe Rechnung wie in ../route.ts (ladeSaetzeUndAufschlag) — bewusst hier
// noch einmal, statt aus route.ts zu exportieren: eine route.ts darf laut
// Next.js nur die HTTP-Methoden und die paar erkannten Konfig-Exporte
// (z. B. maxDuration) exportieren, alles andere gehoert in ein eigenes Modul.
// Stundensaetze und Materialaufschlag des Nutzers. Die Referenzkalkulation ist fuer
// jeden Betrieb eine andere Zahl, obwohl das Moebel dasselbe ist.
async function ladeSaetzeUndAufschlag(
  supabase: Awaited<ReturnType<typeof createClient>>, userId: string,
): Promise<{ saetze: Record<string, number>; aufschlag: number }> {
  const saetze: Record<string, number> = {}
  const { data: ks, error: ksErr } = await supabase
    .from('kostenstellen')
    .select('bezeichnung, stundensatz, aktiv')
    .eq('user_id', userId)
  if (ksErr) console.error('[kalibrierung/als-projekt] Kostenstellen:', ksErr.message)
  for (const k of ks ?? []) {
    if (k.aktiv === false) continue
    saetze[String(k.bezeichnung)] = Number(k.stundensatz)
  }

  const { data: mg, error: mgErr } = await supabase
    .from('materialgruppen')
    .select('aufschlag_prozent, aktiv')
    .eq('user_id', userId)
    .order('reihenfolge')
  if (mgErr) console.error('[kalibrierung/als-projekt] Materialgruppen:', mgErr.message)
  const erste = (mg ?? []).find(m => m.aktiv !== false)
  const aufschlag = erste ? Number(erste.aufschlag_prozent) / 100 : 0.30

  return { saetze, aufschlag: Number.isFinite(aufschlag) ? aufschlag : 0.30 }
}

/**
 * Legt EIN Referenzprojekt als echtes Projekt des Nutzers an — "Als Projekt öffnen"
 * in der Betriebskalibrierung. Gerechnet wird mit SEINEN Stundensaetzen und SEINEM
 * Materialaufschlag (wie GET in ../route.ts), damit die Zahlen im neuen Projekt zu
 * denen passen, die er in der Kalibrierung gerade gesehen hat.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const zu = await pruefeZugang(supabase, user.id)
  if (zu) return zu

  const b = await req.json().catch(() => ({})) as Record<string, unknown>
  const schluessel = String(b.schluessel ?? '')
  if (!Object.keys(REFERENZPROJEKTE).includes(schluessel)) {
    return NextResponse.json({ error: 'Unbekanntes Referenzprojekt.' }, { status: 400 })
  }
  const projekt = REFERENZPROJEKTE[schluessel as keyof typeof REFERENZPROJEKTE]

  const { saetze, aufschlag } = await ladeSaetzeUndAufschlag(supabase, user.id)
  const positionen = mitSaetzen(projekt, saetze, aufschlag)
  const data = projektDatenAus(projekt, positionen, today())

  const { data: row, error } = await supabase
    .from('projects')
    .insert({ user_id: user.id, title: `Referenz: ${projekt.name}`, status: 'offen', data })
    .select('id, title')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(row, { status: 201 })
}
