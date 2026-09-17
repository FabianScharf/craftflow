// Kontoauflösung: WESSEN Daten sieht ein Login? Das ist die Kernfrage der
// Teamfunktion (Fabian 2026-09-17) und die einzige Stelle, die sie beantwortet.
//
// Der Betrieb ist das Konto des Inhabers. Ein Mitarbeiter ist ein eigener Login, der
// auf den Daten des Inhabers arbeitet — alle Tabellen behalten die `user_id` des
// Inhabers, kein Datensatz wandert (Spec Abschnitt 1).
//
// Reine Logik, importiert nur ./team.ts (das seinerseits nur ./plaene.ts kennt) —
// damit `npm run test` die Datei direkt ausführt. Das Laden aus Supabase liegt in
// src/lib/kontoserver.ts.

import { sortiereNachAnnahme } from './team.ts'

/**
 * inhaber     — eigener Betrieb (Standardfall, auch für jeden Neukunden)
 * mitarbeiter — aktives Mitglied innerhalb des Nutzer-Deckels: arbeitet auf dem Konto des Inhabers
 * ruhend      — aktives Mitglied AUSSERHALB des Deckels (Plan wurde verkleinert): Sperrseite
 * entfernt    — der Inhaber hat das Mitglied entfernt: Sperrseite, eigener Betrieb möglich
 */
export type KontoZustand = 'inhaber' | 'mitarbeiter' | 'ruhend' | 'entfernt'

export type Mitglied = {
  id: string
  inhaber_id: string
  user_id: string | null      // null bis zur Annahme der Einladung
  email: string
  status: 'eingeladen' | 'aktiv' | 'entfernt'
  angenommen_am: string | null
  eingeladen_am: string
}

export type Konto = {
  kontoId: string             // der Datenschlüssel: ersetzt user.id in jeder Route
  istInhaber: boolean
  zustand: KontoZustand
  mitglied: Mitglied | null
}

/**
 * Liegt das Mitglied innerhalb des Nutzer-Deckels des Betriebs?
 *
 * DER INHABER BELEGT PLATZ 1 (Spec §2), für Mitglieder bleiben also `deckel - 1`
 * Plätze. Die Reihenfolge ist `angenommen_am` aufsteigend — beim Wechsel nach unten
 * bleiben die ältesten aktiv, alle weiteren ruhen. Nichts wird gelöscht, ein Upgrade
 * wirkt sofort (dieselbe Haltung wie `wendeDeckelAn` in plaene.ts).
 *
 * Fail-closed: steht das Mitglied nicht in `aktiveImBetrieb` (nur bei einem
 * Supabase-Fehler möglich), gilt es als ausserhalb des Deckels. Eine Sperrseite ist
 * ärgerlich, ein stiller Zugriff auf fremde Daten wäre ein Vorfall.
 */
export function istImDeckel(mitglied: Mitglied, aktiveImBetrieb: Mitglied[], nutzerDeckel: number | null): boolean {
  const plaetze = nutzerDeckel === null ? Infinity : Math.max(0, nutzerDeckel - 1)
  if (plaetze === 0) return false
  const pos = sortiereNachAnnahme(aktiveImBetrieb).findIndex(m => m.id === mitglied.id)
  if (pos < 0) return false
  return pos < plaetze
}

/**
 * `meineMitgliedschaften` = alle Zeilen aus betrieb_mitglieder mit `user_id = userId`
 * (jeder Status). `aktiveImBetrieb` = alle aktiven Mitglieder DESSELBEN Betriebs.
 * `nutzerDeckel` = deckel(effektiver Plan des Inhabers, 'nutzer').
 *
 * Ruhende und entfernte Mitglieder bekommen ihre EIGENE kontoId zurück, nie die des
 * Inhabers — sie sehen dann leere, eigene Daten statt fremder (Ruling R1).
 */
export function ermittleKonto(userId: string, meineMitgliedschaften: Mitglied[], aktiveImBetrieb: Mitglied[], nutzerDeckel: number | null): Konto {
  const aktiv = meineMitgliedschaften.find(m => m.status === 'aktiv' && m.user_id === userId)
  if (aktiv) {
    if (istImDeckel(aktiv, aktiveImBetrieb, nutzerDeckel)) {
      return { kontoId: aktiv.inhaber_id, istInhaber: false, zustand: 'mitarbeiter', mitglied: aktiv }
    }
    return { kontoId: userId, istInhaber: false, zustand: 'ruhend', mitglied: aktiv }
  }
  // Entfernt: die Zeile bleibt für die Historie stehen, der Zugang ist weg. Erst wenn
  // KEINE aktive Mitgliedschaft existiert, zählt sie — sonst gewinnt die aktive
  // (entfernt und beim nächsten Betrieb neu eingeladen).
  const weg = meineMitgliedschaften.find(m => m.status === 'entfernt' && m.user_id === userId)
  if (weg) return { kontoId: userId, istInhaber: false, zustand: 'entfernt', mitglied: weg }
  // Offene Einladungen (status 'eingeladen') tragen noch keine user_id und ändern
  // nichts: bis zur Annahme ist der Nutzer sein eigener Betrieb.
  return { kontoId: userId, istInhaber: true, zustand: 'inhaber', mitglied: null }
}
