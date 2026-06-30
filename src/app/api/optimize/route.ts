import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 120

type ChatMsg = { role: 'user' | 'assistant'; content: string }

const SYSTEM_BASE = `Du bist Kalkulationsassistent für FS Crafted (Schreiner, Rodenbach). Du hilfst Angebote zu vervollständigen und zu verbessern.

KRITISCH – AUSGABEFORMAT:
Deine gesamte Antwort besteht aus GENAU EINEM gültigen JSON-Objekt. Kein Text davor, kein Text danach, keine Erklärungen, keine Backticks.

Analyse / Info / Rückfrage:
{"message":"Text ohne Markdown","updatedOffer":null}

Bei Änderungen am Angebot:
{"message":"Kurze Bestätigung (1 Satz)","updatedOffer":{"positionen":[VOLLSTÄNDIGE_LISTE],"kunde":{VOLLSTÄNDIGE_KUNDENDATEN}}}

INHALTLICHE REGELN:
- Kein Markdown, keine Sternchen
- Kurze, klare Sätze – maximal 4-6 Zeilen pro Antwort
- Fehlende Angaben als einfache Liste mit "→" als Aufzählungszeichen
- updatedOffer: IMMER alle Positionen zurückgeben (nicht nur geänderte)
- IDs beibehalten: id, material[].id, arbeitszeit[].id
- Holzart: in beschreibung UND material[].bezeichnung eintragen
- Kostenstellen-IDs (exakt so): Besprechung, Planung, Konstruktion, Arbeitsvorbereitung, Produktion, Warenhandling, Zuschnitt, Bekantung, CNC, Oberfläche, Zusammenbau, Verpacken, Azubi, Montage, Lieferung`

function extractJSON(text: string): { message: string; updatedOffer: unknown } | null {
  const clean = text.replace(/```json\n?|```/g, '').trim()

  // Direct parse (happy path)
  try {
    const p = JSON.parse(clean)
    if (p?.message !== undefined) return p
  } catch { /* fall through */ }

  // Brace-counting: collect all top-level JSON objects
  const candidates: string[] = []
  let depth = 0, start = -1
  for (let i = 0; i < clean.length; i++) {
    if (clean[i] === '{') { if (depth === 0) start = i; depth++ }
    else if (clean[i] === '}') {
      depth--
      if (depth === 0 && start !== -1) { candidates.push(clean.slice(start, i + 1)); start = -1 }
    }
  }
  // Try last candidate first — Claude often puts the final answer last
  for (let i = candidates.length - 1; i >= 0; i--) {
    try { const p = JSON.parse(candidates[i]); if (p?.message !== undefined) return p } catch { /* next */ }
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
