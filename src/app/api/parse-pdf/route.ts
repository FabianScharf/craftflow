import { NextRequest, NextResponse } from 'next/server'
import { extractText } from 'unpdf'

const MAX_SIZE = 10 * 1024 * 1024 // 10 MB

export async function POST(req: NextRequest) {
  try {
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
