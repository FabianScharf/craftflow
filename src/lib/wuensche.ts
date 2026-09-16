// Die reine Logik der Wünsche-Community: Status, Textgrenzen und die Frage, welche
// Stimme zählt. Importiert nur aus ./plaene.ts (mit .ts-Endung) — damit
// `npm run test` die Datei direkt ausführen kann.
//
// WARUM DIE ZÄHLUNG HIER LIEGT und nicht in einer SQL-View: Ob eine Stimme zählt,
// hängt am PLAN ihres Urhebers, und die Plan-Logik steht in plaene.ts. Eine View
// müsste sie nachbauen — und würde beim nächsten Matrix-Wechsel lautlos falsch.

import {
  deckel, effektiverPlan, wendeDeckelAn, type ProfilFuerPlan,
} from './plaene.ts'

export type WunschStatus = 'offen' | 'geplant' | 'in_arbeit' | 'fertig' | 'ausgeblendet'

export const WUNSCH_STATUS: WunschStatus[] = ['offen', 'geplant', 'in_arbeit', 'fertig', 'ausgeblendet']

export const STATUS_LABEL: Record<WunschStatus, string> = {
  offen: 'Offen', geplant: 'Geplant', in_arbeit: 'In Arbeit',
  fertig: 'Fertig', ausgeblendet: 'Ausgeblendet',
}

/** Was auf der öffentlichen Roadmap der Website erscheint. „Offen“ bleibt in der App. */
export const OEFFENTLICHE_STATUS: WunschStatus[] = ['geplant', 'in_arbeit', 'fertig']

export const TITEL_MAX = 120
export const BESCHREIBUNG_MAX = 1000
/** Gegen Spam: so viele neue Vorschläge darf ein Nutzer am Tag einreichen. */
export const VORSCHLAEGE_JE_TAG = 3

export function istWunschStatus(v: unknown): v is WunschStatus {
  return typeof v === 'string' && (WUNSCH_STATUS as string[]).includes(v)
}

export type TextPruefung =
  | { ok: true; titel: string; beschreibung: string }
  | { ok: false; grund: string }

/** Prüft und beschneidet die Eingaben. Kein stilles Abschneiden — zu lang wird abgelehnt. */
export function pruefeTexte(titel: unknown, beschreibung: unknown): TextPruefung {
  const t = String(titel ?? '').trim()
  const b = String(beschreibung ?? '').trim()
  if (!t) return { ok: false, grund: 'Bitte gib einen Titel an.' }
  if (t.length > TITEL_MAX) return { ok: false, grund: `Der Titel darf höchstens ${TITEL_MAX} Zeichen haben.` }
  if (b.length > BESCHREIBUNG_MAX) return { ok: false, grund: `Die Beschreibung darf höchstens ${BESCHREIBUNG_MAX} Zeichen haben.` }
  return { ok: true, titel: t, beschreibung: b }
}

export type Stimme = { wunsch_id: string; user_id: string; created_at: string }

/** Wie viele Stimmen dieser Nutzer nach seinem Plan hat. Gesperrt = 0. */
export function stimmenbudget(profil: ProfilFuerPlan | null | undefined, jetzt: Date = new Date()): number {
  return deckel(effektiverPlan(profil, jetzt), 'wunschStimmen') ?? 0
}

/**
 * Welche Stimmen zählen. Je Nutzer bleiben die ÄLTESTEN N aktiv (wendeDeckelAn),
 * alle weiteren zählen nicht — dieselbe Regel wie bei Bauweise-Regeln und
 * Materialpreisen. Nichts wird gelöscht; ein Upgrade wirkt sofort beim nächsten Lesen.
 */
export function aktiveStimmen(
  stimmen: Stimme[],
  profile: Record<string, ProfilFuerPlan | null | undefined>,
  jetzt: Date = new Date(),
): Stimme[] {
  const jeNutzer = new Map<string, Stimme[]>()
  for (const s of stimmen ?? []) {
    const liste = jeNutzer.get(s.user_id) ?? []
    liste.push(s)
    jeNutzer.set(s.user_id, liste)
  }
  const aktiv: Stimme[] = []
  for (const [userId, liste] of jeNutzer) {
    const budget = stimmenbudget(profile[userId], jetzt)
    for (const s of wendeDeckelAn(liste, budget)) if (s.aktivDurchPlan) aktiv.push(s)
  }
  // Reihenfolge der Eingabe wiederherstellen, damit der Aufrufer sich darauf verlassen kann.
  const erlaubt = new Set(aktiv.map(s => `${s.user_id}|${s.wunsch_id}`))
  return (stimmen ?? []).filter(s => erlaubt.has(`${s.user_id}|${s.wunsch_id}`))
}

/**
 * Stimmen auf ausgeblendete oder zusammengelegte Wünsche zählen nicht gegen das Budget.
 * GEFUNDEN 16.09. (Fabians Screenshot): „2 von 30 Stimmen vergeben", sichtbar war eine —
 * die zweite hing an einem ausgeblendeten Testwunsch, den niemand mehr sieht und dessen
 * Stimme niemand zurückziehen kann. Gelöscht wird nichts: Blendet der Admin den Wunsch
 * wieder ein, zählt die Stimme wieder.
 */
export function ohneVersteckte(stimmen: Stimme[], versteckteIds: Iterable<string>): Stimme[] {
  const versteckt = new Set(versteckteIds)
  return (stimmen ?? []).filter(s => !versteckt.has(s.wunsch_id))
}

/** Zählt je Wunsch die aktiven Stimmen. Wünsche ohne aktive Stimme stehen mit 0 drin. */
export function stimmenJeWunsch(
  stimmen: Stimme[],
  profile: Record<string, ProfilFuerPlan | null | undefined>,
  jetzt: Date = new Date(),
): Record<string, number> {
  const zaehler: Record<string, number> = {}
  for (const s of stimmen ?? []) zaehler[s.wunsch_id] = 0
  for (const s of aktiveStimmen(stimmen, profile, jetzt)) zaehler[s.wunsch_id] += 1
  return zaehler
}

/**
 * Planung fürs Zusammenlegen zweier Wünsche: Stimmen des Quell-Wunsches wandern
 * zum Ziel — aber „eine Stimme je Wunsch je Nutzer" darf dabei nicht verletzt
 * werden. Wer für beide schon gestimmt hat, verliert die Quell-Stimme (Duplikat),
 * niemand bekommt dadurch eine zweite Stimme am Ziel. Reine Funktion — die
 * Admin-Route führt die zurückgegebenen Zeilen dann in der DB aus (Quelle löschen,
 * `uebertragen` am Ziel einfügen).
 */
export function planeZusammenlegenStimmen(
  quelleId: string,
  zielId: string,
  stimmenQuelle: Stimme[],
  stimmenZiel: Stimme[],
): { uebertragen: Stimme[]; verworfen: Stimme[] } {
  const zielUser = new Set((stimmenZiel ?? []).filter(s => s.wunsch_id === zielId).map(s => s.user_id))
  const uebertragen: Stimme[] = []
  const verworfen: Stimme[] = []
  for (const s of (stimmenQuelle ?? []).filter(s => s.wunsch_id === quelleId)) {
    if (zielUser.has(s.user_id)) {
      verworfen.push(s)
    } else {
      uebertragen.push({ ...s, wunsch_id: zielId })
      zielUser.add(s.user_id) // gegen doppelte Stimmen desselben Nutzers innerhalb der Quelle selbst
    }
  }
  return { uebertragen, verworfen }
}
