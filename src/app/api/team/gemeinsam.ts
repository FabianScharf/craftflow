// Gemeinsames Werkzeug der Team-Routen (Teamfunktion, Fabian 2026-09-17).
//
// WARUM EINE DATEI: Einladen und „Erneut senden" bauen denselben Link und
// schicken dieselbe Mail. Zwei Kopien davon wären zwei Stellen, an denen die
// Adresse des Links falsch werden kann — und der Link ist das ganze Feature.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Mitglied } from '@/lib/konto'
import { APP_URL, einladungsMail } from '@/lib/mail/vorlagen'
import { sendeMail } from '@/lib/mail/resend'

/** Genau die Spalten, die `Mitglied` kennt. `token` wird einzeln geholt (Geheimnis). */
export const MITGLIED_FELDER = 'id, inhaber_id, user_id, email, status, angenommen_am, eingeladen_am'

/**
 * Der Einladungslink. Absolut und auf die App-Domain, NICHT auf die Website und
 * nicht auf `window.location.origin` — dieselbe Lehre wie beim Registrierungslink
 * (08.09.).
 *
 * EINE Ausnahme (Controller, 2026-09-17, Live-Test der Teamfunktion mit Fabians
 * iCloud-Adresse): Auf einem Vercel-VORSCHAU-Deployment zeigt der Link auf genau
 * diese Vorschau (VERCEL_BRANCH_URL), sonst landete jeder Testklick auf der Live-App,
 * die die Teamfunktion noch gar nicht hat. Produktion (VERCEL_ENV = 'production')
 * bleibt fest auf app.getcraftflow.de.
 */
export function einladungsLink(token: string): string {
  const vorschau = process.env.VERCEL_ENV === 'preview' && process.env.VERCEL_BRANCH_URL
  const basis = vorschau ? `https://${process.env.VERCEL_BRANCH_URL}` : APP_URL
  return `${basis}/einladung/${token}`
}

/** Token-Form prüfen, bevor damit gesucht wird: eine uuid, sonst gar nicht erst fragen. */
export function istToken(t: unknown): t is string {
  return typeof t === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(t)
}

/** Alle Zeilen des Betriebs (inkl. „entfernt" — die Wiedereinladung braucht sie). */
export async function ladeMitglieder(supabase: SupabaseClient, inhaberId: string): Promise<Mitglied[] | null> {
  const { data, error } = await supabase
    .from('betrieb_mitglieder')
    .select(MITGLIED_FELDER)
    .eq('inhaber_id', inhaberId)
  if (error) {
    // Supabase wirft nicht, es liefert {data:null, error} — wer nur data liest,
    // hält einen Ausfall für einen leeren Betrieb (Lehre, Vault).
    console.error('[api/team] Mitglieder laden:', error.message)
    return null
  }
  return (data ?? []) as unknown as Mitglied[]
}

/** Firmenname des Betriebs für Mail und Einladungsseite; null, wenn nie eingetragen. */
export async function ladeBetriebName(supabase: SupabaseClient, kontoId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('betriebsprofil')
    .select('firma_name')
    .eq('user_id', kontoId)
    .maybeSingle()
  if (error) {
    console.error('[api/team] Firmenname laden:', error.message)
    return null
  }
  const name = (data?.firma_name ?? '') as string
  return name.trim() || null
}

/**
 * Mail raus. Der Rückgabewert wird NIE verschluckt: Wenn Resend ablehnt, muss die
 * Route 502 mit dem Grund antworten — die Zeile steht dann schon, „Erneut senden"
 * ist der Ausweg. Eine stumme Ablehnung wäre ein Teamplatz, der belegt ist, ohne
 * dass je eine Mail ankam (Lehre „KI-Werkzeuge: stille Fehler").
 */
export async function schickeEinladung(opts: { an: string; betriebName: string | null; einladerEmail: string; token: string }) {
  return sendeMail(opts.an, einladungsMail({
    betriebName: opts.betriebName,
    einladerEmail: opts.einladerEmail,
    link: einladungsLink(opts.token),
  }))
}
