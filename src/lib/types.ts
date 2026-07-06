// ── Typen ──────────────────────────────────────────
export interface Kunde {
  name: string
  zusatz: string
  strasse: string
  ort: string
  projekt: string
}

export interface KundeDB extends Kunde {
  id: number
  typ: string
}

export interface Position {
  id: number
  kat: string
  titel: string
  bez: string
  kalkTyp: 'detail' | 'stunden' | 'pauschale' | 'qm' | 'lfm'
  menge: number
  einheit: string
  // detail-Modus: vollständige Kalkulation
  materialKosten: number   // Materialkosten in € pro Einheit
  lohnStd: number          // Arbeitsstunden pro Einheit
  lohnSatz: number         // 0 = globalStd verwenden
  gkProzent: number        // Gemeinkosten-Zuschlag (0.30 = 30%)
  fremdleistung: number    // Fremdleistung gesamt (Anfahrt etc.)
  // einfache Modi (pauschale/qm/lfm)
  ep: number
  // stunden/legacy
  std: number
  mat: number
  aufschlag: number
}

export interface KalkResult {
  ep: number
  gesamt: number
  matTotal?: number
  lohn?: number
  gk?: number
}

// ── Kostenstellen ────────────────────────────────────
export type KostenstelleId =
  | 'Besprechung'
  | 'Planung'
  | 'Konstruktion'
  | 'Arbeitsvorbereitung'
  | 'Produktion'
  | 'Warenhandling'
  | 'Zuschnitt'
  | 'Bekantung'
  | 'CNC'
  | 'Oberfläche'
  | 'Zusammenbau'
  | 'Verpacken'
  | 'Azubi'
  | 'Montage'
  | 'Lieferung'

// Converts legacy numeric-prefix IDs from saved projects to clean names
export const LEGACY_KS_MAP: Record<string, KostenstelleId> = {
  '00_Meeting':                   'Besprechung',
  '01_02_Planung':                'Planung',
  '02_01_Konstruktion':           'Konstruktion',
  '02_02_Arbeitsvorbereitung':    'Arbeitsvorbereitung',
  '03_00_Produktion':             'Produktion',
  '03_01_Warenhandling':          'Warenhandling',
  '03_02_Zuschnitt':              'Zuschnitt',
  '03_03_Bekantung':              'Bekantung',
  '03_04_CNC':                    'CNC',
  '03_05_Oberflaechenbehandlung': 'Oberfläche',
  '03_06_Zusammenbau':            'Zusammenbau',
  '03_07_Verpacken':              'Verpacken',
  '03_08_Azubi':                  'Azubi',
  '05_01_Montage':                'Montage',
  '06_01_Lieferung':              'Lieferung',
}
export function normalizeKsId(ks: string): KostenstelleId {
  return (LEGACY_KS_MAP[ks] ?? ks) as KostenstelleId
}

export const DEFAULT_STUNDENSAETZE: Record<KostenstelleId, number> = {
  'Besprechung':       65,
  'Planung':           85,
  'Konstruktion':      75,
  'Arbeitsvorbereitung': 75,
  'Produktion':        65,
  'Warenhandling':     65,
  'Zuschnitt':         72,
  'Bekantung':        100,
  'CNC':              120,
  'Oberfläche':        72,
  'Zusammenbau':       65,
  'Verpacken':         65,
  'Azubi':             52,
  'Montage':           65,
  'Lieferung':         65,
}

export const KOSTENSTELLEN_GRUPPEN: Record<string, KostenstelleId[]> = {
  'Planung':       ['Besprechung', 'Planung', 'Konstruktion', 'Arbeitsvorbereitung'],
  'Maschinenraum': ['Zuschnitt', 'Bekantung', 'CNC', 'Oberfläche'],
  'Bankraum':      ['Produktion', 'Warenhandling', 'Zusammenbau', 'Verpacken', 'Azubi'],
  'Montage':       ['Montage', 'Lieferung'],
}
export const KOSTENSTELLEN_GRUPPEN_ORDER = ['Planung', 'Maschinenraum', 'Bankraum', 'Montage'] as const

