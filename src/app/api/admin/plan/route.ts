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
import { kontoIdFuer } from '@/lib/kontoserver'
import { ADMIN_EMAIL } from '@/lib/admin'
import { istPlan } from '@/lib/plaene'

export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  // Admin-Gate bleibt unverändert: die E-Mail des Logins entscheidet, nicht die kontoId.
  if (authErr || !user || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })
  }

  const { plan, gesperrt } = await req.json().catch(() => ({})) as { plan?: unknown; gesperrt?: unknown }

  // Sonderfall „Gesperrt": die Paywall absichtlich herstellen, um sie zu prüfen.
  // plan='solo' OHNE Abo ist genau der Zustand eines Kontos nach der Testphase.
  if (gesperrt === true) {
    const kontoGesperrt = await kontoIdFuer(supabase, user)
    const { error: gErr } = await supabase
      .from('betriebsprofil')
      .update({ plan: 'solo', abo_status: null, plan_gueltig_bis: null, updated_at: new Date().toISOString() })
      .eq('user_id', kontoGesperrt.kontoId)
    if (gErr) {
      console.error('[admin/plan] Sperren:', gErr.message)
      return NextResponse.json({ error: gErr.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true, plan: 'solo', gesperrt: true })
  }

  if (!istPlan(plan)) {
    return NextResponse.json({ error: `„${String(plan)}“ ist kein gültiger Plan.` }, { status: 400 })
  }

  // Geschrieben wird das Profil DES KONTOS (Konto-ID des Admins) — falls der Admin
  // selbst je Mitglied eines Betriebs wäre, träfe die Änderung sonst den Login statt
  // den Betrieb, dessen Plan das Panel eigentlich umschaltet.
  const konto = await kontoIdFuer(supabase, user)

  // WARUM HIER AUCH abo_status GESETZT WIRD (Fabian, 19.09.: „Als ich auf Solo
  // umgestellt habe, war mein Zugriff vollständig weg"):
  //
  // `effektiverPlan` kennt nur drei Wege zu einem Plan — laufende Testphase
  // (immer Enterprise), aktives Abo, oder ein Plan ≠ Solo ohne Abo-Historie.
  // Der Umschalter schrieb bisher nur `plan`. Für starter/pro/enterprise ging das
  // über den dritten Weg gut, für **solo** aber nicht: Solo ist dort ausdrücklich
  // ausgenommen — und zwar zu Recht, sonst bekäme jedes Konto nach Ablauf der
  // Testphase still den Solo-Plan geschenkt. Ergebnis war ein komplett gesperrtes
  // Konto mit der irreführenden Meldung „Testzeitraum abgelaufen".
  //
  // Der Umschalter simuliert deshalb, was er verspricht: ein bezahltes Abo ohne
  // Stripe. Damit greift Weg 2, und JEDER Plan ist prüfbar — auch Solo.
  // `effektiverPlan` selbst bleibt unangetastet; dort hängt die Abrechnung dran.
  const { error } = await supabase
    .from('betriebsprofil')
    .update({ plan, abo_status: 'aktiv', updated_at: new Date().toISOString() })
    .eq('user_id', konto.kontoId)

  // Supabase wirft nicht — ohne diese Prüfung sähe ein Fehlschlag wie ein Erfolg aus
  // und das Panel zeigte einen Plan an, der in der Datenbank nie ankam.
  if (error) {
    console.error('[admin/plan] Update:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true, plan })
}
