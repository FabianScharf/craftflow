import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { BEREICHE, normalisiere, type Bereich } from '@/lib/learn'

const SPALTEN = 'id, bereich, wenn, dann, herkunft, quelle_text, beleg, aktiv, gesendet_zahl, zuletzt_gesendet, konflikt_hinweis, created_at'

function pruefeBereich(wert: unknown): Bereich | null {
  return BEREICHE.find(b => normalisiere(b) === normalisiere(String(wert ?? ''))) ?? null
}

// Beide Felder landen wortwörtlich in jedem künftigen System-Prompt. Der
// KI-Pfad ist über max_tokens begrenzt, der Handeingabe-Pfad nicht — deshalb
// hier kappen statt ablehnen: der Nutzer soll seine Eingabe nicht wegen einer
// Längengrenze verlieren.
const MAX_WENN_ZEICHEN = 300
const MAX_DANN_ZEICHEN = 400

export async function GET() {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const { data, error } = await supabase
    .from('bauweise_regeln')
    .select(SPALTEN)
    .eq('user_id', user.id)
    .order('bereich')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ regeln: data ?? [] })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const body = await req.json() as {
    bereich?: string; wenn?: string; dann?: string
    herkunft?: string; quelle_text?: string; beleg?: string
    ersetztRegelId?: string
  }

  const bereich = pruefeBereich(body.bereich)
  if (!bereich) return NextResponse.json({ error: 'Unbekannter Bereich' }, { status: 400 })
  const dann = (body.dann ?? '').trim().slice(0, MAX_DANN_ZEICHEN)
  if (!dann) return NextResponse.json({ error: 'dann erforderlich' }, { status: 400 })
  const wenn = (body.wenn ?? '').trim().slice(0, MAX_WENN_ZEICHEN)
  const herkunft = body.herkunft === 'manuell' ? 'manuell' : 'gelernt'

  // Ersetzt der Kandidat eine bestehende Regel, wird diese aktualisiert statt
  // eine zweite widersprüchliche Regel anzulegen.
  if (body.ersetztRegelId) {
    const { data, error } = await supabase
      .from('bauweise_regeln')
      .update({
        bereich, wenn, dann, beleg: body.beleg ?? '', quelle_text: body.quelle_text ?? '',
        konflikt_hinweis: false, aktiv: true, updated_at: new Date().toISOString(),
      })
      .eq('id', body.ersetztRegelId)
      .eq('user_id', user.id)
      .select(SPALTEN)
      .maybeSingle()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (data) return NextResponse.json({ regel: data })
    // Kein Treffer: die Regel wurde zwischen Kandidaten-Erzeugung und Bestätigung
    // gelöscht (oder die id gehört nicht diesem Nutzer). Die bestätigte Regel darf
    // deswegen nicht verloren gehen — unten normal neu anlegen. `.single()` wäre
    // hier ein 500er gewesen und hätte die Regel verworfen.
  }

  const { data, error } = await supabase
    .from('bauweise_regeln')
    .insert({
      user_id: user.id, bereich, wenn, dann, herkunft,
      quelle_text: body.quelle_text ?? '', beleg: body.beleg ?? '',
    })
    .select(SPALTEN)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ regel: data })
}

export async function PUT(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const body = await req.json() as { id?: string; wenn?: string; dann?: string; aktiv?: boolean }
  if (!body.id) return NextResponse.json({ error: 'id erforderlich' }, { status: 400 })

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.wenn != null) patch.wenn = body.wenn.trim().slice(0, MAX_WENN_ZEICHEN)
  if (body.dann != null) {
    const dann = body.dann.trim().slice(0, MAX_DANN_ZEICHEN)
    if (!dann) return NextResponse.json({ error: 'dann darf nicht leer sein' }, { status: 400 })
    patch.dann = dann
  }
  if (body.aktiv != null) patch.aktiv = body.aktiv
  // Jede bewusste Änderung räumt den Konflikt-Hinweis ab.
  patch.konflikt_hinweis = false

  const { error } = await supabase
    .from('bauweise_regeln')
    .update(patch)
    .eq('id', body.id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const body = await req.json() as { id?: string }
  if (!body.id) return NextResponse.json({ error: 'id erforderlich' }, { status: 400 })

  const { error } = await supabase
    .from('bauweise_regeln')
    .delete()
    .eq('id', body.id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
