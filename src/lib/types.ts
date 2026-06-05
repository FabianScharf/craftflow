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
  kalkTyp: 'stunden' | 'pauschale' | 'qm' | 'lfm'
  menge: number
  einheit: string
  ep: number
  std: number
  mat: number
  aufschlag: number
}

export interface KalkResult {
  ep: number
  gesamt: number
  matTotal?: number
  lohn?: number
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
  Schrank: '#C8885A',
  Schreibtisch: '#8A6A4A',
  Montage: '#5A6A7A',
  Sonstiges: '#6A5A7A',
}

export const KALK_TYPEN = [
  { id: 'stunden',   label: 'Std × Satz', icon: '⏱', desc: 'Stunden × Stundensatz + Material' },
  { id: 'pauschale', label: 'Pauschale',  icon: '💶', desc: 'Fester Gesamtpreis' },
  { id: 'qm',        label: 'pro m²',     icon: '📐', desc: 'Preis pro m²' },
  { id: 'lfm',       label: 'pro lfd. m', icon: '📏', desc: 'Preis pro laufenden Meter' },
]

// ── Kalkulation ──────────────────────────────────────
export function calcPos(p: Position, globalStd: number): KalkResult {
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