export interface UserSettings {
  firmaName: string
  firmaStrasse: string
  firmaOrt: string
  firmaEmail: string
  firmaUst: string
  materialAufschlag: number
  stundensaetze: Record<KostenstelleId, number>
  logoUrl?: string
}

export const DEFAULT_USER_SETTINGS: UserSettings = {
  firmaName: '',
  firmaStrasse: '',
  firmaOrt: '',
  firmaEmail: '',
  firmaUst: '',
  materialAufschlag: 0.30,
  stundensaetze: { ...DEFAULT_STUNDENSAETZE },
}

export interface MaterialPosten {
  id: number
  bezeichnung: string
  menge: number
  einheit: string
  ekPreis: number
  aufschlag: number
}

export interface DbKostenstelle {
  id: string
  code: string
  bezeichnung: string
  stundensatz: number
  aktiv: boolean
  gruppe: string | null
  reihenfolge: number
  ist_standard: boolean
}

export interface DbMaterialgruppe {
  id: string
  name: string
  aufschlag_prozent: number
  beschreibung: string | null
  reihenfolge: number
  aktiv: boolean
}

export interface ArbeitsPosten {
  id: number
  kostenstelle: string
  minuten: number
  vkStunde: number
}

export interface Angebotsposition {
  id: number
  titel: string
  beschreibung: string
  material: MaterialPosten[]
  arbeitszeit: ArbeitsPosten[]
}

// ── Firmendaten ──────────────────────────────────────
export const FIRMA = {
  name: 'fs crafted',
  inhaber: 'Fabian Scharf',
  strasse: 'Fuldaer Straße 15',
  ort: '63517 Rodenbach',
  email: 'anfrage@fscrafted.de',
  ust: 'DE459348681',
  iban: 'DE63 1001 1001 2070 5494 28',
  bank: 'N26',
}

// ── CI Farben ────────────────────────────────────────
export const C = {
  black: 'var(--c-primary, #0D0D0D)',
  darkbg: '#141414',
  copper: 'var(--c-accent, #C8885A)',
  white: '#F5F2EE',
  gray1: '#1E1E1E',
  gray2: '#2A2A2A',
  textMid: '#8A8A8A',
  border: '#2E2E2E',
}

export const CAT_COL: Record<string, string> = {
  Korpus:        '#C8885A',
  Schrank:       '#C8885A',
  Türen:         '#B07848',
  Fronten:       '#B07848',
  Schubladen:    '#A06840',
  Rückwand:      '#907060',
  Beschläge:     '#6A7A8A',
  Oberfläche:    '#7A8A6A',
  Schreibtisch:  '#8A6A4A',
  Fremdleistung: '#7A5A7A',
  Montage:       '#5A6A7A',
  Sonstiges:     '#6A5A7A',
}

export const KALK_TYPEN = [
  { id: 'detail',   label: 'Kalkulation', icon: '📊', desc: 'Material + Lohn + GK-Zuschlag + Fremdleistung' },
  { id: 'pauschale', label: 'Pauschale',  icon: '💶', desc: 'Fester Gesamtpreis' },
  { id: 'qm',       label: 'pro m²',     icon: '📐', desc: 'Preis pro m²' },
  { id: 'lfm',      label: 'pro lfd. m', icon: '📏', desc: 'Preis pro laufenden Meter' },
]

// ── Kalkulation ──────────────────────────────────────
export function calcPos(p: Position, globalStd: number): KalkResult {
  if (p.kalkTyp === 'detail') {
    const satz = p.lohnSatz > 0 ? p.lohnSatz : globalStd
    const mat = p.materialKosten || 0
    const lohn = (p.lohnStd || 0) * satz
    const gk = (mat + lohn) * (p.gkProzent ?? 0.3)
    const netPerUnit = mat + lohn + gk
    const gesamt = netPerUnit * (p.menge || 1) + (p.fremdleistung || 0)
    return {
      ep: netPerUnit,
      gesamt,
      matTotal: mat * (p.menge || 1),
      lohn: lohn * (p.menge || 1),
      gk: gk * (p.menge || 1),
    }
  }
  switch (p.kalkTyp) {
    case 'pauschale':
    case 'qm':
    case 'lfm':
      return { ep: p.ep, gesamt: p.ep * p.menge }
    case 'stunden':
    default: {
      const matTotal = p.mat * p.menge * (1 + p.aufschlag)
      const lohn = p.std * p.menge * globalStd
      const ep = p.kat === 'Montage' ? globalStd : (p.mat * (1 + p.aufschlag) + p.std * globalStd)
      return { ep, gesamt: ep * p.menge, matTotal, lohn }
    }
  }
}

