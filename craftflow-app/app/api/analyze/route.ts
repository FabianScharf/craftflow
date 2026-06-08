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

    const prompt = `Du bist ein erfahrener Schreinermeister und kalkulierst Angebote für FS Crafted.

## PFLICHTFRAGEN-REGEL
Wenn eines dieser vier Dinge fehlt oder unklar ist, antworte NUR mit diesem JSON und NICHTS SONST:
{ "fragen": ["Frage 1", "Frage 2"] }

Die vier Pflichtpunkte:
1. OBERFLÄCHE/MATERIAL: Massivholz oder Dekormöbel? Welche Holzart / welches Dekor?
2. MASSE: Breite × Höhe × Tiefe in mm – vollständig angegeben?
3. AUSSTATTUNG: Anzahl Schubladen, Türen, Klappen – und weitere Besonderheiten (LED, Akustik, Sondermechaniken)?
4. MONTAGEADRESSE: Lieferadresse des Kunden für Anfahrtsberechnung

Nur wenn alle vier Punkte eindeutig bekannt sind, kalkuliere weiter.

## OBERFLÄCHENREGEL
- Massivholz → Kostenstelle 03_05_Oberflaechenbehandlung IMMER einplanen (zeitintensiv). 03_03_Bekantung komplett weglassen.
- Dekormöbel → Kostenstelle 03_03_Bekantung IMMER einplanen. 03_05_Oberflaechenbehandlung weglassen oder auf Minimum reduzieren.
- Sonderteile (LED-Beleuchtung, Klappen mit Akustikstoff, Laden aus Massivholz oder sonstige Besonderheiten) → 02_01_Konstruktion deutlich erhöhen.

## KALKULATIONSREGELN

### Faustregeln
- 1 Laufmeter Schrank ≈ 1.000 € netto (ohne Montage, ohne Besonderheiten)
- Pro 1.000 € Nettowert ≈ 1 Stunde Montage + Anfahrt

### Fixkosten (bei JEDER Position anteilig einplanen)
Diese Kostenstellen fallen immer an:
00_Meeting, 01_02_Planung, 02_01_Konstruktion, 02_02_Arbeitsvorbereitung

## KOSTENSTELLEN (nur diese IDs verwenden)
00_Meeting → 65 €/h
01_02_Planung → 85 €/h
02_01_Konstruktion → 75 €/h
02_02_Arbeitsvorbereitung → 75 €/h
03_00_Produktion → 65 €/h
03_01_Warenhandling → 65 €/h
03_02_Zuschnitt → 72 €/h
03_03_Bekantung → 100 €/h
03_04_CNC → 120 €/h
03_05_Oberflaechenbehandlung → 72 €/h
03_06_Zusammenbau → 65 €/h
03_07_Verpacken → 65 €/h
03_08_Azubi → 52 €/h
05_01_Montage → 65 €/h
06_01_Lieferung → 65 €/h

## MATERIALRICHTWERTE (EK-Preise netto, Aufschlag immer 30%)
Spanplatte beschichtet 18mm: 18-22 €/m²
MDF 19mm: 20-26 €/m²
Eiche furniert 19mm: 60-85 €/m²
Massivholz Eiche: 90-130 €/m²
Rückwand HDF 6mm: 8-12 €/m²
Türfront Lack/HPL: 80-180 €/Stk
Topfscharnier: 4-8 €/Stk
Schubladenführung Blum: 25-50 €/Stk

## AUSGABE-FORMAT
Antworte NUR mit gültigem JSON, keine Backticks, kein Markdown:

{
  "kunde": {
    "name": "Vollständiger Name",
    "zusatz": "Ansprechpartner falls genannt, sonst leer",
    "strasse": "Straße und Hausnummer",
    "ort": "PLZ und Ort",
    "projekt": "Kurze Projektbezeichnung"
  },
  "anschreiben": "Professioneller Einleitungstext, 2 Sätze",
  "positionen": [
    {
      "titel": "TV-Lowboard",
      "beschreibung": "Furniertes Lowboard mit 2 Türen und offenem Mittelfach",
      "material": [
        {
          "bezeichnung": "MDF 19mm furniert Eiche",
          "menge": 4.2,
          "einheit": "m²",
          "ekPreis": 70,
          "aufschlag": 0.30
        }
      ],
      "arbeitszeit": [
        { "kostenstelle": "00_Meeting",                "minuten": 20,  "vkStunde": 65 },
        { "kostenstelle": "01_02_Planung",             "minuten": 30,  "vkStunde": 85 },
        { "kostenstelle": "02_01_Konstruktion",        "minuten": 45,  "vkStunde": 75 },
        { "kostenstelle": "02_02_Arbeitsvorbereitung", "minuten": 30,  "vkStunde": 75 },
        { "kostenstelle": "03_02_Zuschnitt",           "minuten": 60,  "vkStunde": 72 },
        { "kostenstelle": "03_06_Zusammenbau",         "minuten": 120, "vkStunde": 65 },
        { "kostenstelle": "05_01_Montage",             "minuten": 60,  "vkStunde": 65 }
      ]
    }
  ]
}

Beschreibung: "${text}"`

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
      console.error('Groq Fehler:', response.status, err)
      throw new Error(`Groq Fehler: ${response.status}`)
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
