import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { pruefeZugang } from '@/lib/planpruefung'

export async function POST(req: NextRequest) {
  try {
    // Erste Prüfung nach dem Login (Aufgabe 0). Kein Nutzer da → weiter wie
    // bisher (die Middleware schützt die Route ohnehin schon vor Login-losen
    // Zugriffen; das hier ist die Zugangs-, nicht die Auth-Prüfung).
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const zu = await pruefeZugang(supabase, user.id)
      if (zu) return zu
    }

    const formData = await req.formData()
    const audio = formData.get('audio') as File | null
    if (!audio) return NextResponse.json({ error: 'Keine Audiodatei' }, { status: 400 })

    const apiKey = process.env.GROQ_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'Kein API Key konfiguriert' }, { status: 500 })

    const body = new FormData()
    body.append('file', audio, audio.name || 'audio.webm')
    body.append('model', 'whisper-large-v3-turbo')
    body.append('language', 'de')
    body.append('response_format', 'json')

    const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body,
    })

    if (!response.ok) {
      const err = await response.text()
      throw new Error(`Whisper Fehler: ${response.status} – ${err}`)
    }

    const data = await response.json()
    return NextResponse.json({ success: true, text: data.text })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unbekannter Fehler'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