// ── Formatierung ─────────────────────────────────────
export const eur = (v: number) =>
  v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'

export const today = () => new Date().toLocaleDateString('de-DE')
export const inDays = (d: number, from?: Date) => new Date((from ?? new Date()).getTime() + d * 864e5).toLocaleDateString('de-DE')

// ── Kostenstellen Labels ─────────────────────────────
export const KOSTENSTELLEN_LABELS: Record<KostenstelleId, string> = {
  'Besprechung':       'Besprechung',
  'Planung':           'Planung',
  'Konstruktion':      'Konstruktion',
  'Arbeitsvorbereitung': 'Arbeitsvorbereitung',
  'Produktion':        'Produktion',
  'Warenhandling':     'Warenhandling',
  'Zuschnitt':         'Zuschnitt',
  'Bekantung':         'Kantenanleimen',
  'CNC':               'CNC',
  'Oberfläche':        'Oberflächenbehandlung',
  'Zusammenbau':       'Zusammenbau',
  'Verpacken':         'Verpacken',
  'Azubi':             'Azubi/Helfer',
  'Montage':           'Montage vor Ort',
  'Lieferung':         'Lieferung & Fahrt',
}

export function materialkostenPos(p: Angebotsposition): number {
  return p.material.reduce((s, m) => s + m.menge * m.ekPreis * (1 + m.aufschlag), 0)
}

export function arbeitszeitPreisPos(p: Angebotsposition): number {
  return p.arbeitszeit.reduce((s, a) => s + (a.minuten / 60) * a.vkStunde, 0)
}

export function stundenPos(p: Angebotsposition): number {
  return p.arbeitszeit.reduce((s, a) => s + a.minuten / 60, 0)
}

export function calcAngebotspos(p: Angebotsposition): number {
  return materialkostenPos(p) + arbeitszeitPreisPos(p)
}

// Single source of truth for project-wide summary fields — always derived by
// summing the same per-position formulas used everywhere else (PDF, Angebot,
// Kalkulations-Übersicht), never a separately re-typed calculation, so the
// totals can never silently drift apart (2026-07-04 Vorfall).
export function materialkostenGesamt(positionen: Angebotsposition[]): number {
  return positionen.reduce((s, p) => s + materialkostenPos(p), 0)
}

export function stundenGesamt(positionen: Angebotsposition[]): number {
  return positionen.reduce((s, p) => s + stundenPos(p), 0)
}

// ── Demo-Kunden ──────────────────────────────────────
export const DEMO_KUNDEN: KundeDB[] = [
  { id: 1, name: 'Familie Müller', zusatz: 'Thomas Müller', strasse: 'Hauptstr. 12', ort: '63500 Seligenstadt', projekt: '', typ: 'Privat' },
  { id: 2, name: 'Büro Schmidt GmbH', zusatz: 'Anna Schmidt', strasse: 'Industrieweg 5', ort: '63739 Aschaffenburg', projekt: '', typ: 'Gewerbe' },
  { id: 3, name: 'Stiftung Haus Mirjam', zusatz: 'Amelie Wissel', strasse: 'Ernstkirchen 4', ort: '63825 Schöllkrippen', projekt: '', typ: 'Gemeinnützig' },
]

// ── Kunden DB (localStorage) ─────────────────────────
export function ladeKunden(): KundeDB[] {
  if (typeof window === 'undefined') return []
  try {
    const d = localStorage.getItem('craftflow_kunden')
    return d ? JSON.parse(d) : []
  } catch {
    return []
  }
}

export function speichereKunden(kunden: KundeDB[]) {
  if (typeof window === 'undefined') return
  try { localStorage.setItem('craftflow_kunden', JSON.stringify(kunden)) } catch {}
}
