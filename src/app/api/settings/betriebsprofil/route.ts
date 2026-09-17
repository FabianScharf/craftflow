import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { kontoIdFuer, kontoGesperrt } from '@/lib/kontoserver'
import { normalisiereHex } from '@/lib/theme'
import { klemmePreisfaktor } from '@/lib/preisfaktor'
import {
  PROFIL_FELDER, PROFIL_BOOL_FELDER, PROFIL_ZAHL_FELDER, darfGeschriebenWerden,
} from '@/lib/profilfelder'

export async function GET() {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })
  const konto = await kontoIdFuer(supabase, user)
  const sperre = kontoGesperrt(konto); if (sperre) return sperre
  const kontoId = konto.kontoId

  const { data, error } = await supabase
    .from('betriebsprofil')
    .select('*')
    .eq('user_id', kontoId)
    .single()

  if (error && error.code !== 'PGRST116') {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ profil: data ?? null })
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })
  const konto = await kontoIdFuer(supabase, user)
  const sperre = kontoGesperrt(konto); if (sperre) return sperre
  const kontoId = konto.kontoId

  const body = await req.json() as Record<string, unknown>
  // Die Liste steht in src/lib/profilfelder.ts — rein, getestet und mit einer
  // ausdrücklichen Sperrliste für plan/abo_status/plan_gueltig_bis/trial_starts_at
  // und alle stripe_*-Felder (Audit 2026-09-17, Critical: über 'plan' in dieser
  // Liste konnte sich jeder Nutzer selbst Enterprise geben).
  // Fabians Entwickler-Umschalter für den Plan läuft jetzt über
  // PATCH /api/admin/plan mit E-Mail-Prüfung.
  // Firmendaten dürfen auch Mitarbeiter ändern (Task 2a-Brief) — keine
  // istInhaber-Prüfung hier, nur die übliche Sperrliste.
  const allowed = PROFIL_FELDER
  const boolFields = new Set(PROFIL_BOOL_FELDER)
  const numFields = new Set(PROFIL_ZAHL_FELDER)

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const key of allowed) {
    if (!(key in body)) continue
    if (!darfGeschriebenWerden(key)) continue
    const v = body[key]
    if (boolFields.has(key)) {
      patch[key] = v === true || v === 'true'
    } else if (numFields.has(key)) {
      patch[key] = v === '' || v === null || v === undefined ? null : Number(v)
    } else {
      patch[key] = v
    }
  }

  // Preisfaktor: 0,50-3,00. Unsinn wird abgewiesen statt stillschweigend
  // umgedeutet — ein NaN in dieser Spalte wuerde jede Angebotssumme zerstoeren.
  if ('preisfaktor' in patch) {
    const roh = patch.preisfaktor
    const wert = klemmePreisfaktor(roh)
    if (wert === null) {
      return NextResponse.json(
        { error: `Preisfaktor: „${String(roh)}“ ist keine Zahl zwischen 0,50 und 3,00.` },
        { status: 400 },
      )
    }
    patch.preisfaktor = wert
  }

  // Farbcodes bereinigen; Unsinn abweisen statt ihn in die Datenbank zu lassen.
  // Ein ungueltiger Code haette die CSS-Variable ungueltig gemacht — die Farbe
  // waere stumm weggefallen (Kundenrueckmeldung 2026-09-15).
  for (const key of ['farbe_primaer', 'farbe_akzent'] as const) {
    if (!(key in patch)) continue
    const v = patch[key]
    if (v === '' || v === null || v === undefined) { patch[key] = null; continue }
    const hex = normalisiereHex(String(v))
    if (!hex) {
      const name = key === 'farbe_primaer' ? 'Primärfarbe' : 'Akzentfarbe'
      return NextResponse.json({ error: `${name}: „${String(v)}“ ist kein gültiger Farbcode (z. B. #C8102E).` }, { status: 400 })
    }
    patch[key] = hex
  }

  const { error } = await supabase
    .from('betriebsprofil')
    .update(patch)
    .eq('user_id', kontoId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
