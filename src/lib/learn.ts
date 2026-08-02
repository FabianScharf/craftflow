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
  let gepaart = 0

  for (const posAlt of alt) {
    if (posAlt.id == null) continue
    const posNeu = neu.find(x => x.id === posAlt.id)
    // Gelöschte Position sagt nichts über Bauweise aus → ignorieren.
    if (!posNeu) continue
    gepaart++
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

  // Positionen werden strikt über die id gepaart. Werden Positionen irgendwann
  // renummeriert, findet keine einzige Paarung statt — der Diff bleibt leer,
  // ohne dass sich das von "nichts zu lernen" unterscheiden ließe. Darum hier
  // ausdrücklich warnen statt still zu bleiben.
  if (alt.length > 0 && gepaart === 0) {
    console.warn('[learn] keine Position gepaart — Diff leer')
  }

  return roh.map((a, i) => ({ ...a, nr: i + 1 }) as Aenderung)
}

// ── Belegprüfung ───────────────────────────────────────────────────────────
// Die KI darf Regeln nur FORMULIEREN, nicht ERFINDEN. Jeder Kandidat muss auf
// eine Änderung aus dem Code-Diff oder ein wörtliches Chat-Zitat zeigen. Alles
// ohne gültigen Beleg wird verworfen. Gleiche Haltung wie bei validateAndFix /
// applyUserRates: den KI-Angaben wird nicht vertraut.

export type Beleg = { art: 'diff'; nr: number } | { art: 'zitat'; text: string }
export type Kandidat = { bereich: string; wenn: string; dann: string; belegt_durch: Beleg }
export type BestehendeRegel = { id: string; bereich: string; wenn: string }
export type GepruefterKandidat = {
  bereich: Bereich
  wenn: string
  dann: string
  belegText: string
  aendertRegelId: string | null
}

// Ein Kundensonderwunsch darf keine Dauerregel werden. Doppelt abgesichert:
// hier im Code und zusätzlich im KI-Auftrag.
export const AUSNAHME_WOERTER = [
  'diesmal', 'nur hier', 'nur bei diesem', 'nur dieses mal', 'ausnahmsweise',
  'einmalig', 'für diesen kunden', 'fuer diesen kunden', 'nur in diesem fall',
]

export function istAusnahmeNachricht(text: string): boolean {
  const t = normalisiere(text)
  return AUSNAHME_WOERTER.some(w => t.includes(normalisiere(w)))
}

export function beschreibeAenderung(a: Aenderung): string {
  switch (a.art) {
    case 'material_ersetzt':      return `"${a.vorher}" → "${a.nachher}" (${a.position})`
    case 'material_entfernt':     return `Material entfernt: "${a.vorher}" (${a.position})`
    case 'material_neu':          return `Material ergänzt: "${a.nachher}" (${a.position})`
    case 'kostenstelle_entfernt': return `Kostenstelle entfernt: ${a.kostenstelle} (${a.position})`
    case 'kostenstelle_neu':      return `Kostenstelle ergänzt: ${a.kostenstelle} (${a.position})`
    case 'minuten_geaendert':     return `${a.kostenstelle} ${a.vorher} → ${a.nachher} min (${a.position})`
    case 'menge_geaendert':       return `Menge "${a.material}" ${a.vorher} → ${a.nachher} (${a.position})`
  }
}

// Ein Zitat muss ein echter Beleg sein. Zwei Huerden gemeinsam:
// Mindestlaenge UND vollstaendige Wortfolge. Ohne die Mindestlaenge wuerde ein
// Alltagswort wie "die" reichen, das in fast jeder Nachricht vorkommt; ohne die
// Wortgrenze wuerde "machen" auch mitten in "Maschinen" treffen. Beides waere
// ein Schlupfloch, durch das die KI sich einen Beleg erschleichen kann.
export const MIN_ZITAT_ZEICHEN = 6

export function enthaeltWortfolge(nachrichtNorm: string, zitatNorm: string): boolean {
  if (zitatNorm === '') return false
  return ` ${nachrichtNorm} `.includes(` ${zitatNorm} `)
}

// Bewusst exakter Vergleich nach Normalisierung, kein unscharfes Matching:
// ein Fehltreffer würde die falsche Regel überschreiben, und Ähnlichkeits-
// schwellen sind nicht sinnvoll testbar.
//
// Ausnahme: Ein leeres `wenn` („gilt immer") ist KEINE Identität. Ein Bereich
// enthält viele unabhängige Immer-Regeln — „Rückwand immer Multiplex" und
// „Kanten immer ABS" sind beide Material und beide immer, aber verschiedene
// Regeln. Würden sie als dieselbe gelten, gäbe es pro Bereich nur eine einzige
// Immer-Regel, also sechs im ganzen Betrieb. Preis dieser Entscheidung: eine
// Immer-Regel wird nie als „ersetzt bestehende" erkannt; ändert der Nutzer
// seine Meinung, entsteht eine zweite, die er im Vault selbst löscht. Sichtbar
// aufräumen ist besser als still verlieren.
export function istGleicheRegel(a: { bereich: string; wenn: string }, b: { bereich: string; wenn: string }): boolean {
  const wennA = normalisiere(a.wenn)
  const wennB = normalisiere(b.wenn)
  if (wennA === '' || wennB === '') return false
  return normalisiere(a.bereich) === normalisiere(b.bereich) && wennA === wennB
}

