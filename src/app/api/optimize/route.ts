import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 60

type ChatMsg = { role: 'user' | 'assistant'; content: string }

const SYSTEM_BASE = `Du bist ein Experte für Schreiner-Angebote bei FS Crafted in Rodenbach. Du hilfst, Angebote zu vervollständigen und zu verbessern.

ANTWORTFORMAT – antworte IMMER mit gültigem JSON-Objekt, niemals mit Backticks oder Markdown:

Bei Analyse, Rückfragen oder reinen Informationen:
{"message":"Deine Antwort auf Deutsch","updatedOffer":null}

Bei konkreten Änderungen (Holzart, Maße, Titel, Preise, Positionen):
{"message":"Kurze Bestätigung was geändert wurde","updatedOffer":{"positionen":[VOLLSTÄNDIGE_LISTE],"kunde":{VOLLSTÄNDIGE_KUNDENDATEN}}}

PFLICHTREGELN:
- updatedOffer: IMMER ALLE Positionen zurückgeben, nicht nur die geänderten
- Bestehende id-Felder BEIBEHALTEN (id, material[].id, arbeitszeit[].id)
- Holzart: in beschreibung UND material[].bezeichnung eintragen
- Bei Analyse: konkret auflisten was fehlt (Holzart, Maße mm, Oberfläche, Montageort)
- Gültige Kostenstellen-IDs: 00_Meeting, 01_02_Planung, 02_01_Konstruktion, 02_02_Arbeitsvorbereitung, 03_00_Produktion, 03_01_Warenhandling, 03_02_Zuschnitt, 03_03_Bekantung, 03_04_CNC, 03_05_Oberflaechenbehandlung, 03_06_Zusammenbau, 03_07_Verpacken, 03_08_Azubi, 05_01_Montage, 06_01_Lieferung`

function extractJSON(text: string): { message: string; updatedOffer: unknown } | null {
  const clean = text.replace(/```json\n?|```/g, '').trim()
  try { return JSON.parse(clean) } catch { /* fall through */ }
  const match = clean.match(/\{[\s\S]*\}/)
  if (match) {
    try { return JSON.parse(match[0]) } catch { /* fall through */ }
  }
  return null
}

export async function POST(req: NextRequest) {
  try {
    const { offerData, chatHistory, message } = await req.json() as {
      offerData: unknown
      chatHistory: ChatMsg[]
      message: string
    }

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'Kein API Key konfiguriert' }, { status: 500 })

    const system = SYSTEM_BASE + `\n\n== AKTUELLES ANGEBOT (JSON) ==\n${JSON.stringify(offerData, null, 2)}`

    const messages: ChatMsg[] = [
      ...chatHistory,
      { role: 'user', content: message },
    ]

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 6000,
        temperature: 0.2,
        system,
        messages,
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Claude ${res.status}: ${err.slice(0, 300)}`)
    }

    const data = await res.json() as { content?: Array<{ text?: string }> }
    const raw = data.content?.[0]?.text ?? ''

    const parsed = extractJSON(raw)
    if (parsed) {
      return NextResponse.json({ success: true, message: parsed.message, updatedOffer: parsed.updatedOffer ?? null })
    }
    return NextResponse.json({ success: true, message: raw, updatedOffer: null })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unbekannter Fehler'
    console.error('[optimize]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
