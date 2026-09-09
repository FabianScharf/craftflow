// Das Register aller Rundschreiben an Bestandsnutzer.
//
// Ablauf (Fabian, 2026-09-09: „so unkompliziert wie möglich“):
//   1. Neue Mail als Funktion schreiben (wie neuigkeitenMail in vorlagen.ts) und hier
//      mit eindeutiger Kennung eintragen. Sonst nichts — kein Datenbankfeld, keine Route.
//   2. Auf der dev-Vorschau unter Einstellungen → Admin erscheint sie automatisch mit
//      „Vorschau“, „Test an mich“, „Probelauf“, „Senden“.
//   3. Freigabe → main → Fabian klickt live auf Senden.
//
// Die Kennung ist zugleich der Merker in den app_metadata jedes Empfängers
// (`rundschreiben_<kennung>`): Wer sie hat, bekommt dieses Rundschreiben nie ein
// zweites Mal. Deshalb darf eine Kennung nach dem Versand NIE wiederverwendet werden.
//
// Importiert nur aus vorlagen.ts — Tests laufen ohne Bundler.

import { neuigkeitenMail, type Mail } from './vorlagen'

export type Rundschreiben = {
  /** Eindeutig, nur Kleinbuchstaben, Ziffern und Bindestrich. Beginnt mit Jahr-Monat. */
  kennung: string
  /** Für die Admin-Liste. */
  titel: string
  /** Wann die Mail geschrieben wurde — nur zur Orientierung in der Liste. */
  erstellt: string
  mail: () => Mail
}

export const RUNDSCHREIBEN: Rundschreiben[] = [
  {
    kennung: '2026-09-neuigkeiten',
    titel: 'Was ist neu: Mein Betrieb, Meine Bauweise, Alternativen, Starthilfe',
    erstellt: '2026-09-08',
    mail: neuigkeitenMail,
  },
]

export const KENNUNG_MUSTER = /^\d{4}-\d{2}-[a-z0-9-]+$/

export function rundschreibenFinden(kennung: string): Rundschreiben | undefined {
  return RUNDSCHREIBEN.find(r => r.kennung === kennung)
}

/** Name des Merkers in den app_metadata eines Nutzers. */
export function merkerName(kennung: string): string {
  return `rundschreiben_${kennung}`
}