export function pruefeKandidaten(
  kandidaten: unknown,
  aenderungen: Aenderung[],
  nutzerChat: string[],
  kundenWoerter: string[],
  bestehendeRegeln: BestehendeRegel[],
): GepruefterKandidat[] {
  if (!Array.isArray(kandidaten)) return []
  const chatNorm = nutzerChat.map(normalisiere)
  // Mindestlänge 3, damit kurze Kürzel wie "AG" nicht halbe Regeltexte treffen.
  const kundenNorm = kundenWoerter.map(normalisiere).filter(w => w.length >= 3)
  const ergebnis: GepruefterKandidat[] = []
  const gesehen = new Set<string>()

  for (const roh of kandidaten) {
    const k = roh as Partial<Kandidat> | null
    if (!k || typeof k.dann !== 'string' || k.dann.trim() === '') continue

    const bereich = BEREICHE.find(b => normalisiere(b) === normalisiere(String(k.bereich ?? '')))
    if (!bereich) continue

    let belegText: string | null = null
    const beleg = k.belegt_durch
    if (beleg && beleg.art === 'diff' && typeof beleg.nr === 'number') {
      const treffer = aenderungen.find(a => a.nr === beleg.nr)
      if (treffer) belegText = beschreibeAenderung(treffer)
    } else if (beleg && beleg.art === 'zitat' && typeof beleg.text === 'string' && beleg.text.trim() !== '') {
      const zitat = normalisiere(beleg.text)
      if (zitat.length >= MIN_ZITAT_ZEICHEN && chatNorm.some(m => enthaeltWortfolge(m, zitat))) {
        belegText = `Chat: „${beleg.text.trim()}"`
      }
    }
    if (!belegText) continue

    const wenn = String(k.wenn ?? '').trim()
    const inhalt = normalisiere(`${wenn} ${k.dann}`)
    if (kundenNorm.some(w => inhalt.includes(w))) continue

    // Innerhalb eines Durchlaufs nur ein Kandidat je bereich+wenn — sonst landen
    // zwei Regeln mit gleichem Schlüssel und womöglich widersprüchlichem "dann"
    // im Vault.
    // Bei „gilt immer" (leeres wenn) unterscheidet erst das `dann` die Regeln —
    // sonst fielen zwei verschiedene Immer-Regeln desselben Bereichs zusammen.
    const wennNorm = normalisiere(wenn)
    const schluessel = wennNorm === ''
      ? `${bereich}||${normalisiere(k.dann)}`
      : `${bereich}|${wennNorm}`
    if (gesehen.has(schluessel)) continue
    gesehen.add(schluessel)

    const bestehend = bestehendeRegeln.find(r => istGleicheRegel(r, { bereich, wenn }))
    ergebnis.push({ bereich, wenn, dann: k.dann.trim(), belegText, aendertRegelId: bestehend?.id ?? null })
  }
  return ergebnis
}

// ── Prompt-Block ───────────────────────────────────────────────────────────
export const MAX_REGELN_IM_PROMPT = 60
export const WARNUNG_AB_REGELN = 40

// Der Block wird ans ENDE des System-Prompts gehängt und trägt einen
// ausdrücklichen Vorrang-Satz. Beides ist funktional nötig: steht er vor dem
// allgemeinen Fachwissen, gewinnt weiter die generische Vorgabe (z. B. 6 mm
// HPL-Rückwand) und die gelernte Regel bleibt wirkungslos.
export function baueRegelBlock(regeln: Array<{ bereich: string; wenn: string; dann: string }>): string {
  if (regeln.length === 0) return ''
  const zeilen = regeln.slice(0, MAX_REGELN_IM_PROMPT).map(r => {
    const bedingung = (r.wenn ?? '').trim() === '' ? 'Immer' : `Wenn ${r.wenn.trim()}`
    return `[${r.bereich}] ${bedingung} → ${(r.dann ?? '').trim()}`
  })
  return '\n\n## MEINE BAUWEISE — VERBINDLICHE REGELN DIESES BETRIEBS\n'
    + zeilen.join('\n')
    + '\nDiese Regeln haben Vorrang vor allen allgemeinen Vorgaben oben. Widerspricht eine allgemeine Vorgabe einer dieser Regeln, gilt die Regel.'
}
