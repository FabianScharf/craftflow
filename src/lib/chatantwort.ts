// Rettet eine brauchbare Antwort, wenn das Modell den JSON-Umschlag vergisst.
//
// Gemessen am 2026-09-06: Auf die Bitte, den Regel-Wortlaut zur Bestaetigung zu
// zeigen, antwortete das Modell mit stop_reason "end_turn" und reinem Text —
// inhaltlich genau richtig ("Soll ich sie so merken: ... Passt der Wortlaut?"),
// nur ohne {"message":...}. Der Aufrufer verwarf das und zeigte "Die Antwort kam
// nicht in verwertbarer Form zurueck". Eine gute Antwort wegzuwerfen, weil die
// Verpackung fehlt, ist schlechter als sie durchzureichen.
//
// Importiert bewusst NICHTS — wie lernwerkzeuge.ts, damit die Tests ohne
// Bundler laufen.

// Angefangenes oder kaputtes JSON darf NICHT durchgereicht werden: Der Nutzer
// bekaeme Innereien zu sehen ({"message":"..., "updatedOffer") statt einer
// Antwort. Nur was erkennbar Fliesstext ist, geht durch.
export function brauchbarerText(raw: string): string | null {
  const s = (raw ?? '').trim()
  if (s === '') return null
  if (s.startsWith('{') || s.startsWith('[') || s.startsWith('```')) return null
  if (s.includes('"updatedOffer"') || s.includes('"message"')) return null
  return s
}

// Loest die Escape-Folgen einer JSON-Zeichenkette in einem Durchgang auf.
// Nacheinander zu ersetzen waere falsch: aus \\n wuerde erst ein Backslash und
// dann ein Umbruch statt der beiden Zeichen, die dastehen sollen.
const ESCAPES: Record<string, string> = {
  n: '\n', r: '\r', t: '\t', b: '\b', f: '\f', '"': '"', '\\': '\\', '/': '/',
}
function entpacke(s: string): string {
  return s.replace(/\\(.)/g, (_, c: string) => ESCAPES[c] ?? c)
}

// Rettet die Nachricht aus JSON, das an einem einzelnen Zeichen zerbricht.
//
// Gemessen am 2026-09-06 15:17 (Vercel-Log): Das Modell oeffnete typografisch
// („) und schloss mit einem GERADEN Anfuehrungszeichen. Das beendet die
// JSON-Zeichenkette zu frueh — die gesamte, inhaltlich einwandfreie Antwort war
// damit verloren, samt der Eingangsanalyse. Eine Antwort an einem Zeichen
// scheitern zu lassen ist teuer: Der Aufruf ist bezahlt und der Nutzer wartete.
//
// `updatedOffer` wird BEWUSST nie gerettet. Ein halb gelesenes Angebot ins
// Formular zu schreiben waere schlimmer als gar keine Aenderung — lieber sagt
// die KI, was sie wollte, und der Nutzer schickt es erneut.
export function notNachricht(raw: string): { message: string; updatedOffer: null } | null {
  const s = (raw ?? '').trim()
  if (s === '' || !s.includes('"message"')) return null
  // Gierig bis zum LETZTEN Vorkommen: Die Nachricht selbst darf Anfuehrungs-
  // zeichen enthalten — genau daran ist das Parsen ja gescheitert.
  const mitFeld = s.match(/"message"\s*:\s*"([\s\S]*)"\s*,\s*"updatedOffer"\s*:/)
  const nurMessage = s.match(/"message"\s*:\s*"([\s\S]*)"\s*\}?\s*$/)
  const treffer = mitFeld ?? nurMessage
  if (!treffer) return null
  const text = entpacke(treffer[1]).trim()
  if (text === '') return null
  return { message: text, updatedOffer: null }
}
