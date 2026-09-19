import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { getSupabaseClient } from '@/lib/supabase'
import { zeigeHinweis, type HinweisStand } from '@/lib/assistenthinweis'

/**
 * Ob der Hilfe-Assistent sich diesmal vorstellt.
 *
 * GET  zählt den Start hoch und antwortet, ob der Hinweis kommen soll.
 * POST meldet, was passiert ist: 'weggeklickt' oder 'benutzt'.
 *
 * Der Stand liegt in den app_metadata des Nutzers — kein neues Datenbankfeld, und
 * je Mensch statt je Betrieb: Der Geselle soll den Assistenten kennenlernen, auch
 * wenn der Inhaber ihn längst benutzt.
 *
 * Nichts hier darf den Start stören: Im Fehlerfall wird kein Hinweis gezeigt.
 */

export const dynamic = 'force-dynamic'

const MERKER = 'assistent_hinweis'

function standAus(meta: Record<string, unknown>): HinweisStand {
  const roh = meta[MERKER]
  return (roh && typeof roh === 'object' ? roh : {}) as HinweisStand
}

async function schreibe(userId: string, meta: Record<string, unknown>, stand: HinweisStand) {
  await getSupabaseClient().auth.admin.updateUserById(userId, {
    app_metadata: { ...meta, [MERKER]: stand },
  })
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ zeigen: false })

  try {
    const meta = (user.app_metadata ?? {}) as Record<string, unknown>
    const stand = standAus(meta)
    const neu: HinweisStand = { ...stand, starts: (stand.starts ?? 0) + 1 }

    const zeigen = zeigeHinweis(neu)
    if (zeigen) neu.zuletzt = new Date().toISOString()

    await schreibe(user.id, meta, neu)
    return NextResponse.json({ zeigen })
  } catch (e) {
    console.error('[assistent-hinweis] lesen:', e instanceof Error ? e.message : e)
    return NextResponse.json({ zeigen: false })
  }
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false }, { status: 401 })

  const { was } = await req.json().catch(() => ({})) as { was?: string }
  try {
    const meta = (user.app_metadata ?? {}) as Record<string, unknown>
    const stand = standAus(meta)
    if (was === 'benutzt') stand.benutzt = true
    else if (was === 'weggeklickt') stand.weggeklickt = (stand.weggeklickt ?? 0) + 1
    else return NextResponse.json({ ok: false }, { status: 400 })

    await schreibe(user.id, meta, stand)
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[assistent-hinweis] schreiben:', e instanceof Error ? e.message : e)
    return NextResponse.json({ ok: false })
  }
}
