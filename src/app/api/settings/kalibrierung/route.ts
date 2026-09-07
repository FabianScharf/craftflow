import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { berechneFaktoren, deckele } from '@/lib/kalibrierung'
import { ladeKalibrierung, speichereKalibrierung } from '@/lib/kalibrierungsspeicher'

export async function GET() {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })
  return NextResponse.json({ kalibrierung: await ladeKalibrierung(supabase, user.id) })
}

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
  if (ksErr) console.error('[kalibrierung] Kostenstellen:', ksErr.message)
  for (const k of ks ?? []) {
    if (k.aktiv === false) continue
    saetze[String(k.bezeichnung)] = Number(k.stundensatz)
  }

  const { data: mg, error: mgErr } = await supabase
    .from('materialgruppen')
    .select('aufschlag_prozent, aktiv')
    .eq('user_id', userId)
    .order('reihenfolge')
  if (mgErr) console.error('[kalibrierung] Materialgruppen:', mgErr.message)
  const erste = (mg ?? []).find(m => m.aktiv !== false)
  const aufschlag = erste ? Number(erste.aufschlag_prozent) / 100 : 0.30

  return { saetze, aufschlag: Number.isFinite(aufschlag) ? aufschlag : 0.30 }
}

export async function PUT(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const b = await req.json() as Record<string, unknown>
  const text = (k: string) => String(b[k] ?? '')

  const { saetze, aufschlag } = await ladeSaetzeUndAufschlag(supabase, user.id)

  const antworten = {
    grund:   text('antwort_grund'),
    lack:    text('antwort_lack'),
    massiv:  text('antwort_massiv'),
    montage: text('antwort_montage'),
  }
  // Die Faktoren entstehen IMMER serverseitig. Sie steuern Preise — was aus dem
  // Browser kommt, wird dafuer nie uebernommen. Gleiche Haltung wie bei vkStunde.
  const f = berechneFaktoren(antworten, saetze, aufschlag)

  // Ausnahme: ein von Hand gesetzter Faktor aus den Einstellungen. Er ueberschreibt
  // die Ableitung bewusst — steht so im Reiter "Mein Betrieb" — und wird gedeckelt.
  const vonHand = (k: string, standard: number) =>
    b[k] === undefined || b[k] === null || b[k] === '' ? standard : deckele(Number(b[k]))

  const r = await speichereKalibrierung(supabase, user.id, {
    mitarbeiter:     text('mitarbeiter'),
    maschinen:       Array.isArray(b.maschinen) ? (b.maschinen as unknown[]).map(String) : [],
    schwerpunkt:     Array.isArray(b.schwerpunkt) ? (b.schwerpunkt as unknown[]).map(String) : [],
    montage_selbst:  text('montage_selbst'),
    stueckzahlen:    text('stueckzahlen'),
    antwort_grund:   antworten.grund,
    antwort_lack:    antworten.lack,
    antwort_massiv:  antworten.massiv,
    antwort_montage: antworten.montage,
    faktor_werkstatt:   vonHand('faktor_werkstatt', f.werkstatt),
    faktor_oberflaeche: vonHand('faktor_oberflaeche', f.oberflaeche),
    faktor_massivholz:  vonHand('faktor_massivholz', f.massivholz),
    faktor_montage:     vonHand('faktor_montage', f.montage),
    abgeschlossen:   b.abgeschlossen === false ? false : true,
    hinweis_gezeigt: b.hinweis_gezeigt === true,
  })
  if (!r.ok) return NextResponse.json({ error: r.grund }, { status: 500 })
  return NextResponse.json({ ok: true, faktoren: f })
}
