import { NextRequest, NextResponse } from 'next/server'
import { normalizeKsId, DEFAULT_STUNDENSAETZE } from '@/lib/types'
import { createClient } from '@/utils/supabase/server'
import { regelBlockFuerNutzer, zaehleRegelnHoch } from '@/lib/bauweise'

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

function looksLikeOffer(p: unknown): p is { positionen?: unknown; kunde?: unknown } {
  return !!p && typeof p === 'object' && ('positionen' in p || 'kunde' in p)
}

type AZ = { kostenstelle: string; minuten: number; vkStunde: number }
type MatItem = { bezeichnung?: string; aufschlag?: number; [key: string]: unknown }
type Pos = { arbeitszeit?: AZ[]; material?: MatItem[]; [key: string]: unknown }

// Same matching logic as /api/analyze — case-insensitive substring match,
// longest (most specific) Materialgruppe name wins. Returns null if nothing
// matches, so callers leave the LLM's own aufschlag untouched rather than guess.
function matchMaterialgruppe(
  bezeichnung: string,
  matGruppen: Array<{ name: string; aufschlag_prozent: number }>
): number | null {
  const text = bezeichnung.toLowerCase()
  let best: { name: string; aufschlag_prozent: number } | null = null
  for (const g of matGruppen) {
    if (text.includes(g.name.toLowerCase()) && (!best || g.name.length > best.name.length)) best = g
  }
  return best ? best.aufschlag_prozent / 100 : null
}

// Deterministically overwrites vkStunde and Material-Aufschlag with the
// user's actual Firmeneinstellungen — never trusts the LLM's own numbers
// here. Fixes the 2026-07-04 incident where the optimizer had no access to
// Firmeneinstellungen at all and just kept/invented values from whatever was
// already in the offer JSON.
function applyUserRates(
  offer: Record<string, unknown>,
  customSaetze: Record<string, number>,
  matGruppen: Array<{ name: string; aufschlag_prozent: number }>,
  deaktiviert: Set<string> = new Set()
): Record<string, unknown> {
  const positionen = offer.positionen
  if (!Array.isArray(positionen)) return offer
  const activeSaetze: Record<string, number> = { ...DEFAULT_STUNDENSAETZE, ...customSaetze }
  offer.positionen = positionen.map((raw: unknown) => {
    const pos = raw as Pos
    const arbeitszeit = Array.isArray(pos.arbeitszeit)
      ? pos.arbeitszeit
          .filter(a => !deaktiviert.has(normalizeKsId(a.kostenstelle)))
          .map(a => (a.kostenstelle in activeSaetze ? { ...a, vkStunde: activeSaetze[a.kostenstelle] } : a))
      : pos.arbeitszeit
    const material = Array.isArray(pos.material)
      ? pos.material.map(m => {
          const matched = matGruppen.length > 0 ? matchMaterialgruppe(m.bezeichnung ?? '', matGruppen) : null
          return matched !== null ? { ...m, aufschlag: matched } : m
        })
      : pos.material
    return { ...pos, arbeitszeit, material }
  })
  return offer
}

function extractJSON(text: string): { message: string; updatedOffer: unknown } | null {
  const clean = text.replace(/```json\n?|```/g, '').trim()

  // Direct parse (happy path)
  try {
    const p = JSON.parse(clean)
    if (p?.message !== undefined) return p
    // Model skipped the {message, updatedOffer} wrapper and returned the offer directly
    if (looksLikeOffer(p)) return { message: 'Kalkulation aktualisiert.', updatedOffer: p }
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
    try {
      const p = JSON.parse(candidates[i])
      if (p?.message !== undefined) return p
      if (looksLikeOffer(p)) return { message: 'Kalkulation aktualisiert.', updatedOffer: p }
    } catch { /* next */ }
  }

  return null
}

