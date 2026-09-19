// Kommentare unter einem Wunsch — lesen, schreiben, löschen.
//
// SOFORT ÖFFENTLICH (Fabian, 19.09.): Es gibt keinen Freigabeschritt. Was hier
// durchkommt, steht binnen fünf Minuten auf www.getcraftflow.de. Die Prüfungen
// hier sind die einzigen, die dazwischenstehen.
//
// WARUM EIN SERVICE-ROLE-CLIENT MITLÄUFT: Zu jedem Kommentar gehört der Name
// seines Urhebers, und der entsteht aus dem Betriebsprofil des Schreibers.
// Fremde Profile darf ein angemeldeter Nutzer nicht lesen (RLS) — deshalb löst
// der Server die Namen auf und gibt nur den fertigen Namen heraus. Die user_id
// verlässt die App nie.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { getSupabaseClient } from '@/lib/supabase'
import { kontoIdFuer, kontoGesperrt } from '@/lib/kontoserver'
import { pruefeZugang } from '@/lib/planpruefung'
import { ADMIN_EMAIL } from '@/lib/admin'
import {
  pruefeKommentar, darfSchreiben, fuerDieWebsite,
  type KommentarZeile, type NameArt, type Profil,
} from '@/lib/kommentare'

/** Namen aller genannten Nutzer in einem Rutsch — eine Abfrage statt N. */
async function ladeNamen(userIds: string[]) {
  const nameArten: Record<string, NameArt | null> = {}
  const profile: Record<string, Profil> = {}
  const ids = [...new Set(userIds)]
  if (ids.length === 0) return { nameArten, profile }
  const service = getSupabaseClient()
  const { data, error } = await service
    .from('betriebsprofil')
    .select('user_id, wunsch_name_art, firma_name, inhaber, plz, ort')
    .in('user_id', ids)
  if (error) {
    // Kein Abbruch: Ohne Profile greift in anzeigeName() der Rückfall. Ein
    // fehlender Name darf keinen ganzen Kommentarbereich leer lassen.
    console.error('[kommentare] Profile laden:', error.message)
    return { nameArten, profile }
  }
  for (const row of data ?? []) {
    const id = String(row.user_id)
    nameArten[id] = (row.wunsch_name_art ?? null) as NameArt | null
    profile[id] = row as Profil
  }
  return { nameArten, profile }
}

/** GET /api/wuensche/kommentare?wunsch=<id> — oder ohne Parameter: alle. */
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })
  const konto = await kontoIdFuer(supabase, user)
  const sperre = kontoGesperrt(konto); if (sperre) return sperre

  const wunschId = req.nextUrl.searchParams.get('wunsch')
  let frage = supabase
    .from('wunsch_kommentare')
    .select('id, wunsch_id, user_id, text, vom_entwickler, created_at')
    .order('created_at', { ascending: true })
  if (wunschId) frage = frage.eq('wunsch_id', wunschId)

  const { data, error } = await frage
  if (error) {
    console.error('[kommentare] laden:', error.message)
    return NextResponse.json({ error: 'Kommentare nicht verfügbar' }, { status: 500 })
  }
  const zeilen = (data ?? []) as KommentarZeile[]
  const { nameArten, profile } = await ladeNamen(zeilen.map(z => z.user_id))
  const offen = fuerDieWebsite(zeilen, nameArten, profile)

  // „vonMir" sagt der Oberfläche, wo ein Löschknopf hingehört. Es ist die
  // einzige Stelle, an der ein Bezug zum eigenen Konto herausgeht.
  const meine = new Set(zeilen.filter(z => z.user_id === konto.kontoId).map(z => z.id))
  return NextResponse.json({
    kommentare: offen.map(k => ({ ...k, vonMir: meine.has(k.id) })),
  })
}

/** POST — einen Kommentar schreiben. */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })
  const konto = await kontoIdFuer(supabase, user)
  const sperre = kontoGesperrt(konto); if (sperre) return sperre
  const kontoId = konto.kontoId
  const zu = await pruefeZugang(supabase, kontoId)
  if (zu) return zu

  const body = await req.json().catch(() => ({})) as { wunschId?: unknown; text?: unknown; alsCraftFlow?: unknown }
  const wunschId = String(body.wunschId ?? '')
  if (!wunschId) return NextResponse.json({ error: 'Kein Wunsch angegeben.' }, { status: 400 })

  const geprueft = pruefeKommentar(body.text)
  if (!geprueft.ok) return NextResponse.json({ error: geprueft.grund }, { status: 400 })

  // Antwort von CraftFlow: nur Fabian, und nur über die Service-Role. Die
  // RLS-Regel verbietet `vom_entwickler = true` für jeden Angemeldeten — diese
  // Prüfung hier ist die zweite Tür, nicht die einzige.
  const alsCraftFlow = body.alsCraftFlow === true
  if (alsCraftFlow && user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Nicht berechtigt.' }, { status: 403 })
  }

  // Spam-Bremse: gezählt wird über 24 Stunden, nicht ab Mitternacht — sonst
  // ließen sich um 23:59 und 00:01 zwei volle Tagesrationen hintereinander
  // schreiben.
  const seit = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { count, error: zErr } = await supabase
    .from('wunsch_kommentare')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', kontoId)
    .gte('created_at', seit)
  if (zErr) return NextResponse.json({ error: zErr.message }, { status: 500 })
  const erlaubt = darfSchreiben(count ?? 0)
  if (!erlaubt.ok) return NextResponse.json({ error: erlaubt.grund }, { status: 403 })

  const schreiber = alsCraftFlow ? getSupabaseClient() : supabase
  const { data: row, error } = await schreiber
    .from('wunsch_kommentare')
    .insert({ wunsch_id: wunschId, user_id: kontoId, text: geprueft.text, vom_entwickler: alsCraftFlow })
    .select('id, wunsch_id, user_id, text, vom_entwickler, created_at')
    .single()
  if (error || !row) {
    console.error('[kommentare] anlegen:', error?.message)
    return NextResponse.json({ error: error?.message ?? 'Speichern fehlgeschlagen' }, { status: 500 })
  }

  const { nameArten, profile } = await ladeNamen([kontoId])
  const [offen] = fuerDieWebsite([row as KommentarZeile], nameArten, profile)
  return NextResponse.json({ kommentar: { ...offen, vonMir: true } }, { status: 201 })
}

/** DELETE ?id=<id> — eigene Kommentare; Fabian darf jeden entfernen. */
export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })
  const konto = await kontoIdFuer(supabase, user)
  const sperre = kontoGesperrt(konto); if (sperre) return sperre

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Kein Kommentar angegeben.' }, { status: 400 })

  // Ohne Freigabeschritt ist das Löschen Fabians einziges Werkzeug gegen etwas,
  // das so nicht öffentlich stehen soll. Deshalb darf er jeden Kommentar
  // entfernen — über die Service-Role, an der RLS-Regel für eigene vorbei.
  const istAdmin = user.email === ADMIN_EMAIL
  const loescher = istAdmin ? getSupabaseClient() : supabase
  let frage = loescher.from('wunsch_kommentare').delete().eq('id', id)
  if (!istAdmin) frage = frage.eq('user_id', konto.kontoId)

  const { error } = await frage
  if (error) {
    console.error('[kommentare] löschen:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
