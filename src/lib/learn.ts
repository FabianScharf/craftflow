// Lern-Funktion („Bauweise-Vault"): erkennt, was der Nutzer am KI-Vorschlag
// geändert hat, und leitet daraus bestätigungspflichtige Regeln ab.
//
// WICHTIG: Diese Datei importiert absichtlich NICHTS. Nur so kann Node sie
// direkt ausführen (`npm run test`) — die App läuft lokal nicht, deshalb ist
// das der einzige Weg, die riskante Logik hier überhaupt zu testen.
// Alles, was Supabase braucht, gehört nach src/lib/bauweise.ts.

export type Bereich = 'Material' | 'Konstruktion' | 'Zeit' | 'Oberfläche' | 'Montage' | 'Sonstiges'

export const BEREICHE: Bereich[] = ['Material', 'Konstruktion', 'Zeit', 'Oberfläche', 'Montage', 'Sonstiges']

// Rauschfilter-Schwellen. Bewusst konservativ: eine Korrektur von 45 auf 48
// Minuten ist Feinschliff, kein Prinzip — daraus darf keine Dauerregel werden.
export const MIN_MINUTEN_PROZENT = 25
export const MIN_MINUTEN_ABSOLUT = 15
export const MIN_MENGE_PROZENT = 20

export type LernMaterial = { id?: string | number; bezeichnung?: string; menge?: number }
export type LernArbeitszeit = { id?: string | number; kostenstelle?: string; minuten?: number }
export type LernPosition = {
  id?: string | number
  titel?: string
  material?: LernMaterial[]
  arbeitszeit?: LernArbeitszeit[]
}
export type LernOffer = { positionen?: LernPosition[] }

export type Aenderung =
  | { nr: number; art: 'material_ersetzt';      position: string; vorher: string; nachher: string }
  | { nr: number; art: 'material_entfernt';     position: string; vorher: string }
  | { nr: number; art: 'material_neu';          position: string; nachher: string }
  | { nr: number; art: 'kostenstelle_entfernt'; position: string; kostenstelle: string }
  | { nr: number; art: 'kostenstelle_neu';      position: string; kostenstelle: string }
  | { nr: number; art: 'minuten_geaendert';     position: string; kostenstelle: string; vorher: number; nachher: number }
  | { nr: number; art: 'menge_geaendert';       position: string; material: string; vorher: number; nachher: number }

// Verteilt Omit über die Union — ein direktes Omit<Aenderung,'nr'> würde die
// Diskriminierung platt machen.
type OhneNr<T> = T extends unknown ? Omit<T, 'nr'> : never
type AenderungRoh = OhneNr<Aenderung>

export function normalisiere(text: string): string {
  return (text ?? '')
    .toLowerCase()
    .replace(/[.,;:!?"'„“()\-–]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Beide Schwellen müssen erfüllt sein: relativ UND absolut. Sonst schlägt jede
// Kleinigkeit an kurzen Positionen an (5 → 7 min sind 40 %, aber irrelevant).
function ueberSchwelle(vorher: number, nachher: number, minProzent: number, minAbsolut: number): boolean {
  if (vorher === nachher) return false
  const diffAbs = Math.abs(nachher - vorher)
  if (diffAbs < minAbsolut) return false
  if (vorher === 0) return true
  return (diffAbs / vorher) * 100 >= minProzent
}

export function diffOffer(kiVorschlag: LernOffer, endstand: LernOffer): Aenderung[] {
  const roh: AenderungRoh[] = []
  const alt = kiVorschlag?.positionen ?? []
  const neu = endstand?.positionen ?? []

  for (const posAlt of alt) {
    if (posAlt.id == null) continue
    const posNeu = neu.find(x => x.id === posAlt.id)
    // Gelöschte Position sagt nichts über Bauweise aus → ignorieren.
    if (!posNeu) continue
    const titel = posNeu.titel ?? posAlt.titel ?? ''

    // ── Material: erst über id paaren, dann über normalisierte Bezeichnung ──
    const matAlt = posAlt.material ?? []
    const matNeu = posNeu.material ?? []
    const offenAlt: LernMaterial[] = []
    const genutzt = new Set<number>()

    for (const mAlt of matAlt) {
      let idx = mAlt.id == null ? -1 : matNeu.findIndex((m, i) => !genutzt.has(i) && m.id === mAlt.id)
      if (idx === -1) {
        idx = matNeu.findIndex((m, i) =>
          !genutzt.has(i) && normalisiere(m.bezeichnung ?? '') === normalisiere(mAlt.bezeichnung ?? ''))
      }
      if (idx === -1) { offenAlt.push(mAlt); continue }
      genutzt.add(idx)
      const mNeu = matNeu[idx]
      const bAlt = mAlt.bezeichnung ?? ''
      const bNeu = mNeu.bezeichnung ?? ''
      if (normalisiere(bAlt) !== normalisiere(bNeu)) {
        roh.push({ art: 'material_ersetzt', position: titel, vorher: bAlt, nachher: bNeu })
      }
      if (ueberSchwelle(mAlt.menge ?? 0, mNeu.menge ?? 0, MIN_MENGE_PROZENT, 0)) {
        roh.push({ art: 'menge_geaendert', position: titel, material: bNeu || bAlt, vorher: mAlt.menge ?? 0, nachher: mNeu.menge ?? 0 })
      }
    }

    const offenNeu = matNeu.filter((_, i) => !genutzt.has(i))
    const paare = Math.min(offenAlt.length, offenNeu.length)
    for (let i = 0; i < paare; i++) {
      roh.push({ art: 'material_ersetzt', position: titel, vorher: offenAlt[i].bezeichnung ?? '', nachher: offenNeu[i].bezeichnung ?? '' })
    }
    for (let i = paare; i < offenAlt.length; i++) {
      roh.push({ art: 'material_entfernt', position: titel, vorher: offenAlt[i].bezeichnung ?? '' })
    }
    for (let i = paare; i < offenNeu.length; i++) {
      roh.push({ art: 'material_neu', position: titel, nachher: offenNeu[i].bezeichnung ?? '' })
    }

    // ── Arbeitszeit: über die Kostenstelle paaren, nie über die id ──
    const azAlt = posAlt.arbeitszeit ?? []
    const azNeu = posNeu.arbeitszeit ?? []
    for (const aAlt of azAlt) {
      const ks = aAlt.kostenstelle ?? ''
      const aNeu = azNeu.find(x => normalisiere(x.kostenstelle ?? '') === normalisiere(ks))
      if (!aNeu) { roh.push({ art: 'kostenstelle_entfernt', position: titel, kostenstelle: ks }); continue }
      if (ueberSchwelle(aAlt.minuten ?? 0, aNeu.minuten ?? 0, MIN_MINUTEN_PROZENT, MIN_MINUTEN_ABSOLUT)) {
        roh.push({ art: 'minuten_geaendert', position: titel, kostenstelle: ks, vorher: aAlt.minuten ?? 0, nachher: aNeu.minuten ?? 0 })
      }
    }
    for (const aNeu of azNeu) {
      const ks = aNeu.kostenstelle ?? ''
      if (!azAlt.some(x => normalisiere(x.kostenstelle ?? '') === normalisiere(ks))) {
        roh.push({ art: 'kostenstelle_neu', position: titel, kostenstelle: ks })
      }
    }
  }

  return roh.map((a, i) => ({ ...a, nr: i + 1 }) as Aenderung)
}
