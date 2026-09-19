// Kurz gültige Adresse auf das eigene Briefpapier — für die Vorschau in den
// Einstellungen.
//
// WOZU (19.09.2026): Der Bucket `briefpapier` stand auf öffentlich, und die
// Leseregel galt für die Rolle `public`. Jede Briefpapier-Datei war damit **ohne
// Anmeldung** abrufbar, wer die Adresse kannte — und wer angemeldet war, konnte
// den Bucket auflisten und so an die Adressen aller Betriebe kommen. In einem
// Briefpapier stehen Firmenname, Anschrift, oft Steuernummer und Bankverbindung.
//
// Seither ist der Bucket privat. Die Vorschau holt sich ihre Adresse hier: Der
// Server prüft, dass die gespeicherte Adresse wirklich zum eigenen Konto gehört,
// und stellt eine Adresse aus, die fünf Minuten gilt.

import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { getSupabaseClient } from '@/lib/supabase'
import { kontoIdFuer, kontoGesperrt } from '@/lib/kontoserver'
import {
  istEigenesBriefpapier, pfadAusBriefpapierAdresse, BRIEFPAPIER_BUCKET,
} from '@/lib/briefpapier'

export async function GET() {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })
  const konto = await kontoIdFuer(supabase, user)
  const sperre = kontoGesperrt(konto); if (sperre) return sperre
  const kontoId = konto.kontoId

  const { data: profil, error } = await supabase
    .from('betriebsprofil')
    .select('pdf_briefpapier_url')
    .eq('user_id', kontoId)
    .single()
  // Supabase wirft nicht — ohne diese Prüfung sähe ein Ausfall aus wie „kein
  // Briefpapier hinterlegt".
  if (error) {
    console.error('[briefpapier-link] Profil:', error.message)
    return NextResponse.json({ error: 'Profil nicht erreichbar' }, { status: 503 })
  }

  const adresse = (profil?.pdf_briefpapier_url as string | null) ?? null
  if (!adresse) return NextResponse.json({ error: 'Kein Briefpapier hinterlegt' }, { status: 404 })

  // Dieselbe Prüfung wie beim PDF-Bau: eigener Host, eigener Bucket, eigener
  // Ordner. Ein Altwert aus einer anderen Umgebung darf nicht signiert werden.
  if (!istEigenesBriefpapier(adresse, process.env.NEXT_PUBLIC_SUPABASE_URL, kontoId)) {
    console.error('[briefpapier-link] Adresse abgelehnt:', adresse)
    return NextResponse.json({ error: 'Die hinterlegte Datei gehört nicht zu diesem Konto.' }, { status: 400 })
  }

  const pfad = pfadAusBriefpapierAdresse(adresse)
  if (!pfad) return NextResponse.json({ error: 'Pfad nicht lesbar' }, { status: 400 })

  const { data: signiert, error: signErr } = await getSupabaseClient()
    .storage.from(BRIEFPAPIER_BUCKET).createSignedUrl(pfad, 300)
  if (signErr || !signiert?.signedUrl) {
    console.error('[briefpapier-link] signieren:', signErr?.message)
    return NextResponse.json({ error: 'Vorschau gerade nicht möglich' }, { status: 503 })
  }
  return NextResponse.json({ url: signiert.signedUrl })
}
