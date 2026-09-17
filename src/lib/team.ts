// Reine Team-Logik: E-Mail-Prüfung, freie Nutzerplätze, Reihenfolge der Mitglieder
// und die Texte, mit denen eine Ablehnung ihren Grund nennt.
//
// Importiert nur aus ./plaene.ts (mit .ts-Endung) — damit `npm run test` die Datei
// direkt ausführen kann. Kein React, kein Supabase (Repo-Regel).
//
// ANLASS (Fabian 2026-09-17): Die Plan-Matrix bewirbt „1 / 1 / 3 / unbegrenzt Nutzer",
// aber jedes Konto war genau ein Login. Der Nutzer-Deckel stand in plaene.ts und wurde
// nirgends durchgesetzt.

import { deckel, type EffektiverPlan } from './plaene.ts'

/**
 * E-Mail-Prüfung für die Einladung. Absichtlich streng statt clever: genau ein @,
 * keine Leerzeichen, und eine Domain mit Punkt und mindestens zweistelliger Endung.
 * Eine Einladung an „a@b" wäre eine Mail, die nie ankommt — und ein Teamplatz, der
 * bis zum manuellen Löschen belegt bleibt.
 */
export function emailGueltig(e: string): boolean {
  if (typeof e !== 'string') return false
  const s = e.trim()
  if (s.length < 6 || s.length > 254) return false
  return /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)*\.[A-Za-z]{2,}$/.test(s)
}

/**
 * Speicherform der eingeladenen Adresse. Muss überall gleich sein, weil
 * `unique (inhaber_id, email)` in der Datenbank sonst „Chef@Firma.de" und
 * „chef@firma.de" für zwei verschiedene Einladungen hält.
 */
export function normalisiereEmail(e: string): string {
  return String(e ?? '').trim().toLowerCase()
}

/**
 * Freie Nutzerplätze des Betriebs. DER INHABER BELEGT IMMER PLATZ 1 (Spec §2) —
 * Pro (3 Nutzer) erlaubt also zwei Mitglieder, Solo und Starter (1 Nutzer) keins.
 * `eingeladene` zählt mit, damit nicht drei offene Einladungen den Deckel sprengen,
 * sobald sie alle angenommen werden.
 *
 * frei = null heißt unbegrenzt (Enterprise) — nicht „0".
 */
export function plaetzeFrei(plan: EffektiverPlan, aktive: number, eingeladene: number): { frei: number | null; voll: boolean } {
  const grenze = deckel(plan, 'nutzer')
  if (grenze === null) return { frei: null, voll: false }
  const frei = Math.max(0, grenze - 1 - aktive - eingeladene)
  return { frei, voll: frei <= 0 }
}

/**
 * Reihenfolge, in der Mitglieder die Plätze belegen: die älteste Annahme zuerst
 * (dieselbe Regel wie `wendeDeckelAn` in plaene.ts — beim Wechsel nach unten bleiben
 * die ältesten aktiv, nichts wird gelöscht). Noch nicht Angenommene haben kein
 * `angenommen_am` und stehen hinten, untereinander nach Einladungsdatum.
 *
 * Gibt eine neue Liste zurück; die Eingabe bleibt unangetastet (sort() würde sonst
 * die Liste des Aufrufers umsortieren).
 */
export function sortiereNachAnnahme<T extends { angenommen_am: string | null; eingeladen_am: string }>(l: T[]): T[] {
  return [...l].sort((a, b) => {
    if (a.angenommen_am && b.angenommen_am) return a.angenommen_am < b.angenommen_am ? -1 : a.angenommen_am > b.angenommen_am ? 1 : 0
    if (a.angenommen_am) return -1
    if (b.angenommen_am) return 1
    return a.eingeladen_am < b.eingeladen_am ? -1 : a.eingeladen_am > b.eingeladen_am ? 1 : 0
  })
}

/**
 * Die vier Sätze, mit denen das Team-Feature ablehnt. Eine Ablehnung ohne Grund ist
 * ein stiller Fehler (Lehre „KI-Werkzeuge: stille Fehler") — deshalb stehen sie hier
 * an einer Stelle und nicht verstreut in den Routen.
 */
export const TEAM_TEXTE = {
  nurInhaber: 'Nur der Inhaber des Betriebs kann das.',
  voll: (plan: string) => `Dein Plan ${plan} hat keine freien Nutzerplätze mehr.`,
  ruhend: 'Dein Betrieb hat aktuell weniger Nutzerplätze als Mitglieder — sprich mit dem Inhaber.',
  entfernt: 'Du gehörst diesem Betrieb nicht mehr an.',
}
