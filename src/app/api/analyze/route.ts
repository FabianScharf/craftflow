import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { text, imageBase64 } = await req.json()

    if (!text && !imageBase64) {
      return NextResponse.json({ error: 'Kein Text oder Bild' }, { status: 400 })
    }

    const apiKey = process.env.GROQ_API_KEY
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

    // Mit Bild: Vision-Modell, ohne Bild: Text-Modell
    let model: string
    let content: string | object[]

    if (imageBase64) {
      model = 'meta-llama/llama-4-scout-17b-16e-instruct'
      const imageUrl = imageBase64.startsWith('data:')
        ? imageBase64
        : `data:image/jpeg;base64,${imageBase64}`
      content = [
        { type: 'image_url', image_url: { url: imageUrl } },
        { type: 'text', text: 'Das ist ein Foto der Situation vor Ort. Berücksichtige es.\n\n' + prompt },
      ]
    } else {
      model = 'llama-3.3-70b-versatile'
      content = prompt
    }

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content }],
        temperature: 0.2,
        max_tokens: 2000,
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      console.error('Groq Fehler:', response.status, response.statusText, err)
      throw new Error(`Groq Fehler: ${response.status} – ${err}`)
    }

    const data = await response.json()
    const rawText = data.choices?.[0]?.message?.content || ''

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
