import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

// Eigene Textbausteine des Betriebs.
//
// Fabian am 2026-09-08: "Ein Textbaustein ist für mich die Widerrufsbelehrung, aber
// wäre es nicht gut, wenn sich Kunden eigene Textbausteine bauen können?"
//
// Die festen Bausteine (Anrede, Einleitung, Abschluss, Zahlung, Widerruf,
// Massivholz) gab es schon. Was fehlte: beliebig viele eigene — Materialpreis-
// vorbehalt, Ausführungszeitraum, Entsorgung, Anfahrtsregelung. Jeder Betrieb hat
// andere, und keine Liste, die wir vorgeben, träfe sie alle.
//
// "immer" heißt: steht ohne Zutun in jedem neuen Angebot. Sonst wird er im Angebot
// einzeln dazugeklickt.

type Baustein = {
  id?: string
  titel?: string
  inhalt?: string
  immer?: boolean
  reihenfolge?: number
  aktiv?: boolean
}

async function nutzer() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  return { supabase, user, error }
}

export async function GET() {
  const { supabase, user, error } = await nutzer()
  if (error || !user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const { data, error: dbFehler } = await supabase
    .from('textbausteine')
    .select('id, titel, inhalt, immer, reihenfolge, aktiv')
    .eq('user_id', user.id)
    .order('reihenfolge')
  // Supabase wirft nicht — ohne diese Pruefung sieht ein Ausfall aus wie
  // "keine Bausteine vorhanden", und der Nutzer glaubt, seine Texte seien weg.
  if (dbFehler) return NextResponse.json({ error: dbFehler.message }, { status: 500 })
  return NextResponse.json({ bausteine: data ?? [] })
}

export async function POST(req: NextRequest) {
  const { supabase, user, error } = await nutzer()
  if (error || !user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const b = await req.json() as Baustein
  const titel = String(b.titel ?? '').trim()
  if (!titel) return NextResponse.json({ error: 'Ein Baustein braucht einen Titel' }, { status: 400 })

  // Ans Ende einsortieren.
  const { data: letzte } = await supabase
    .from('textbausteine').select('reihenfolge')
    .eq('user_id', user.id).order('reihenfolge', { ascending: false }).limit(1)
  const reihenfolge = ((letzte?.[0]?.reihenfolge as number) ?? 0) + 1

  const { data, error: dbFehler } = await supabase
    .from('textbausteine')
    .insert({
      user_id: user.id, titel,
      inhalt: String(b.inhalt ?? ''),
      immer: b.immer === true,
      reihenfolge,
    })
    .select('id, titel, inhalt, immer, reihenfolge, aktiv')
    .single()
  if (dbFehler) return NextResponse.json({ error: dbFehler.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function PUT(req: NextRequest) {
  const { supabase, user, error } = await nutzer()
  if (error || !user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const b = await req.json() as Baustein
  if (!b.id) return NextResponse.json({ error: 'id fehlt' }, { status: 400 })

  const feld: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (b.titel !== undefined) feld.titel = String(b.titel).trim()
  if (b.inhalt !== undefined) feld.inhalt = String(b.inhalt)
  if (b.immer !== undefined) feld.immer = b.immer === true
  if (b.aktiv !== undefined) feld.aktiv = b.aktiv === true
  if (b.reihenfolge !== undefined) feld.reihenfolge = Number(b.reihenfolge) || 0

  const { error: dbFehler } = await supabase
    .from('textbausteine').update(feld)
    .eq('id', b.id).eq('user_id', user.id)
  if (dbFehler) return NextResponse.json({ error: dbFehler.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const { supabase, user, error } = await nutzer()
  if (error || !user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id fehlt' }, { status: 400 })

  const { error: dbFehler } = await supabase
    .from('textbausteine').delete()
    .eq('id', id).eq('user_id', user.id)
  // Der echte Grund gehoert zurueck. "permission denied for table ..." hat am
  // 2026-09-07 einen Fehler in einem Anlauf erklaert.
  if (dbFehler) return NextResponse.json({ error: dbFehler.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
