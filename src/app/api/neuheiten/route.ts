import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { getSupabaseClient } from '@/lib/supabase'
import { wasZeigen, type Fensterneuheit } from '@/lib/neuheitenfenster'

/**
 * Was beim Einloggen gezeigt wird — und der Merker dazu.
 *
 * GET  liefert die Anzeige (Fenster, Streifen oder nichts).
 * POST setzt den Merker auf jetzt: gesehen ist gesehen.
 *
 * Die Liste kommt von der öffentlichen Website-Schnittstelle. Eine zweite Liste hier
 * wäre ein Duplikat, das beim nächsten Eintrag lautlos veraltet — derselbe Grund wie
 * bei src/lib/funktionsseiten.ts. Ist die Website nicht erreichbar, wird nichts
 * gezeigt: Ein fehlendes Fenster ist ein Schönheitsfehler, ein hängender Start nicht.
 *
 * Der Merker steht in den app_metadata des ANGEMELDETEN NUTZERS — nicht im
 * Betriebsprofil. Seit der Teamfunktion teilen sich mehrere Menschen einen Betrieb;
 * ein Merker am Betrieb hieße, der Inhaber klickt weg und der Geselle sieht nie etwas.
 */

export const dynamic = 'force-dynamic'

const MERKER = 'neuheiten_gesehen_bis'
const QUELLE = 'https://www.getcraftflow.de/api/neuheiten'

async function ladeListe(): Promise<Fensterneuheit[]> {
  try {
    const res = await fetch(QUELLE, { signal: AbortSignal.timeout(3000), next: { revalidate: 600 } })
    if (!res.ok) return []
    const j = await res.json() as { neuheiten?: Fensterneuheit[] }
    return (j.neuheiten ?? []).filter(n => n.slug && n.datum && n.titel)
  } catch {
    return []
  }
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ art: 'nichts' })

  const meta = (user.app_metadata ?? {}) as Record<string, unknown>
  const gesehen = typeof meta[MERKER] === 'string' ? meta[MERKER] as string : null
  const anzeige = wasZeigen(await ladeListe(), gesehen, user.created_at ?? new Date().toISOString())
  return NextResponse.json(anzeige)
}

/**
 * Merker setzen — auf das DATUM DER NEUESTEN GEZEIGTEN NEUERUNG, nicht auf „jetzt".
 *
 * WARUM (gefunden 19.09.2026): Vorher stand hier `new Date().toISOString()`, und
 * `wasZeigen` vergleicht mit `n.datum > schwelle.slice(0, 10)` — einem Datum ohne
 * Uhrzeit, mit striktem Größer. Wer sich morgens einloggte und nichts sah, bekam
 * trotzdem den heutigen Tag als Merker. Alles, was am selben Tag noch
 * veröffentlicht wurde, war für ihn danach **nie mehr neu**.
 *
 * An einem Veröffentlichungstag trifft das jeden, der vorher schon einmal drin
 * war — am 19.09. hätte Fabian selbst die Werkstatt-Neuerungen nie zu sehen
 * bekommen, weil sein Merker von 07:43 stammte und die Einträge dasselbe Datum
 * trugen.
 *
 * Jetzt: Der Aufrufer schickt das Datum der neuesten Neuerung mit, die er
 * tatsächlich gesehen hat. Ohne Angabe wird NICHTS geschrieben — lieber ein
 * Fenster zweimal als eine Neuerung nie.
 *
 * Bleibt offen: Zwei Veröffentlichungen am selben Tag. Wer die erste sieht,
 * verpasst die zweite. Dafür bräuchten die Neuerungen einen Zeitstempel statt
 * eines Tagesdatums.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const body = await req.json().catch(() => ({})) as { bis?: unknown }
  const bis = typeof body.bis === 'string' && /^\d{4}-\d{2}-\d{2}/.test(body.bis) ? body.bis : null
  if (!bis) return NextResponse.json({ ok: false, grund: 'kein Datum' })

  try {
    const admin = getSupabaseClient()
    const meta = (user.app_metadata ?? {}) as Record<string, unknown>
    // Nie zurückdrehen: Ein älteres Datum als der bestehende Merker würde alte
    // Neuerungen wieder aufleben lassen.
    const bisher = typeof meta[MERKER] === 'string' ? meta[MERKER] as string : ''
    const neuerWert = bis > bisher.slice(0, 10) ? bis : bisher
    await admin.auth.admin.updateUserById(user.id, {
      app_metadata: { ...meta, [MERKER]: neuerWert },
    })
    return NextResponse.json({ ok: true })
  } catch (e) {
    // Scheitert der Merker, sieht der Nutzer das Fenster nochmal. Ärgerlich, aber
    // kein Grund, ihm einen Fehler zu zeigen.
    console.error('[neuheiten] Merker:', e instanceof Error ? e.message : e)
    return NextResponse.json({ ok: false })
  }
}
