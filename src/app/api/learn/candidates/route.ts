import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import {
  diffOffer, pruefeKandidaten, istAusnahmeNachricht, beschreibeAenderung, BEREICHE,
  type LernOffer, type BestehendeRegel,
} from '@/lib/learn'

export const maxDuration = 60

const LEER = { kandidaten: [] as unknown[] }

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

    const body = await req.json() as {
      kiVorschlag?: LernOffer
      endstand?: LernOffer
      chatVerlauf?: string[]
      kundenWoerter?: string[]
      projektTitel?: string
    }

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) return NextResponse.json(LEER)

    // ── 1. Harte Fakten aus dem Code-Diff ──
    const aenderungen = diffOffer(body.kiVorschlag ?? {}, body.endstand ?? {})

    // ── 2. Chat filtern: Einmal-Ausnahmen sind keine Signalquelle ──
    const chat = (Array.isArray(body.chatVerlauf) ? body.chatVerlauf : [])
      .filter(m => typeof m === 'string' && m.trim() !== '')
      .filter(m => !istAusnahmeNachricht(m))

    if (aenderungen.length === 0 && chat.length === 0) return NextResponse.json(LEER)

    // ── 3. Bestehende Regeln für den Abgleich ──
    const { data: bestehendRoh, error: bestehendErr } = await supabase
      .from('bauweise_regeln')
      .select('id, bereich, wenn')
      .eq('user_id', user.id)
      .eq('aktiv', true)
    // Fehler hier ist nicht fatal (der Abgleich fällt dann aus), darf aber nicht
    // spurlos verschwinden: sonst degradiert die Konflikt-Erkennung dauerhaft und
    // still, z.B. bei einer kaputten RLS-Policy.
    if (bestehendErr) console.error('[learn] bestehende Regeln:', bestehendErr.message)
    const bestehend = (bestehendRoh ?? []) as BestehendeRegel[]

    // ── 4. KI formuliert — darf nur beschreiben, was schon belegt ist ──
    const aenderungsListe = aenderungen.length > 0
      ? aenderungen.map(a => `${a.nr}. ${beschreibeAenderung(a)}`).join('\n')
      : '(keine strukturellen Änderungen erkannt)'
    const chatListe = chat.length > 0
      ? chat.map(m => `- ${m}`).join('\n')
      : '(keine Chat-Nachrichten)'

    const system = `Du wertest aus, welche dauerhaften Bauweise-Gewohnheiten eines Schreiners hinter seinen Korrekturen an einem KI-Kalkulationsvorschlag stecken.

AUSGABEFORMAT: Deine gesamte Antwort ist GENAU EIN JSON-Array. Kein Text davor, kein Text danach, keine Backticks. Keine Kandidaten → [].

Jedes Element:
{"bereich":"...","wenn":"...","dann":"...","belegt_durch":{"art":"diff","nr":ZAHL}}
oder
{"bereich":"...","wenn":"...","dann":"...","belegt_durch":{"art":"zitat","text":"WÖRTLICHES ZITAT"}}

REGELN:
- "bereich" ist genau einer von: ${BEREICHE.join(', ')}
- "wenn" ist die Bedingung (z.B. "Korpus mit Rückwand"). Gilt die Regel immer, ist "wenn" ein leerer String.
- "dann" ist die Gewohnheit in einem knappen Satz, aus Sicht des Betriebs formuliert.
- BELEGPFLICHT: Jeder Kandidat MUSS auf eine Nummer aus der Änderungsliste zeigen ODER ein WÖRTLICHES, unverändertes Zitat aus einer Nutzer-Nachricht enthalten. Erfinde nichts. Kandidaten ohne gültigen Beleg werden verworfen.
- Änderungen, die erkennbar einmalig oder kundenspezifisch sind, ergeben KEINE Regel.
- Keine Namen, Adressen oder Orte von Kunden in "wenn" oder "dann".
- Keine Regeln über Stundensätze, Materialaufschläge oder Preise — die stellt der Nutzer separat ein.
- Fasse zusammen: lieber 1–3 tragfähige Regeln als 8 Kleinigkeiten.`

    const userContent = `ÄNDERUNGEN (belegt, nummeriert):
${aenderungsListe}

NACHRICHTEN DES NUTZERS:
${chatListe}`

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1500,
        temperature: 0,
        system,
        messages: [{ role: 'user', content: userContent }],
      }),
    })
    if (!res.ok) {
      console.error('[learn] Claude', res.status, (await res.text()).slice(0, 300))
      return NextResponse.json(LEER)
    }

    const data = await res.json() as { content?: Array<{ text?: string }> }
    const raw = (data.content?.[0]?.text ?? '').replace(/```json\n?|```/g, '').trim()

    let rohKandidaten: unknown = null
    try {
      rohKandidaten = JSON.parse(raw)
    } catch {
      // Fallback: das erste eckige-Klammer-Paar herausschneiden
      const von = raw.indexOf('[')
      const bis = raw.lastIndexOf(']')
      if (von !== -1 && bis > von) {
        try { rohKandidaten = JSON.parse(raw.slice(von, bis + 1)) } catch { /* aufgeben */ }
      }
    }
    if (rohKandidaten === null) {
      console.error('[learn] Antwort nicht parsebar:', raw.slice(0, 300))
      return NextResponse.json(LEER)
    }

    // ── 5. Belegprüfung, Datenschutzfilter, Vault-Abgleich ──
    const kundenWoerter = Array.isArray(body.kundenWoerter)
      ? body.kundenWoerter.filter((w): w is string => typeof w === 'string')
      : []
    const geprueft = pruefeKandidaten(rohKandidaten, aenderungen, chat, kundenWoerter, bestehend)

    // Regeln, zu denen es einen widersprechenden Kandidaten gibt, markieren.
    // Das ist laut Design das verlässlichste Signal dafür, dass eine Regel nicht
    // mehr greift — der Nutzer sieht es im Vault. Fehler hier sind nicht fatal:
    // die Kandidaten sind trotzdem brauchbar.
    // Eigenes try/catch: ein GEWORFENER Fehler (statt eines zurückgegebenen)
    // würde sonst im äußeren catch landen und die bereits berechneten — und
    // bereits bezahlten — Kandidaten verwerfen. Der Dialog erschiene dann nicht,
    // obwohl der KI-Aufruf erfolgreich war.
    try {
      const konfliktIds = [...new Set(geprueft.map(k => k.aendertRegelId).filter((id): id is string => !!id))]
      if (konfliktIds.length > 0) {
        const { error: markErr } = await supabase
          .from('bauweise_regeln')
          .update({ konflikt_hinweis: true })
          .in('id', konfliktIds)
          .eq('user_id', user.id)
        if (markErr) console.error('[learn] konflikt_hinweis:', markErr.message)
      }
    } catch (e) { console.error('[learn] konflikt_hinweis:', e) }

    const titel = (body.projektTitel ?? '').trim()
    const datum = new Date().toLocaleDateString('de-DE')
    const quelle = titel ? `gelernt am ${datum} aus Angebot „${titel}"` : `gelernt am ${datum}`

    return NextResponse.json({
      kandidaten: geprueft.map(k => ({ ...k, quelle_text: quelle })),
    })
  } catch (e: unknown) {
    // Lernen darf NIE den Speichervorgang stören → immer 200 mit leerer Liste.
    console.error('[learn]', e instanceof Error ? e.message : e)
    return NextResponse.json(LEER)
  }
}
