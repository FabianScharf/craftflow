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

export type Stimme = { id?: string; wunsch_id: string; user_id: string; created_at: string }

/** Wie viele Stimmen dieser Nutzer nach seinem Plan hat. Gesperrt = 0. */
export function stimmenbudget(profil: ProfilFuerPlan | null | undefined, jetzt: Date = new Date()): number {
  return deckel(effektiverPlan(profil, jetzt), 'wunschStimmen') ?? 0
}

/**
 * Welche Stimmen zählen. Je Nutzer bleiben die ÄLTESTEN N aktiv (wendeDeckelAn),
 * alle weiteren zählen nicht — dieselbe Regel wie bei Bauweise-Regeln und
 * Materialpreisen. Nichts wird gelöscht; ein Upgrade wirkt sofort beim nächsten Lesen.
 *
 * KORREKTUR (16.09. abends, Stimmenkonto): Die Reihenfolge wurde vorher über den
 * Schlüssel `user_id|wunsch_id` wiederhergestellt — das reichte, solange je Nutzer und
 * Wunsch höchstens eine Zeile existierte. Seit Stimmen stapelbar sind, teilen sich
 * mehrere Zeilen genau diesen Schlüssel, und der alte Code hätte sie nicht mehr
 * unterscheiden können (Budget 3, 5 gestapelte Stimmen → alle 5 kämen durch statt 3).
 * `wendeDeckelAn` erhält und liefert Zeilen in derselben Reihenfolge zurück (`.map`) —
 * das genügt, um jede ORIGINAL-Zeile über ihren Platz in der Liste eindeutig
 * zurückzuspiegeln, ganz ohne Schlüssel.
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
  const aktivRefs = new Set<Stimme>()
  for (const [userId, liste] of jeNutzer) {
    const budget = stimmenbudget(profile[userId], jetzt)
    const bewertet = wendeDeckelAn(liste, budget)
    for (let i = 0; i < liste.length; i++) if (bewertet[i].aktivDurchPlan) aktivRefs.add(liste[i])
  }
  return (stimmen ?? []).filter(s => aktivRefs.has(s))
}

/**
 * Stimmen auf ausgeblendete, fertige oder zusammengelegte Wünsche zählen nicht gegen
 * das Budget. GEFUNDEN 16.09. (Fabians Screenshot): „2 von 30 Stimmen vergeben",
 * sichtbar war eine — die zweite hing an einem ausgeblendeten Testwunsch, den niemand
 * mehr sieht und dessen Stimme niemand zurückziehen kann. Gelöscht wird nichts:
 * Blendet der Admin den Wunsch wieder ein, zählt die Stimme wieder.
 *
 * NEU (16.09. abends, Stimmenkonto): Fertig zählt jetzt genauso wenig wie ausgeblendet
 * oder zusammengelegt — wer für einen fertigen Wunsch gestimmt hat, bekommt die Stimme
 * automatisch zurück und kann sie anderswo einsetzen. Die Routen liefern dafür auch die
 * ids von Wünschen mit `status = 'fertig'` in `versteckteIds` hinein.
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
 * Planung fürs Zusammenlegen zweier Wünsche: ALLE Stimmen des Quell-Wunsches wandern
 * zum Ziel. NEU (16.09. abends, Stimmenkonto): keine Dubletten-Regel mehr — Stapeln
 * ist erlaubt, ein Nutzer darf am Ziel schon Stimmen liegen haben, es kommen einfach
 * weitere dazu. `loeschen` sind die Quellzeilen (an ihrem alten Platz), `uebertragen`
 * dieselben Zeilen mit `wunsch_id = zielId`. Reine Funktion, für den Test erhalten —
 * die Admin-Route selbst verschiebt die Zeilen inzwischen direkt per SQL-Update
 * (`set wunsch_id = ziel where wunsch_id = quelle`), damit ids/created_at erhalten
 * bleiben, statt löschen+einfügen über diese Funktion zu fahren.
 */
export function planeZusammenlegenStimmen(
  quelleId: string,
  zielId: string,
  stimmenQuelle: Stimme[],
): { loeschen: Stimme[]; uebertragen: Stimme[] } {
  const loeschen = (stimmenQuelle ?? []).filter(s => s.wunsch_id === quelleId)
  const uebertragen = loeschen.map(s => ({ ...s, wunsch_id: zielId }))
  return { loeschen, uebertragen }
}

/**
 * Wie viele Stimmen dieser Nutzer auf jeden Wunsch gelegt hat — AKTIVE und RUHENDE
 * zusammen. Anders als `stimmenJeWunsch` wird hier nicht nach Plan-Budget gedeckelt:
 * Die Anzeige "deine 3" soll zeigen, was der Nutzer tatsächlich hingelegt hat, auch
 * wenn ein Teil davon gerade ruht (Wechsel nach unten).
 */
export function eigeneStimmenJeWunsch(stimmen: Stimme[], userId: string): Record<string, number> {
  const zaehler: Record<string, number> = {}
  for (const s of stimmen ?? []) {
    if (s.user_id !== userId) continue
    zaehler[s.wunsch_id] = (zaehler[s.wunsch_id] ?? 0) + 1
  }
  return zaehler
}
