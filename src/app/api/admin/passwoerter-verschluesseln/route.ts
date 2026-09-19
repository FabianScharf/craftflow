// Einmal-Werkzeug: noch im Klartext liegende SMTP-Passwörter verschlüsseln.
//
// ANLASS (19.09.2026): Bis heute wurde das SMTP-Passwort trotz des Spaltennamens
// `smtp_password_encrypted` im Klartext gespeichert. Seit `src/lib/geheimnis.ts`
// wird beim Speichern verschlüsselt — der ALTBESTAND liegt aber weiter offen, bis
// jemand sein Passwort einmal neu eingibt.
//
// WARUM ALS ROUTE UND NICHT ALS SKRIPT: Der Schlüssel steht als Secret in den
// Vercel-Umgebungsvariablen und lässt sich bewusst nicht wieder auslesen
// (`vercel env pull` liefert nur einen Platzhalter). Nur der laufende Server
// kennt ihn. Ein lokales Skript hätte das Passwort außerdem durch fremde Hände
// gehen lassen — hier verlässt es den Server nie.
//
// SICHER: nur für ADMIN_EMAIL, nur Zählwerte in der Antwort, niemals ein Wert.
// Mehrfach aufrufbar: Was schon verschlüsselt ist, wird übersprungen.

import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { getSupabaseClient } from '@/lib/supabase'
import { ADMIN_EMAIL } from '@/lib/admin'
import { verschluessele, entschluessele, istVerschluesselt, schluesselVorhanden } from '@/lib/geheimnis'

export async function POST() {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })
  }
  if (!schluesselVorhanden()) {
    return NextResponse.json({ error: 'GEHEIMNIS_SCHLUESSEL fehlt in dieser Umgebung.' }, { status: 503 })
  }

  const admin = getSupabaseClient()
  const { data, error } = await admin
    .from('email_config')
    .select('id, smtp_password_encrypted')
  if (error) {
    console.error('[passwoerter] lesen:', error.message)
    return NextResponse.json({ error: 'Lesen fehlgeschlagen' }, { status: 500 })
  }

  let verschluesselt = 0
  let uebersprungen = 0
  let fehlgeschlagen = 0

  for (const zeile of data ?? []) {
    const wert = (zeile.smtp_password_encrypted as string | null) ?? ''
    if (!wert || istVerschluesselt(wert)) { uebersprungen++; continue }

    const geheim = verschluessele(wert)
    // Gegenprobe VOR dem Schreiben: Lässt sich der Wert wieder herstellen? Ein
    // kaputter Geheimtext wäre schlimmer als der Klartext — das Passwort wäre
    // unwiederbringlich weg.
    if (entschluessele(geheim) !== wert) {
      console.error('[passwoerter] Gegenprobe fehlgeschlagen für Zeile', zeile.id)
      fehlgeschlagen++
      continue
    }

    const { error: sErr } = await admin
      .from('email_config')
      .update({ smtp_password_encrypted: geheim })
      .eq('id', zeile.id)
    if (sErr) {
      console.error('[passwoerter] schreiben:', sErr.message)
      fehlgeschlagen++
      continue
    }
    verschluesselt++
  }

  return NextResponse.json({ verschluesselt, uebersprungen, fehlgeschlagen })
}
