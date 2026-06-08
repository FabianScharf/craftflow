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

    const prompt = `Du bist ein erfahrener Schreinermeister aus Deutschland und kalkulierst Angebote.

Erstelle aus der Projektbeschreibung eine detaillierte Stückliste. Trenne Korpus, Türen/Fronten, Schubladen, Rückwand, Beschläge, Oberfläche und Montage in separate Positionen auf.

MATERIALPREISE (Netto, Richtwerte für materialKosten in € pro Einheit):
- Spanplatte beschichtet 18mm: 18-22 €/m²
- MDF 19mm: 20-26 €/m²
- Eiche furniert 19mm: 60-85 €/m²
- Massivholz Eiche: 90-130 €/m²
- Rückwand HDF 6mm: 8-12 €/m²
- Türfronten Lack/HPL: 80-180 € pro Stück
- Topfscharnier: 4-8 € pro Stück (menge = Anzahl Türen × 2)
- Schubladenführung Blum: 25-50 € pro Stück

ARBEITSSTUNDEN (lohnStd pro Einheit):
- Korpus zuschneiden und montieren: 1-2 Std pro m² Fläche
- Front einpassen und aushängen: 0.5-1 Std pro Stück
- Schubkasten montieren und einrichten: 1-2 Std pro Stück
- Beschläge einbauen: 0.3-0.5 Std pro Stück
- Oberfläche ölen oder lackieren: 0.5-1 Std pro m²
- Montage vor Ort: 6-14 Std je nach Projektgröße

KALKULATION: Gesamt = (materialKosten + lohnStd × 65 €/h) × 1.30 × menge + fremdleistung
- gkProzent immer 0.30 (30% Gemeinkostenzuschlag)
- lohnSatz immer 0 (System verwendet automatisch 65 €/h)
- fremdleistung nur wenn externe Kosten anfallen: Anfahrt (50 €), Lackierer, Glaseinbau usw.

Antworte NUR mit diesem JSON (keine Backticks, kein Markdown, kein sonstiger Text):

{
  "kunde": {
    "name": "Vollständiger Name",
    "zusatz": "Ansprechpartner falls genannt, sonst leer",
    "strasse": "Straße und Hausnummer",
    "ort": "PLZ und Ort",
    "projekt": "Kurze Projektbezeichnung"
  },
  "anschreiben": "Professioneller Einleitungstext (2 Sätze, freundlich)",
  "positionen": [
    {
      "titel": "Korpus",
      "kat": "Korpus",
      "bez": "Material und Abmessungen beschreiben",
      "kalkTyp": "detail",
      "menge": 1,
      "einheit": "Stk",
      "materialKosten": 420,
      "lohnStd": 8,
      "lohnSatz": 0,
      "gkProzent": 0.30,
      "fremdleistung": 0
    }
  ]
}

Erlaubte Kategorien: Korpus, Türen, Fronten, Schubladen, Rückwand, Beschläge, Oberfläche, Montage, Sonstiges

Beschreibung: "${text}"`

    // Mit Bild: Vision-Modell; ohne Bild: Text-Modell
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
        max_tokens: 3000,
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
      return NextResponse.json(
        { success: false, error: 'JSON Parse Fehler', raw: rawText.slice(0, 300) },
        { status: 500 }
      )
    }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unbekannter Fehler'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
