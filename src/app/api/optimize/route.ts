import { NextRequest, NextResponse } from 'next/server'
import { normalizeKsId, DEFAULT_STUNDENSAETZE } from '@/lib/types'
import { createClient } from '@/utils/supabase/server'
import { regelBlockFuerNutzer, zaehleRegelnHoch, speichereRegel } from '@/lib/bauweise'
import { preisBlockFuerNutzer, speicherePreis } from '@/lib/preisspeicher'
import {
  WERKZEUGE, pruefePreisInhalt,
  unbelegteWoerter, bereinigeWenn, baueBelegquellen,
} from '@/lib/lernwerkzeuge'

export const maxDuration = 120

type ChatMsg = { role: 'user' | 'assistant'; content: string }

const SYSTEM_BASE = `Du bist Kalkulationsassistent für FS Crafted (Schreiner, Rodenbach). Du hilfst Angebote zu vervollständigen und zu verbessern.

KRITISCH – AUSGABEFORMAT:
Dein TEXT besteht aus GENAU EINEM gültigen JSON-Objekt. Kein Text davor, kein Text danach, keine Erklärungen, keine Backticks.
AUSNAHME: Werkzeugaufrufe (regel_merken, preis_merken) sind kein Text. Sie stehen NICHT im JSON, sondern werden als Werkzeug ausgeführt. Du darfst ein Werkzeug aufrufen UND im selben Zug dein JSON liefern.
Nach jedem Werkzeug-Ergebnis lieferst du IMMER dein JSON-Objekt — auch wenn du nur bestätigst, dass etwas gemerkt wurde. Ohne JSON kommt beim Nutzer nichts an.

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
- Kostenstellen-IDs (exakt so): Besprechung, Planung, Konstruktion, Arbeitsvorbereitung, Produktion, Warenhandling, Zuschnitt, Bekantung, CNC, Oberfläche, Zusammenbau, Verpacken, Azubi, Montage, Lieferung

LERNEN – WANN DU FRAGST:
- Sagt der Nutzer ausdrücklich "immer", "standardmäßig", "grundsätzlich" oder ähnlich, zeige am Ende deiner "message" den GENAUEN Regeltext in Anführungszeichen und frage, ob der Wortlaut so passt.
- Ändert er dasselbe Merkmal zum ZWEITEN Mal in diesem Angebot, frage ebenfalls.
- Höchstens EINE Frage pro Antwort. Nie eine Frage wiederholen, die er gerade verneint hat.
- Stimmt er zu, rufe regel_merken bzw. preis_merken auf — mit EXAKT dem Wortlaut, den du ihm gezeigt hast. Ohne Zustimmung nie.
- Formuliere den Regeltext aus seinen Worten. Lehnt ein Werkzeug ab, nennt dir die Antwort die beanstandeten Wörter: formuliere ohne sie und rufe es erneut auf.
- Nennt er einen Einkaufspreis und will ihn dauerhaft, nutze preis_merken.
- Existiert zu einem Material bereits ein fixierter Preis und er ändert ihn, frage, ob der hinterlegte Preis nachgezogen werden soll. Für dieses Angebot gilt sein Wert in jedem Fall.

WAS DU NIE ZUSAGEN DARFST:
Du kannst dir NUR Bauweise-Regeln und Einkaufspreise merken. Stundensätze, Materialaufschläge und Verkaufspreise kannst du NICHT dauerhaft merken. Sage dort niemals "merke ich mir", sondern: "Für dieses Angebot übernommen – dauerhaft merken kann ich mir das nicht, das stellst du unter Einstellungen ein."
Behaupte NIE eine Änderung am Angebot, die du nicht lieferst. Schreibst du "für dieses Angebot übernommen" oder "trage ich ein", dann MUSS im selben Zug updatedOffer mit genau dieser Änderung kommen. Kannst oder willst du nichts ändern, sage nur, was künftig gilt.`

