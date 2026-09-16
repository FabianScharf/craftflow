// Plan-Umschalter des Entwickler-Panels (Einstellungen → Mein Plan → „🛠 Entwickler").
//
// ANLASS (Audit 2026-09-17, Critical): Das Panel schickte den Plan bisher an
// `PATCH /api/settings/betriebsprofil`. Sichtbar war der Knopf nur für Fabian —
// die Route prüfte aber gar nichts. Jeder eingeloggte Nutzer konnte sich mit
// einem einzigen Aufruf Enterprise geben, dauerhaft und an Stripe vorbei.
//
// Dieselbe Bauart wie src/app/api/admin/wuensche/[id]/route.ts und
// src/app/api/admin/gutscheincodes/route.ts: eine guard()-Funktion mit der
// E-Mail-Prüfung. Geschrieben wird ausschließlich das EIGENE Profil des Admins —
// kein Service-Role-Client, kein fremdes Konto.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { ADMIN_EMAIL } from '@/lib/admin'
import { istPlan } from '@/lib/plaene'

export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })
  }

  const { plan } = await req.json().catch(() => ({})) as { plan?: unknown }
  if (!istPlan(plan)) {
    return NextResponse.json({ error: `„${String(plan)}“ ist kein gültiger Plan.` }, { status: 400 })
  }

  const { error } = await supabase
    .from('betriebsprofil')
    .update({ plan, updated_at: new Date().toISOString() })
    .eq('user_id', user.id)

  // Supabase wirft nicht — ohne diese Prüfung sähe ein Fehlschlag wie ein Erfolg aus
  // und das Panel zeigte einen Plan an, der in der Datenbank nie ankam.
  if (error) {
    console.error('[admin/plan] Update:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true, plan })
}
