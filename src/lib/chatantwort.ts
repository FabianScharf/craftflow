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
