// Token-Verbrauch einer Claude-Antwort in eine feste Form bringen.
//
// ANLASS (2026-09-15): Fabian will wissen, ob jeder Plan Gewinn bringt. Dafuer muss
// jede KI-Antwort ihren Verbrauch melden — Anthropic liefert ihn im Feld `usage`
// mit, bisher hat ihn niemand gelesen. Diese Zahlen sind ausserdem der Nachweis,
// ob das Prompt-Caching greift (cacheGelesen > 0 ab dem zweiten Aufruf).
//
// Reine Funktionen ohne Importe — `npm run test` fuehrt sie direkt aus.

export type KiNutzung = {
  eingabe: number          // normal bezahlte Eingabe-Token
  cacheGeschrieben: number // in den Cache geschrieben (1,25-fach)
  cacheGelesen: number     // aus dem Cache gelesen (0,1-fach)
  ausgabe: number          // Ausgabe-Token inkl. Thinking
}

export const LEERE_NUTZUNG: KiNutzung = { eingabe: 0, cacheGeschrieben: 0, cacheGelesen: 0, ausgabe: 0 }

/** Liest das `usage`-Objekt der Anthropic-Antwort; fehlende Felder zaehlen als 0. */
export function nutzungAusAntwort(usage: unknown): KiNutzung {
  const u = (usage && typeof usage === 'object' ? usage : {}) as Record<string, unknown>
  const z = (k: string) => (typeof u[k] === 'number' && Number.isFinite(u[k] as number) ? (u[k] as number) : 0)
  return {
    eingabe: z('input_tokens'),
    cacheGeschrieben: z('cache_creation_input_tokens'),
    cacheGelesen: z('cache_read_input_tokens'),
    ausgabe: z('output_tokens'),
  }
}

/** Mehrere Runden (z. B. Werkzeugschleife im Optimieren) zusammenzaehlen. */
export function summiereNutzung(...teile: KiNutzung[]): KiNutzung {
  return teile.reduce((s, t) => ({
    eingabe: s.eingabe + t.eingabe,
    cacheGeschrieben: s.cacheGeschrieben + t.cacheGeschrieben,
    cacheGelesen: s.cacheGelesen + t.cacheGelesen,
    ausgabe: s.ausgabe + t.ausgabe,
  }), { ...LEERE_NUTZUNG })
}

/** Preise je Million Token in US-Dollar (Stand 2026-06, Anthropic-Liste). */
export const PREISE_USD_PRO_MTOK: Record<string, { eingabe: number; ausgabe: number }> = {
  'claude-sonnet-4-6': { eingabe: 3, ausgabe: 15 },
  'claude-haiku-4-5-20251001': { eingabe: 1, ausgabe: 5 },
}

/** Kosten in US-Dollar; Cache-Schreiben 1,25-fach, Cache-Lesen 0,1-fach der Eingabe. */
export function kostenUsd(n: KiNutzung, modell: string): number {
  const p = PREISE_USD_PRO_MTOK[modell]
  if (!p) return 0
  const eingabe = (n.eingabe + n.cacheGeschrieben * 1.25 + n.cacheGelesen * 0.1) * p.eingabe
  const ausgabe = n.ausgabe * p.ausgabe
  return Math.round(((eingabe + ausgabe) / 1_000_000) * 10000) / 10000
}

/** Eine Logzeile, die man in den Vercel-Laufzeitlogs sofort lesen kann. */
export function nutzungAlsZeile(route: string, modell: string, n: KiNutzung): string {
  return `[${route}] tokens — eingabe ${n.eingabe}, cache geschrieben ${n.cacheGeschrieben}, cache gelesen ${n.cacheGelesen}, ausgabe ${n.ausgabe} → ca. ${kostenUsd(n, modell).toFixed(4)} $`
}
