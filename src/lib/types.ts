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
  | '00_Meeting'
  | '01_02_Planung'
  | '02_01_Konstruktion'
  | '02_02_Arbeitsvorbereitung'
  | '03_00_Produktion'
  | '03_01_Warenhandling'
  | '03_02_Zuschnitt'
  | '03_03_Bekantung'
  | '03_04_CNC'
  | '03_05_Oberflaechenbehandlung'
  | '03_07_Verpacken'
  | '03_08_Azubi'
  | '05_01_Montage'
  | '06_01_Lieferung'

export const DEFAULT_STUNDENSAETZE: Record<KostenstelleId, number> = {
  '00_Meeting':                   65,
  '01_02_Planung':                85,
  '02_01_Konstruktion':           75,
  '02_02_Arbeitsvorbereitung':    75,
  '03_00_Produktion':             65,
  '03_01_Warenhandling':          65,
  '03_02_Zuschnitt':              72,
  '03_03_Bekantung':             100,
  '03_04_CNC':                   120,
  '03_05_Oberflaechenbehandlung': 72,
  '03_07_Verpacken':              65,
  '03_08_Azubi':                  52,
  '05_01_Montage':                65,
  '06_01_Lieferung':              65,
}

export const KOSTENSTELLEN_GRUPPEN: Record<string, KostenstelleId[]> = {
  'Planung':       ['00_Meeting', '01_02_Planung', '02_01_Konstruktion', '02_02_Arbeitsvorbereitung'],
  'Maschinenraum': ['03_02_Zuschnitt', '03_03_Bekantung', '03_04_CNC', '03_05_Oberflaechenbehandlung'],
  'Bankraum':      ['03_00_Produktion', '03_01_Warenhandling', '03_07_Verpacken', '03_08_Azubi'],
  'Montage':       ['05_01_Montage', '06_01_Lieferung'],
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

export interface ArbeitsPosten {
  id: number
  kostenstelle: KostenstelleId
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
  black: '#0D0D0D',
  darkbg: '#141414',
  copper: '#C8885A',
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
export const inDays = (d: number) => new Date(Date.now() + d * 864e5).toLocaleDateString('de-DE')

// ── Kostenstellen Labels ─────────────────────────────
export const KOSTENSTELLEN_LABELS: Record<KostenstelleId, string> = {
  '00_Meeting':                   'Besprechung',
  '01_02_Planung':                'Planung',
  '02_01_Konstruktion':           'Konstruktion',
  '02_02_Arbeitsvorbereitung':    'Arbeitsvorbereitung',
  '03_00_Produktion':             'Produktion',
  '03_01_Warenhandling':          'Warenwirtschaft',
  '03_02_Zuschnitt':              'Zuschnitt',
  '03_03_Bekantung':              'Kantenanleimen',
  '03_04_CNC':                    'CNC',
  '03_05_Oberflaechenbehandlung': 'Oberflächenbehandlung',
  '03_07_Verpacken':              'Verpackung',
  '03_08_Azubi':                  'Lehrling',
  '05_01_Montage':                'Montage',
  '06_01_Lieferung':              'Lieferung und Fahrtzeiten',
}

export function calcAngebotspos(p: Angebotsposition): number {
  const mat = p.material.reduce((s, m) => s + m.menge * m.ekPreis * (1 + m.aufschlag), 0)
  const arb = p.arbeitszeit.reduce((s, a) => s + (a.minuten / 60) * a.vkStunde, 0)
  return mat + arb
}

// ── Demo-Kunden ──────────────────────────────────────
export const DEMO_KUNDEN: KundeDB[] = [
  { id: 1, name: 'Familie Müller', zusatz: 'Thomas Müller', strasse: 'Hauptstr. 12', ort: '63500 Seligenstadt', projekt: '', typ: 'Privat' },
  { id: 2, name: 'Büro Schmidt GmbH', zusatz: 'Anna Schmidt', strasse: 'Industrieweg 5', ort: '63739 Aschaffenburg', projekt: '', typ: 'Gewerbe' },
  { id: 3, name: 'Stiftung Haus Mirjam', zusatz: 'Amelie Wissel', strasse: 'Ernstkirchen 4', ort: '63825 Schöllkrippen', projekt: '', typ: 'Gemeinnützig' },
]

// ── Kunden DB (localStorage) ─────────────────────────
export function ladeKunden(): KundeDB[] {
  if (typeof window === 'undefined') return DEMO_KUNDEN
  try {
    const d = localStorage.getItem('craftflow_kunden')
    return d ? JSON.parse(d) : DEMO_KUNDEN
  } catch {
    return DEMO_KUNDEN
  }
}

export function speichereKunden(kunden: KundeDB[]) {
  if (typeof window === 'undefined') return
  try { localStorage.setItem('craftflow_kunden', JSON.stringify(kunden)) } catch {}
}