export async function POST(req: NextRequest) {
  try {
    const { offerData, chatHistory, message, userKostenstellen, userMaterialgruppen, deaktivierteKostenstellen } = await req.json() as {
      offerData: unknown
      chatHistory: ChatMsg[]
      message: string
      userKostenstellen?: Array<{ code: string; bezeichnung: string; stundensatz: number; gruppe?: string | null }>
      userMaterialgruppen?: Array<{ name: string; aufschlag_prozent: number }>
      deaktivierteKostenstellen?: string[]
    }

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'Kein API Key konfiguriert' }, { status: 500 })

    const customKs = Array.isArray(userKostenstellen) ? userKostenstellen : []
    // Keyed by normalizeKsId(code) — bezeichnung is free user-edited text and
    // can diverge from the AI's fixed kostenstelle vocabulary (e.g. code
    // 03_01_Warenhandling saved with bezeichnung "Warenwirtschaft"), and code
    // alone doesn't match either. normalizeKsId(code) via LEGACY_KS_MAP is
    // the one stable mapping to the canonical name (2026-07-04 Vorfall #3).
    // Standard-KS per normalizeKsId(code); eigene (nicht-Standard) KS zusätzlich
    // per bezeichnung, da die KI sie unter ihrer bezeichnung ausgibt.
    const customSaetze: Record<string, number> = {}
    const eigeneKs: Array<{ bezeichnung: string; stundensatz: number }> = []
    for (const k of customKs) {
      const id = normalizeKsId(k.code)
      customSaetze[id] = k.stundensatz
      if (!(id in DEFAULT_STUNDENSAETZE)) {
        customSaetze[k.bezeichnung] = k.stundensatz
        eigeneKs.push({ bezeichnung: k.bezeichnung, stundensatz: k.stundensatz })
      }
    }
    const deaktiviert = new Set<string>(
      (Array.isArray(deaktivierteKostenstellen) ? deaktivierteKostenstellen : []).map(c => normalizeKsId(c))
    )
    const matGruppen = Array.isArray(userMaterialgruppen) ? userMaterialgruppen : []

    // Firmenstandort des Nutzers aus dem Betriebsprofil — Anfahrt IMMER von dort.
    // Im selben Zug: gelernte Bauweise-Regeln dieses Nutzers (Bauweise-Vault),
    // serverseitig geladen, nicht vom Frontend geschickt.
    let firmenStandort = ''
    let regelBlock = ''
    let regelIds: string[] = []
    let supabaseFuerZaehler: Awaited<ReturnType<typeof createClient>> | null = null
    try {
      const supabase = await createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: profil } = await supabase
          .from('betriebsprofil')
          .select('strasse, plz, ort')
          .eq('user_id', user.id)
          .single()
        if (profil) {
          const ortLine = [profil.plz, profil.ort].filter(Boolean).join(' ')
          firmenStandort = [profil.strasse, ortLine].filter(Boolean).join(', ')
        }
        try {
          const r = await regelBlockFuerNutzer(supabase, user.id)
          regelBlock = r.block
          regelIds = r.ids
          supabaseFuerZaehler = supabase
        } catch (e) { console.error('[learn] Regeln laden (optimize):', e) }
      }
    } catch { /* kein Profil → Default */ }

    let system = SYSTEM_BASE + `\n\n== AKTUELLES ANGEBOT (JSON) ==\n${JSON.stringify(offerData, null, 2)}`
    const standardLines = customKs.filter(k => normalizeKsId(k.code) in DEFAULT_STUNDENSAETZE).map(k => `${normalizeKsId(k.code)} → ${k.stundensatz} €/h`)
    if (standardLines.length > 0) {
      system += '\n\n== ECHTE STUNDENSÄTZE DIESES NUTZERS (verbindlich, ersetzen alle anderen Werte im JSON) ==\n' + standardLines.join('\n') +
        '\nVerwende IMMER diese Sätze für vkStunde, auch wenn im Angebot-JSON andere Werte stehen — die JSON-Werte können veraltet sein.'
    }
    if (deaktiviert.size > 0) {
      system += '\n\n== DIESE KOSTENSTELLEN NICHT VERWENDEN (vom Nutzer deaktiviert) ==\n' + [...deaktiviert].join(', ') +
        '\nEntferne sie aus arbeitszeit und nimm sie nie neu auf.'
    }
    if (eigeneKs.length > 0) {
      system += '\n\n== ZUSÄTZLICH ERLAUBTE EIGENE KOSTENSTELLEN ==\n' + eigeneKs.map(k => `${k.bezeichnung} (${k.stundensatz} €/h)`).join('\n') +
        '\nNur verwenden, wenn die Arbeit inhaltlich passt und nicht schon von einer Standard-Kostenstelle abgedeckt ist. Als "kostenstelle" exakt die Bezeichnung schreiben. Jede Arbeit nur EINER Kostenstelle zuordnen, nie doppelt.'
    }
    if (matGruppen.length > 0) {
      const lines = matGruppen.map(m => `${m.name} → ${m.aufschlag_prozent}%`)
      system += '\n\n== ECHTE MATERIALAUFSCHLÄGE DIESES NUTZERS (verbindlich, ersetzen alle anderen Werte im JSON) ==\n' + lines.join('\n') +
        '\nOrdne jedes Material der passenden Gruppe zu und verwende deren Aufschlag, auch wenn im Angebot-JSON andere Werte stehen.'
    }
    if (firmenStandort) {
      system += '\n\n== FIRMENSTANDORT DES NUTZERS (verbindlich für Anfahrt & Fahrtzeit) ==\n' + firmenStandort +
        '\nAnfahrt/Fahrtzeit (Montage & Lieferung) IMMER von diesem Standort berechnen — NIEMALS ab Rodenbach.'
    }
    // MUSS ganz am Ende stehen: der Block trägt einen Vorrang-Satz und muss
    // nach dem allgemeinen Fachwissen kommen, sonst gewinnt weiter die
    // generische Vorgabe (z. B. 6 mm HPL-Rückwand).
    system += regelBlock

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
    if (supabaseFuerZaehler && regelIds.length > 0) zaehleRegelnHoch(supabaseFuerZaehler, regelIds)

    const data = await res.json() as { content?: Array<{ text?: string }> }
    const raw = data.content?.[0]?.text ?? ''

    const parsed = extractJSON(raw)
    if (parsed) {
      const updatedOffer = parsed.updatedOffer
        ? applyUserRates(parsed.updatedOffer as Record<string, unknown>, customSaetze, matGruppen, deaktiviert)
        : null
      return NextResponse.json({ success: true, message: parsed.message, updatedOffer })
    }
    console.error('[optimize] unparsable response:', raw.slice(0, 500))
    return NextResponse.json({
      success: true,
      message: 'Antwort konnte nicht verarbeitet werden. Bitte die Anfrage anders formulieren oder erneut senden.',
      updatedOffer: null,
    })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unbekannter Fehler'
    console.error('[optimize]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
