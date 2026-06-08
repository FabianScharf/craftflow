import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
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