// Sammelt alles, was im Angebot wirklich steht — Belegquelle fuer den
// Erfindungsschutz. Nur was hier oder in den Nutzernachrichten vorkommt, darf
// gemerkt werden.
function sammleAngebotstexte(offer: unknown): string[] {
  const texte: string[] = []
  const o = offer as { positionen?: Array<Record<string, unknown>> } | null
  for (const pos of o?.positionen ?? []) {
    if (typeof pos.titel === 'string') texte.push(pos.titel)
    if (typeof pos.beschreibung === 'string') texte.push(pos.beschreibung)
    for (const m of (pos.material as Array<Record<string, unknown>> | undefined) ?? []) {
      if (typeof m.bezeichnung === 'string') texte.push(m.bezeichnung)
      if (typeof m.ek === 'number') texte.push(String(m.ek))
    }
    for (const a of (pos.arbeitszeit as Array<Record<string, unknown>> | undefined) ?? []) {
      if (typeof a.kostenstelle === 'string') texte.push(a.kostenstelle)
    }
  }
  return texte
}

// `grund` ist der Klartext fuer den Nutzer, wenn am Ende gar nichts geklappt
// hat. `meldung` meldet Erfolge sofort; eine Ablehnung darf die KI erst noch
// selbst ausbuegeln, ohne dass es im Chat rauscht.
type WerkzeugAntwort = { ok: boolean; text: string; meldung: string; grund?: string }

