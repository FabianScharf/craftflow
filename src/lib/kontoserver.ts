// Die Serverseite der Kontoauflösung: lädt die Mitgliedschaft aus Supabase und gibt
// das Konto zurück, dessen Daten der angemeldete Nutzer bearbeitet.
//
// WARUM EINE EIGENE DATEI: src/lib/konto.ts muss ohne Supabase auskommen, damit
// `npm run test` sie direkt ausführen kann (Repo-Regel). Alles, was einen Client
// braucht, liegt deshalb hier — diese Datei wird von keinem Test importiert.
//
// AB JETZT IST `konto.kontoId` DER DATENSCHLÜSSEL in jeder Route, nicht `user.id`.
// Ausnahmen (bleiben user.id): consent, mail/willkommen, notify-signup, Auth-Routen,
// Admin-Gates, admin/rundschreiben, stripe/webhook.

import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { ermittleKonto, type Konto, type Mitglied } from './konto'
import { TEAM_TEXTE } from './team'
import { deckel } from './plaene'
import { ladeEffektivenPlan } from './planpruefung'
import { getSupabaseClient } from './supabase'

// Genau die Spalten, die src/lib/konto.ts kennt — `token` gehört NICHT dazu, der
// Einladungslink hat in der Kontoauflösung nichts zu suchen.
const FELDER = 'id, inhaber_id, user_id, email, status, angenommen_am, eingeladen_am, ruht'

/**
 * Welchen Betrieb bearbeitet dieser Login?
 *
 * Drei Abfragen im schlechtesten Fall (eigene Mitgliedschaften, aktive Mitglieder des
 * Betriebs, Plan des Inhabers) — für einen Inhaber ohne Team ist es genau eine.
 *
 * FEHLERFALL: Bei einem Supabase-Fehler gilt der Nutzer als eigener Betrieb. Das ist
 * die fail-closed-Seite: er sieht dann nur seine eigenen (bei einem Mitarbeiter
 * leeren) Daten — nie fremde. Der Fehler wird geloggt, nicht verschluckt
 * (Supabase wirft nicht, es liefert {data:null, error}).
 */
export async function kontoIdFuer(supabase: SupabaseClient, user: { id: string }): Promise<Konto> {
  const eigenerBetrieb: Konto = { kontoId: user.id, istInhaber: true, zustand: 'inhaber', mitglied: null }

  const { data: meine, error } = await supabase
    .from('betrieb_mitglieder')
    .select(FELDER)
    .eq('user_id', user.id)
  if (error) {
    console.error('[kontoserver] Mitgliedschaften laden:', error.message)
    return eigenerBetrieb
  }
  const liste = (meine ?? []) as unknown as Mitglied[]

  const aktiv = liste.find(m => m.status === 'aktiv' && m.user_id === user.id)
  // Kein aktives Mitglied: entweder eigener Betrieb oder entfernt — beides entscheidet
  // ermittleKonto ohne weitere Abfrage (der Deckel spielt dort keine Rolle).
  if (!aktiv) return ermittleKonto(user.id, liste, [], null)

  const { data: aktive, error: fehlerAktive } = await supabase
    .from('betrieb_mitglieder')
    .select(FELDER)
    .eq('inhaber_id', aktiv.inhaber_id)
    .eq('status', 'aktiv')
  if (fehlerAktive) {
    console.error('[kontoserver] Aktive Mitglieder laden:', fehlerAktive.message)
    return eigenerBetrieb
  }

  // Der Plan des INHABERS entscheidet über die Nutzerplätze, nicht der des Mitglieds
  // (ein Mitarbeiter hat selbst gar keinen). Die betriebsprofil-Policy erlaubt das
  // Lesen über konto_ids().
  const plan = await ladeEffektivenPlan(supabase, aktiv.inhaber_id)
  const konto = ermittleKonto(user.id, liste, (aktive ?? []) as unknown as Mitglied[], deckel(plan, 'nutzer'))

  // Gesamtprüfung I1 (17.09.): Den Ruhend-Zustand in die Zeile schreiben, damit
  // konto_ids()/konto_id() in SQL ein ruhendes Mitglied ausschließen — sonst bliebe
  // dem Browser (Anon-Key + Sitzung) der RLS-Zugriff auf den Betrieb, obwohl die App
  // sperrt. Nur bei Abweichung, über die Service-Role (die Update-Policy gehört dem
  // Inhaber). Ein Fehler hier ändert das Ergebnis nicht — die App-Sperre gilt ohnehin.
  const ruhtSoll = konto.zustand === 'ruhend'
  if (Boolean(aktiv.ruht) !== ruhtSoll) {
    try {
      const { error: rErr } = await getSupabaseClient()
        .from('betrieb_mitglieder').update({ ruht: ruhtSoll }).eq('id', aktiv.id)
      if (rErr) console.error('[kontoserver] ruht schreiben:', rErr.message)
    } catch (e) {
      console.error('[kontoserver] ruht schreiben:', e instanceof Error ? e.message : String(e))
    }
  }
  return konto
}

/**
 * Tor für jede Route, die Betriebsdaten anfasst:
 *   const konto = await kontoIdFuer(supabase, user)
 *   const sperre = kontoGesperrt(konto); if (sperre) return sperre
 *
 * null = darf arbeiten. Sonst 403 MIT GRUND — eine stumme Ablehnung ist ein Fehler
 * (Lehre „KI-Werkzeuge: stille Fehler"). `zustand` liegt mit in der Antwort, damit die
 * Oberfläche die richtige Sperrseite zeigen kann.
 *
 * GET /api/konto ruft das absichtlich NICHT auf — die Sperrseite braucht den Zustand.
 */
export function kontoGesperrt(konto: Konto): NextResponse | null {
  if (konto.zustand === 'ruhend') {
    return NextResponse.json({ error: TEAM_TEXTE.ruhend, zustand: konto.zustand }, { status: 403 })
  }
  if (konto.zustand === 'entfernt') {
    return NextResponse.json({ error: TEAM_TEXTE.entfernt, zustand: konto.zustand }, { status: 403 })
  }
  return null
}
