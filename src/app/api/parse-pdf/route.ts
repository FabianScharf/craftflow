import { NextRequest, NextResponse } from 'next/server'
import { PDFParse } from 'pdf-parse'

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

    const buffer = Buffer.from(await file.arrayBuffer())
    const parser = new PDFParse({ data: buffer })
    const result = await parser.getText()

    if (!result.text?.trim()) {
      return NextResponse.json(
        { error: 'Kein Text im PDF gefunden. Gescannte PDFs (nur Bilder) werden nicht unterstützt.' },
        { status: 422 }
      )
    }

    return NextResponse.json({ text: result.text.trim() })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unbekannter Fehler'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
