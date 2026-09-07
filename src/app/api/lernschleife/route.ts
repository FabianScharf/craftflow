import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { beobachtungenAus, lerneFaktoren, type Beobachtung } from '@/lib/lernschleife'
import { ladeKalibrierung, speichereKalibrierung } from '@/lib/kalibrierungsspeicher'

// Lernschleife: zieht die Zeitfaktoren aus GEWONNENEN Angeboten nach.
//
// Braucht keine neue Tabelle. Die fruehe Fassung eines Angebots liegt in
// offer_versions (Version 1), der Endstand in projects.data, der Status ebenda.
//
// GET  = Vorschau. Rechnet, speichert aber nichts — damit der Nutzer sieht, was
//        passieren wuerde, bevor es passiert.
// POST = uebernehmen.

const MAX_ANGEBOTE = 40

async function sammleBeobachtungen(
  supabase: Awaited<ReturnType<typeof createClient>>, userId: string,
): Promise<{ beobachtungen: Beobachtung[]; angebote: number }> {
  const { data: projekte, error } = await supabase
    .from('projects')
    .select('id, data, status')
    .eq('user_id', userId)
    .eq('status', 'gewonnen')
    .order('updated_at', { ascending: false })
    .limit(MAX_ANGEBOTE)
  // Supabase wirft nicht — ohne diese Pruefung sieht ein Ausfall wie "keine
  // gewonnenen Angebote" aus, und die Schleife bliebe stumm.
  if (error) { console.error('[lernschleife] Projekte:', error.message); return { beobachtungen: [], angebote: 0 } }

  const beobachtungen: Beobachtung[] = []
  let angebote = 0
  for (const p of projekte ?? []) {
    const { data: versionen, error: vErr } = await supabase
      .from('offer_versions')
      .select('data, version_number')
      .eq('user_id', userId)
      .eq('offer_id', p.id)
      .order('version_number', { ascending: true })
      .limit(1)
    if (vErr) { console.error('[lernschleife] Versionen:', vErr.message); continue }
    const erste = versionen?.[0]?.data
    if (!erste) continue

    // projects.data traegt das Angebot unter "pos" — offer_versions unter
    // "positionen". Beide Formen zulassen, sonst findet der Vergleich nichts.
    const endstand = p.data as { pos?: unknown; positionen?: unknown } | null
    const neu = { positionen: (endstand?.positionen ?? endstand?.pos) as never }
    const alt = erste as { pos?: unknown; positionen?: unknown }
    const vor = { positionen: (alt?.positionen ?? alt?.pos) as never }

    const b = beobachtungenAus(vor, neu)
    if (b.length > 0) { beobachtungen.push(...b); angebote++ }
  }
  return { beobachtungen, angebote }
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const kal = await ladeKalibrierung(supabase, user.id)
  const alt = {
    werkstatt:   Number(kal?.faktor_werkstatt ?? 1),
    oberflaeche: Number(kal?.faktor_oberflaeche ?? 1),
    massivholz:  Number(kal?.faktor_massivholz ?? 1),
    montage:     Number(kal?.faktor_montage ?? 1),
  }
  const { beobachtungen, angebote } = await sammleBeobachtungen(supabase, user.id)
  const r = lerneFaktoren(alt, beobachtungen)
  return NextResponse.json({ angebote, beobachtungen: beobachtungen.length, alt, ...r })
}

export async function POST() {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const kal = await ladeKalibrierung(supabase, user.id)
  if (!kal) return NextResponse.json({ error: 'Noch nicht kalibriert' }, { status: 400 })

  const alt = {
    werkstatt: Number(kal.faktor_werkstatt), oberflaeche: Number(kal.faktor_oberflaeche),
    massivholz: Number(kal.faktor_massivholz), montage: Number(kal.faktor_montage),
  }
  const { beobachtungen, angebote } = await sammleBeobachtungen(supabase, user.id)
  const r = lerneFaktoren(alt, beobachtungen)
  if (r.begruendung.length === 0) {
    return NextResponse.json({ ok: true, geaendert: false, angebote, ...r })
  }
  const s = await speichereKalibrierung(supabase, user.id, {
    faktor_werkstatt: r.faktoren.werkstatt,
    faktor_oberflaeche: r.faktoren.oberflaeche,
    faktor_massivholz: r.faktoren.massivholz,
    faktor_montage: r.faktoren.montage,
  })
  if (!s.ok) return NextResponse.json({ error: s.grund }, { status: 500 })
  return NextResponse.json({ ok: true, geaendert: true, angebote, ...r })
}
