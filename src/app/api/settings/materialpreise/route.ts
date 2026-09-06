import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

// CRUD für fixierte Einkaufspreise. Aufbau bewusst identisch zu
// src/app/api/settings/bauweise/route.ts — gleiche Auth-Prüfung, gleiche
// Fehlerform, damit beide Reiter sich gleich verhalten.

const SPALTEN = 'id, bezeichnung, ek, einheit, lieferant, stand, aktiv, created_at'
const EINHEITEN = ['Stk', 'm2', 'lfdm', 'm3', 'kg', 'pauschal'] as const
const MAX_BEZEICHNUNG = 200
const MAX_LIEFERANT = 120

function pruefeEinheit(wert: unknown): string | null {
  const s = String(wert ?? '').trim()
  return EINHEITEN.find(e => e.toLowerCase() === s.toLowerCase()) ?? null
}

// Der Nutzer tippt "26,27", JSON transportiert 26.27. Beides muss ankommen.
function pruefeEk(wert: unknown): number | null {
  const n = typeof wert === 'number' ? wert : Number(String(wert ?? '').replace(',', '.'))
  if (!Number.isFinite(n) || n < 0) return null
  return Math.round(n * 100) / 100
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const { data, error } = await supabase
    .from('materialpreise')
    .select(SPALTEN)
    .eq('user_id', user.id)
    .order('bezeichnung')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ preise: data ?? [] })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const body = await req.json() as { bezeichnung?: string; ek?: unknown; einheit?: string; lieferant?: string }

  const bezeichnung = (body.bezeichnung ?? '').trim().slice(0, MAX_BEZEICHNUNG)
  if (!bezeichnung) return NextResponse.json({ error: 'Bezeichnung erforderlich' }, { status: 400 })

  const ek = pruefeEk(body.ek)
  if (ek === null) return NextResponse.json({ error: 'Einkaufspreis muss eine Zahl ab 0 sein' }, { status: 400 })

  const einheit = pruefeEinheit(body.einheit ?? 'Stk')
  if (!einheit) return NextResponse.json({ error: `Einheit muss eine von: ${EINHEITEN.join(', ')}` }, { status: 400 })

  const { data, error } = await supabase
    .from('materialpreise')
    .insert({
      user_id: user.id, bezeichnung, ek, einheit,
      lieferant: (body.lieferant ?? '').trim().slice(0, MAX_LIEFERANT),
      stand: new Date().toISOString().slice(0, 10),
    })
    .select(SPALTEN)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ preis: data })
}

export async function PUT(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const body = await req.json() as {
    id?: string; bezeichnung?: string; ek?: unknown; einheit?: string; lieferant?: string; aktiv?: boolean
  }
  if (!body.id) return NextResponse.json({ error: 'id erforderlich' }, { status: 400 })

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }

  if (body.bezeichnung != null) {
    const b = body.bezeichnung.trim().slice(0, MAX_BEZEICHNUNG)
    if (!b) return NextResponse.json({ error: 'Bezeichnung darf nicht leer sein' }, { status: 400 })
    patch.bezeichnung = b
  }
  if (body.ek != null) {
    const ek = pruefeEk(body.ek)
    if (ek === null) return NextResponse.json({ error: 'Einkaufspreis muss eine Zahl ab 0 sein' }, { status: 400 })
    patch.ek = ek
    // Wer den Preis anfasst, bestätigt ihn — deshalb wandert der Stand mit.
    // Ohne das bliebe ein gerade nachgepflegter Preis als "veraltet" markiert.
    patch.stand = new Date().toISOString().slice(0, 10)
  }
  if (body.einheit != null) {
    const e = pruefeEinheit(body.einheit)
    if (!e) return NextResponse.json({ error: `Einheit muss eine von: ${EINHEITEN.join(', ')}` }, { status: 400 })
    patch.einheit = e
  }
  if (body.lieferant != null) patch.lieferant = body.lieferant.trim().slice(0, MAX_LIEFERANT)
  if (body.aktiv != null) patch.aktiv = body.aktiv

  const { error } = await supabase
    .from('materialpreise')
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
    .from('materialpreise')
    .delete()
    .eq('id', body.id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
