import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { text, imageBase64, mode } = await req.json()

    if (!text && !imageBase64) {
      return NextResponse.json({ error: 'Kein Text oder Bild' }, { status: 400 })
    }

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'Kein API Key konfiguriert' }, { status: 500 })
    }

    const prompt = `Du bist ein erfahrener Schreinermeister aus Deutschland.
Analysiere diese Projektbeschreibung und extrahiere alle Informationen.
Antworte NUR mit diesem JSON (keine Backticks, kein Markdown, kein sonstiger Text):

{
  "kunde": {
    "name": "Vollständiger Name (NUR den Namen, ohne 'meine Kundin' oder ähnliches)",
    "zusatz": "Ansprechpartner falls genannt, sonst leer",
    "strasse": "Straße und Hausnummer",
    "ort": "PLZ und Ort",
    "projekt": "Kurze Projektbezeichnung (z.B. TV-Board, Einbauschrank)"
  },
  "anschreiben": "Professioneller Einleitungstext für das Angebot (2 Sätze, freundlich)",
  "positionen": [
    {
      "titel": "Bezeichnung der Leistung",
      "kat": "Schrank oder Schreibtisch oder Montage oder Sonstiges",
      "bez": "Detaillierte Beschreibung mit Material, Maßen, Besonderheiten",
      "kalkTyp": "pauschale oder qm oder lfm oder stunden",
      "menge": 1,
      "einheit": "Stk oder m² oder lfd. m oder Std oder Pausch.",
      "ep": 0
    }
  ]
}

Kalkulationshinweise (realistisch, leicht unter Markt):
- Einbauschränke: 350-450 €/m²
- Massivholz-Möbel Pauschale: 800-3000 € je Komplexität
- TV-Boards/Sideboards: 800-2500 € Pauschale
- Wandpaneele/Lamellen: 350-500 €/m²
- Organoid/Naturmaterialien Rückwand: 280-380 €/m²
- Türen/Fronten: 300-450 € Stück
- Schubladen: 250-400 € Stück
- Montage: 65 €/Std, typisch 6-14 Std je Projekt
- Extrahiere Maße wenn genannt

Beschreibung: "${text}"`

    // Gemini API aufrufen
    const parts: object[] = []

    // Bild hinzufügen falls vorhanden
    if (imageBase64) {
      const base64Match = imageBase64.match(/^data:([^;]+);base64,(.+)$/)
      const mimeType = base64Match ? base64Match[1] : 'image/jpeg'
      const base64Data = base64Match ? base64Match[2] : imageBase64
      parts.push({
        inlineData: {
          mimeType,
          data: base64Data,
        },
      })
      parts.push({ text: 'Das ist ein Foto der Situation vor Ort. Berücksichtige es.' })
    }

    parts.push({ text: prompt })

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 2000,
          },
        }),
      }
    )

    if (!response.ok) {
      const err = await response.text()
      throw new Error(`Gemini Fehler: ${response.status} – ${err.slice(0, 200)}`)
    }

    const data = await response.json()
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || ''

    // JSON bereinigen
    const clean = rawText.replace(/```json|```/g, '').trim()

    try {
      const parsed = JSON.parse(clean)
      return NextResponse.json({ success: true, data: parsed })
    } catch {
      return NextResponse.json({ success: false, error: 'JSON Parse Fehler', raw: rawText.slice(0, 300) }, { status: 500 })
    }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unbekannter Fehler'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