// Fuehrt einen Werkzeugaufruf aus. Prueft VOR dem Speichern, ob der Inhalt
// belegt ist. Wird abgelehnt, bekommt die KI den Grund als Fehler zurueck —
// sie darf es dann nicht stillschweigend erneut versuchen.
async function fuehreWerkzeugAus(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  belegquellen: string[],
  name: string,
  input: Record<string, unknown>,
): Promise<WerkzeugAntwort> {
  if (!userId) {
    return { ok: false, text: 'Nicht eingeloggt, nichts gespeichert.', meldung: '' }
  }

  if (name === 'regel_merken') {
    const bereich = String(input.bereich ?? '')
    const wenn = bereinigeWenn(String(input.wenn ?? ''))
    const dann = String(input.dann ?? '').trim()
    if (!dann) {
      return { ok: false, text: 'Feld "dann" ist leer.', meldung: '',
        grund: 'Es kam kein Regeltext an.' }
    }
    const offen = unbelegteWoerter(dann, belegquellen)
    if (offen.length > 0) {
      return {
        ok: false,
        text: 'Abgelehnt: Diese Woerter kommen weder im Angebot noch im bisherigen Chat vor: '
          + offen.join(', ') + '. Formuliere die Regel ausschliesslich aus dem, was wirklich '
          + 'dasteht — oder zeige dem Nutzer deinen Wortlaut und frage, ob er so passt.',
        meldung: '',
        grund: 'Die Regel enthielt Woerter, die so nicht gefallen sind: ' + offen.join(', ') + '.',
      }
    }
    const beleg = String(input.quelle ?? '') === 'wiederholung'
      ? 'Zweimal im selben Angebot geaendert'
      : 'Vom Nutzer im Chat gesagt'
    const r = await speichereRegel(supabase, userId, { bereich, wenn, dann, beleg })
    if (!r.ok) return { ok: false, text: `Speichern fehlgeschlagen: ${r.grund}`, meldung: `Regel nicht gespeichert: ${r.grund}` }
    return {
      ok: true,
      text: r.aktualisiert ? 'Bestehende Regel aktualisiert.' : 'Regel gespeichert.',
      meldung: r.aktualisiert ? 'Regel aktualisiert.' : 'Regel gemerkt.',
    }
  }

  if (name === 'preis_merken') {
    const bezeichnung = String(input.bezeichnung ?? '').trim()
    const ek = Number(input.ek)
    const einheit = String(input.einheit ?? 'Stk')
    if (!bezeichnung) return { ok: false, text: 'Feld "bezeichnung" ist leer.', meldung: '' }
    if (!pruefePreisInhalt(bezeichnung, ek, belegquellen)) {
      return {
        ok: false,
        text: 'Abgelehnt: Material oder Betrag kommen weder im Angebot noch im Chat vor. '
          + 'Einkaufspreise nie schaetzen — frage den Nutzer nach dem Preis.',
        meldung: '',
        grund: 'Material oder Betrag kamen im Chat nicht vor.',
      }
    }
    const r = await speicherePreis(supabase, userId, { bezeichnung, ek, einheit })
    if (!r.ok) return { ok: false, text: `Speichern fehlgeschlagen: ${r.grund}`, meldung: `Preis nicht gespeichert: ${r.grund}` }
    return {
      ok: true,
      text: r.aktualisiert ? 'Bestehenden Preis aktualisiert.' : 'Preis fixiert.',
      meldung: r.aktualisiert ? 'Preis aktualisiert.' : 'Preis fixiert.',
    }
  }

  return { ok: false, text: `Unbekanntes Werkzeug: ${name}`, meldung: '' }
}

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
    let preisBlock = ''
    let regelIds: string[] = []
    let supabaseFuerZaehler: Awaited<ReturnType<typeof createClient>> | null = null
    let nutzerId = ''
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
        nutzerId = user.id
        try {
          const r = await regelBlockFuerNutzer(supabase, user.id)
          regelBlock = r.block
          regelIds = r.ids
          supabaseFuerZaehler = supabase
        } catch (e) { console.error('[learn] Regeln laden (optimize):', e) }
        // Getrennter Block: Bauweise-Regeln dürfen nie Preise setzen, Preise nie Bauweise.
        try { preisBlock = await preisBlockFuerNutzer(supabase, user.id) }
        catch (e) { console.error('[preise] Preise laden (optimize):', e) }
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
    system += preisBlock

    const messages: ChatMsg[] = [
      ...chatHistory,
      { role: 'user', content: message },
    ]

    // Belegquellen für den Erfindungsschutz: was wirklich im Angebot steht und
    // was der Nutzer wirklich geschrieben hat. Nichts anderes darf gemerkt werden.
    // Fabians Entscheidung 2026-09-06: Er bestaetigt den Wortlaut. Deshalb zaehlt
    // auch, was die KI ihm in FRUEHEREN Runden gezeigt hat — `chatHistory` enthaelt
    // nie die laufende Antwort, sie kann also nicht im selben Zug erfinden und
    // speichern. Vorher zaehlten nur Nutzernachrichten; jede eigene Formulierung
    // der KI fiel damit durch, auch eine voellig treue (gemessen 2026-09-06).
    const belegquellen: string[] = baueBelegquellen(
      sammleAngebotstexte(offerData), chatHistory, message)

    type Block = Record<string, unknown> & { type: string }
    type ApiMsg = { role: 'user' | 'assistant'; content: string | Block[] }
    const verlauf: ApiMsg[] = [...messages]
    const werkzeugMeldungen: string[] = []
    const werkzeugFehler: string[] = []
    let data: { content?: Block[]; stop_reason?: string } = {}

    // Höchstens drei Runden. Ohne Obergrenze wäre eine Schleife aus Aufruf und
    // Ablehnung ein offenes Kostenrisiko — jede Runde ist ein bezahlter Aufruf.
    for (let runde = 0; runde < 3; runde++) {
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
          tools: WERKZEUGE,
          messages: verlauf,
        }),
      })

      if (!res.ok) {
        const err = await res.text()
        throw new Error(`Claude ${res.status}: ${err.slice(0, 300)}`)
      }

      data = await res.json() as { content?: Block[]; stop_reason?: string }
      if (data.stop_reason !== 'tool_use') break

      const aufrufe = (data.content ?? []).filter(b => b.type === 'tool_use')
      if (aufrufe.length === 0) break

      // Alle Ergebnisse gehören in EINE Nutzernachricht. Aufgeteilt auf mehrere
      // gewöhnt man dem Modell parallele Werkzeugaufrufe ab.
      const ergebnisse: Block[] = []
      for (const a of aufrufe) {
        const r = supabaseFuerZaehler
          ? await fuehreWerkzeugAus(
              supabaseFuerZaehler, nutzerId, belegquellen,
              String(a.name ?? ''), (a.input ?? {}) as Record<string, unknown>)
          : { ok: false, text: 'Nicht eingeloggt, nichts gespeichert.', meldung: '' }
        ergebnisse.push({ type: 'tool_result', tool_use_id: a.id, content: r.text, is_error: !r.ok })
        if (r.meldung) werkzeugMeldungen.push(r.meldung)
        if (!r.ok && r.grund) werkzeugFehler.push(r.grund)
      }

      verlauf.push({ role: 'assistant', content: data.content ?? [] })
      verlauf.push({ role: 'user', content: ergebnisse })
    }

    try { if (supabaseFuerZaehler && regelIds.length > 0) zaehleRegelnHoch(supabaseFuerZaehler, regelIds) }
    catch (e) { console.error('[learn] zaehleRegelnHoch:', e) }

    // Alle Textblöcke zusammen — bei Werkzeugnutzung kann die Antwort aus
    // mehreren bestehen, content[0] allein würde Text verlieren.
    const raw = (data.content ?? [])
      .filter(b => b.type === 'text')
      .map(b => String(b.text ?? ''))
      .join('')

    const parsed = extractJSON(raw)
    if (parsed) {
      const updatedOffer = parsed.updatedOffer
        ? applyUserRates(parsed.updatedOffer as Record<string, unknown>, customSaetze, matGruppen, deaktiviert)
        : null
      // Was das Werkzeug getan hat, gehört sichtbar in den Chat — auch und
      // gerade der Fehlerfall. Fehler verschlucken war der Fehler von gestern.
      const zusatz = werkzeugMeldungen.length > 0 ? '\n\n' + werkzeugMeldungen.join(' ') : ''
      return NextResponse.json({ success: true, message: String(parsed.message ?? '') + zusatz, updatedOffer })
    }
    console.error('[optimize] unparsable response:', { stop: data.stop_reason, raw: raw.slice(0, 500) })

    // Auch hier muss durchkommen, was die Werkzeuge getan haben. Sonst wird ein
    // gespeicherter Preis stillschweigend verschluckt und der Nutzer glaubt,
    // es sei nichts passiert — der Fehler vom 2026-09-05 in neuem Gewand.
    const zusatz = werkzeugMeldungen.length > 0 ? werkzeugMeldungen.join(' ') : ''

    // Ein leerer Text bei gelaufenen Werkzeugen ist kein Fehler, sondern der
    // Normalfall: Das Modell hat gehandelt statt geredet.
    if (raw.trim() === '' && zusatz) {
      return NextResponse.json({ success: true, message: zusatz, updatedOffer: null })
    }
    // Hat ein Werkzeug abgelehnt, ist das der wahre Grund. Ohne diesen Zweig las
    // der Nutzer "nicht verwertbar" und erfuhr nie, dass seine Regel abgelehnt
    // wurde — der Fehler, an dem der Live-Test am 2026-09-06 haengenblieb.
    if (werkzeugFehler.length > 0) {
      return NextResponse.json({
        success: true,
        message: (zusatz ? zusatz + '\n\n' : '')
          + 'Dauerhaft merken konnte ich das nicht: ' + werkzeugFehler[werkzeugFehler.length - 1]
          + ' Sag es bitte noch einmal in deinen Worten, dann merke ich genau das.',
        updatedOffer: null,
      })
    }
    return NextResponse.json({
      success: true,
      message: (zusatz ? zusatz + '\n\n' : '')
        + 'Die Antwort kam nicht in verwertbarer Form zurück. Am Angebot wurde nichts geändert. '
        + 'Formuliere die Anfrage bitte anders oder sende sie erneut.',
      updatedOffer: null,
    })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unbekannter Fehler'
    console.error('[optimize]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
