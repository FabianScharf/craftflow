import { NextRequest, NextResponse } from 'next/server'

type ChatMsg = { role: 'user' | 'assistant'; content: string }

const SYSTEM = `Du bist ein Experte für Schreiner-Angebote bei FS Crafted in Rodenbach. Du hilfst, Angebote zu vervollständigen und zu verbessern.

Du bekommst das aktuelle Angebot als JSON und eine Nachricht vom Nutzer.

ANTWORTFORMAT – antworte NUR mit gültigem JSON, keine Backticks:

Bei Fragen, Analyse oder Informationsanfragen:
{"message":"Deine Antwort auf Deutsch","updatedOffer":null}

Bei strukturellen Änderungen am Angebot (Umbenennen, Holzart setzen, Struktur ändern, Werte ändern):
{"message":"Kurze Bestätigung der Änderung","updatedOffer":{"positionen":[...],"kunde":{...}}}

REGELN:
- updatedOffer IMMER vollständig zurückgeben (alle Positionen, nicht nur geänderte)
- Bestehende id-Felder beibehalten (id, material[].id, arbeitszeit[].id)
- Holzart setzen: in beschreibung und material[].bezeichnung schreiben
- Positionen umbenennen: titel-Feld ändern
- Gruppenstruktur: Positionen mit Gruppenpräfix im Titel (z.B. "Kleiderschrank – Korpus")
- Bei Analyse: fehlende Angaben auflisten (Holzart, Maße, Oberfläche, Montageort)

KOSTENSTELLEN-IDs (nur diese verwenden):
00_Meeting, 01_02_Planung, 02_01_Konstruktion, 02_02_Arbeitsvorbereitung,
03_00_Produktion, 03_01_Warenhandling, 03_02_Zuschnitt, 03_03_Bekantung,
03_04_CNC, 03_05_Oberflaechenbehandlung, 03_06_Zusammenbau, 03_07_Verpacken,
03_08_Azubi, 05_01_Montage, 06_01_Lieferung`

export async function POST(req: NextRequest) {
  try {
    const { offerData, chatHistory, message } = await req.json() as {
      offerData: unknown
      chatHistory: ChatMsg[]
      message: string
    }

    const apiKey = process.env.GROQ_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'Kein API Key konfiguriert' }, { status: 500 })

    const messages = [
      { role: 'system', content: SYSTEM },
      { role: 'user', content: `Aktuelles Angebot:\n${JSON.stringify(offerData, null, 2)}` },
      ...chatHistory,
      { role: 'user', content: message },
    ]

    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: 'llama-3.3-70b-versatile', messages, temperature: 0.3, max_tokens: 4000 }),
    })

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Groq ${res.status}: ${err.slice(0, 200)}`)
    }

    const data = await res.json()
    const raw = (data.choices?.[0]?.message?.content ?? '') as string
    const clean = raw.replace(/```json\n?|```/g, '').trim()

    try {
      const parsed = JSON.parse(clean) as { message: string; updatedOffer: unknown }
      return NextResponse.json({ success: true, message: parsed.message, updatedOffer: parsed.updatedOffer ?? null })
    } catch {
      return NextResponse.json({ success: true, message: raw, updatedOffer: null })
    }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unbekannter Fehler'
    console.error('[optimize]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
