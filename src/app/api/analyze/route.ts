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

## SCHRITT 1 – PFLICHTPRÜFUNG (ZWINGEND VOR JEDER KALKULATION)

BEVOR du eine Kalkulation erstellst, prüfe diese vier Punkte. Fehlt auch nur EINER, antworte AUSSCHLIESSLICH mit:
{"fragen":["konkrete Frage 1","konkrete Frage 2"]}
KEIN Angebot, KEINE Positionen, KEIN weiterer Text. Nur dieses JSON.

Die vier Pflichtpunkte – alle müssen erfüllt sein:
1. OBERFLÄCHE: Ist eindeutig bekannt ob Massivholz oder Dekormöbel? Welche Holzart / welches Dekor?
   → Fehlt: fragen nach "Massivholz oder Dekormöbel, und welche Holzart?"
2. MASSE: Sind Breite UND Höhe UND Tiefe in mm vollständig angegeben?
   → Fehlt: fragen nach den fehlenden Maßen
3. AUSSTATTUNG: Ist die genaue Anzahl von Schubladen, Türen und Klappen bekannt? Besonderheiten (LED, Akustik, Mechaniken)?
   → Fehlt: fragen nach Anzahl und Besonderheiten
4. MONTAGEADRESSE: Ist eine konkrete Lieferadresse des Kunden genannt?
   → Fehlt immer wenn keine Straße + Ort angegeben: fragen nach "Wo soll montiert werden (Straße, Ort)?"

Keine Ausnahmen. Keine Schätzungen. Keine Platzhalter-Adressen. Wenn Montageadresse fehlt → IMMER fragen.

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

## ZEITRICHTWERTE (Minuten pro Einheit – für realistische Kalkulation)

### Materialmengen
- Standardschrank 200x100x58cm: 8-12 m2 Plattenmaterial (Dekormöbel), 12-18 m2 (Massivholz)
- Massivholz-Multiplikator: 1.4x mehr Fläche als Dekormöbel (Rahmen-Füllung-Konstruktion)

### Zeitrichtwerte pro Schublade
- Zuschnitt: 20 min
- Bekantung (Dekormöbel): 15 min
- Zusammenbau: 45 min
- Gesamtaufwand pro Schublade: 60-90 min (inkl. Führungsmontage)

### LED-Beleuchtung (pro Schrank/Position)
- Konstruktion zusätzlich: 30 min (Kabelführung planen)
- Produktion/Einbau zusätzlich: 45 min

### Zeitrahmen gesamt (Plausibilitätscheck)
- Einfacher 1-türiger Schrank: 4-6 Std. Produktion
- Schrank 3-türig mit 3 Schubladen: 8-12 Std. Produktion
- Küchenanlage oder Büroanlage 4m: 20-30 Std. Produktion

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
