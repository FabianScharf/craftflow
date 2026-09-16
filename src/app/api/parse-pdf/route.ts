import { NextRequest, NextResponse } from 'next/server'
import { extractText } from 'unpdf'
import { createClient } from '@/utils/supabase/server'
import { pruefeZugang } from '@/lib/planpruefung'

const MAX_SIZE = 10 * 1024 * 1024 // 10 MB

export async function POST(req: NextRequest) {
  try {
    // Bisher ohne jede Auth-Prüfung — die Middleware schützt zwar den Zugriff
    // (Session-Cookie nötig), aber ohne Login-Check + pruefeZugang lief die Route
    // auch für einen gesperrten (Testphase/Abo abgelaufen) Nutzer weiter (M9).
    const supabase = await createClient()
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })
    const zu = await pruefeZugang(supabase, user.id)
    if (zu) return zu

    const formData = await req.formData()
    const file = formData.get('pdf') as File | null

    if (!file) {
      return NextResponse.json({ error: 'Keine PDF-Datei übergeben' }, { status: 400 })
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'PDF zu groß. Maximum: 10 MB.' }, { status: 413 })
    }

    const buffer = new Uint8Array(await file.arrayBuffer())
    const { text } = await extractText(buffer, { mergePages: true })

    if (!text?.trim()) {
      // Gescannte / handgeschriebene PDFs haben keinen extrahierbaren Text —
      // kein Fehler, Client rendert die Seiten als Bilder für die KI
      return NextResponse.json({ text: '' })
    }

    return NextResponse.json({ text: text.trim() })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unbekannter Fehler'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
