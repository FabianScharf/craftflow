// Reine Logik für fixierte Einkaufspreise.
//
// Importiert bewusst NICHTS — genau wie src/lib/learn.ts. Node führt die
// TypeScript-Dateien in den Tests direkt aus (Type Stripping), es sind keine
// Test-Pakete installiert. Jeder Import würde die Tests unausführbar machen.
// Alles, was Supabase braucht, gehört nach src/lib/preisspeicher.ts.
//
// Getrennt vom Bauweise-Vault: Der Vault beeinflusst nie vkStunde, aufschlag
// oder Preise (Engine-Invariante). Fixierte Einkaufspreise sind ein eigener
// Speicher mit eigener Wirkung.

export type FixierterPreis = {
  id?: string
  bezeichnung: string
  ek: number
  einheit: string
  stand: string
}

export const MAX_PREISE_IM_PROMPT = 80
export const VERALTET_NACH_TAGEN = 365

function normalisiere(s: string): string {
  return (s ?? '').toLowerCase().replace(/\s+/g, ' ').trim()
}

// Längster Treffer gewinnt — dieselbe Logik wie matchMaterialgruppe in
// /api/analyze und /api/optimize. "Blum Movento Softclose-Auszug" ist
// spezifischer als "Blum" und muss gewinnen, sonst gilt der falsche Preis.
// Kein Treffer ergibt null: Die Aufrufer lassen dann den Wert der KI stehen,
// statt einen unpassenden Preis zu erzwingen.
export function findePreis(bezeichnung: string, preise: FixierterPreis[]): FixierterPreis | null {
  const text = normalisiere(bezeichnung)
  if (text === '') return null
  let best: FixierterPreis | null = null
  let bestLaenge = 0
  for (const p of preise) {
    const kandidat = normalisiere(p.bezeichnung)
    if (kandidat === '') continue
    if (text.includes(kandidat) && kandidat.length > bestLaenge) {
      best = p
      bestLaenge = kandidat.length
    }
  }
  return best
}

// Ein unlesbares Datum gilt NICHT als veraltet. Ein Fehlalarm wäre schlimmer
// als keine Warnung: Er würde den Nutzer dazu bringen, korrekte Preise
// anzuzweifeln und nachzupflegen, die längst stimmen.
export function istVeraltet(stand: string, heute: string): boolean {
  const a = Date.parse(stand)
  const b = Date.parse(heute)
  if (Number.isNaN(a) || Number.isNaN(b)) return false
  return (b - a) / 86400000 > VERALTET_NACH_TAGEN
}

// Eigener Block, getrennt vom Bauweise-Block. Die Trennung ist funktional:
// Bauweise-Regeln dürfen nie Preise setzen, Preise nie Bauweise. Der Satz zum
// Aufschlag steht ausdrücklich drin — sonst zieht die KI den Aufschlag mit,
// und der gehört ausschließlich in die Materialgruppen des Nutzers.
export function bauePreisBlock(preise: FixierterPreis[]): string {
  if (preise.length === 0) return ''
  const zeilen = preise.slice(0, MAX_PREISE_IM_PROMPT).map(p =>
    `${p.bezeichnung} → ${p.ek.toFixed(2)} € / ${p.einheit}`)
  return '\n\n## FIXIERTE EINKAUFSPREISE DIESES BETRIEBS\n'
    + zeilen.join('\n')
    + '\nDiese EK-Preise sind verbindlich. Trifft eine Materialbezeichnung zu, setze genau'
    + ' diesen ek-Wert ein, statt zu schätzen. Der Aufschlag bleibt davon unberührt —'
    + ' der kommt weiterhin aus den Materialgruppen des Nutzers.'
}
