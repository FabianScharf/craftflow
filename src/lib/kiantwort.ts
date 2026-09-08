// Positionen aus der KI-Antwort in das Datenmodell der Oberfläche übernehmen.
//
// Importiert bewusst NICHTS — damit die Tests ohne Bundler laufen.
//
// WARUM DAS EINE EIGENE DATEI IST:
// Diese Umwandlung baut jede Position Feld für Feld NEU auf. Was hier nicht
// aufgeführt ist, ist danach verloren — ohne Fehler, ohne Meldung.
//
// GEFUNDEN AM 2026-09-08: Genau so ist die "stueckzahl" verschwunden. Die KI hat sie
// korrekt geliefert (nachgewiesen an der API-Antwort: zehn Spinde, "stueckzahl":10),
// die Serienstaffel war gebaut und getestet — aber die Oberfläche hat das Feld beim
// Übernehmen weggelassen. Wer "100 Spinde" kalkulierte, bekam den Preis für EIN
// Stück. Aufgefallen erst, als für die Alternativpositionen dieselbe Stelle
// angefasst wurde.
//
// Der Test dazu prüft nicht einzelne Felder, sondern dass NICHTS verlorengeht.

export type KiMaterial = {
  bezeichnung?: string; menge?: number; einheit?: string
  ekPreis?: number; aufschlag?: number
}
export type KiArbeit = { kostenstelle?: string; minuten?: number; vkStunde?: number }
export type KiPosition = {
  titel?: string; beschreibung?: string; stueckzahl?: number
  gruppe?: string; alternativ?: boolean; warnung?: string
  material?: KiMaterial[]; arbeitszeit?: KiArbeit[]
}

export type UiPosition = {
  id: number
  titel: string
  beschreibung: string
  stueckzahl?: number
  gruppe?: string
  alternativ?: boolean
  warnung?: string
  material: Array<{ id: number; bezeichnung: string; menge: number; einheit: string; ekPreis: number; aufschlag: number }>
  arbeitszeit: Array<{ id: number; kostenstelle: string; minuten: number; vkStunde: number }>
}

/** Alle Felder, die eine Position aus der KI-Antwort mitbringen kann. */
export const KI_POSITIONSFELDER = [
  'titel', 'beschreibung', 'stueckzahl', 'gruppe', 'alternativ', 'warnung',
  'material', 'arbeitszeit',
] as const

export function positionenAusKi(
  rohe: unknown,
  jetzt = Date.now(),
  standardSatz = 65,
): UiPosition[] {
  if (!Array.isArray(rohe)) return []
  // Fortlaufender Zaehler statt gerechneter Abstaende.
  //
  // GEFUNDEN AM 2026-09-08 durch den Test unten: Das alte Schema war
  // `jetzt + i` fuer die Position und `jetzt + i * 100 + mi` fuer das Material.
  // Damit trug die erste Materialzeile dieselbe id wie die erste Position, und die
  // zweite dieselbe wie die zweite Position. In der Praxis fiel das nicht auf, weil
  // die ids in getrennten Bereichen verglichen werden — aber es ist eine Falle, die
  // irgendwann zuschnappt. Ein Zaehler kann nicht kollidieren.
  let naechsteId = jetzt
  const id = () => naechsteId++
  return rohe.map(r => {
    const p = (r ?? {}) as KiPosition
    const stueckzahl = Math.max(1, Math.floor(Number(p.stueckzahl) || 1))
    const gruppe = String(p.gruppe ?? '').trim()
    return {
      id: id(),
      titel: p.titel || 'Position',
      beschreibung: p.beschreibung || '',
      // Nur setzen, was wirklich da ist — sonst stehen in jedem Angebot
      // "stueckzahl: 1" und "gruppe: ''" herum und der Vergleich zweier
      // Fassungen meldet Änderungen, die keine sind.
      ...(stueckzahl > 1 ? { stueckzahl } : {}),
      ...(gruppe ? { gruppe } : {}),
      ...(p.alternativ === true ? { alternativ: true } : {}),
      ...(p.warnung ? { warnung: String(p.warnung) } : {}),
      material: (Array.isArray(p.material) ? p.material : []).map(m => ({
        id: id(),
        bezeichnung: m?.bezeichnung || '',
        menge: Number(m?.menge) || 1,
        einheit: m?.einheit || 'Stk',
        ekPreis: Number(m?.ekPreis) || 0,
        aufschlag: m?.aufschlag ?? 0.3,
      })),
      arbeitszeit: (Array.isArray(p.arbeitszeit) ? p.arbeitszeit : []).map(a => ({
        id: id(),
        kostenstelle: a?.kostenstelle || 'Produktion',
        minuten: Number(a?.minuten) || 60,
        vkStunde: Number(a?.vkStunde) || standardSatz,
      })),
    }
  })
}
