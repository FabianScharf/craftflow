// Verschlüsselung für Zugangsdaten, die CraftFlow im Auftrag des Betriebs
// aufbewahren muss — heute das SMTP-Passwort.
//
// ANLASS (Fabian, 19.09.2026): „Das SMTP Passwort muss natürlich verschlüsselt
// werden." Die Spalte hieß seit jeher `smtp_password_encrypted`, aber es fand
// **keinerlei** Verschlüsselung statt: Der Wert ging unverändert an nodemailer,
// und `crypto` kam im ganzen Projekt nur für `randomUUID()` vor. Der Name hat
// eine Sicherheit behauptet, die es nicht gab.
//
// VERFAHREN: AES-256-GCM. GCM statt CBC, weil es neben der Verschlüsselung auch
// erkennt, ob jemand am Geheimtext manipuliert hat (Authentifizierungs-Etikett).
// Je Vorgang ein neuer Zufallsvektor — derselbe Klartext ergibt nie zweimal
// denselben Geheimtext.
//
// SCHLÜSSEL: Umgebungsvariable `GEHEIMNIS_SCHLUESSEL`, 32 Byte als Hex (64
// Zeichen). Erzeugen mit:  openssl rand -hex 32
// Der Schlüssel steht NUR in den Vercel-Umgebungsvariablen, nie im Repo.
//
// UMGANG MIT DEM BESTAND: Gespeicherte Werte ohne das Kennzeichen `v1:` sind
// Altbestand im Klartext. `entschluessele` gibt sie unverändert zurück, damit
// der Mailversand weiterläuft — und meldet es im Log. Beim nächsten Speichern
// wird daraus ein verschlüsselter Wert.

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

const KENNZEICHEN = 'v1'
const VERFAHREN = 'aes-256-gcm'
const IV_BYTES = 12   // für GCM empfohlen
const SCHLUESSEL_BYTES = 32

export class GeheimnisFehlt extends Error {
  constructor() {
    super(
      'GEHEIMNIS_SCHLUESSEL fehlt oder ist ungültig. '
      + 'Erzeugen mit „openssl rand -hex 32" und in den Vercel-Umgebungsvariablen hinterlegen.',
    )
    this.name = 'GeheimnisFehlt'
  }
}

/** Liest den Schlüssel. Wirft, wenn er fehlt — nie stillschweigend weitermachen. */
function schluessel(): Buffer {
  const hex = process.env.GEHEIMNIS_SCHLUESSEL ?? ''
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) throw new GeheimnisFehlt()
  const b = Buffer.from(hex, 'hex')
  if (b.length !== SCHLUESSEL_BYTES) throw new GeheimnisFehlt()
  return b
}

/** Ist ein Schlüssel hinterlegt? Für Routen, die vorher prüfen wollen. */
export function schluesselVorhanden(): boolean {
  try { schluessel(); return true } catch { return false }
}

/** Erkennt, ob ein gespeicherter Wert verschlüsselt ist. */
export function istVerschluesselt(wert: string | null | undefined): boolean {
  return typeof wert === 'string' && wert.startsWith(`${KENNZEICHEN}:`)
}

/**
 * Verschlüsselt einen Klartext. Ergebnis: `v1:<iv>:<etikett>:<geheimtext>`,
 * alle Teile base64. Leerer Text bleibt leer — ein leeres Passwort ist kein
 * Geheimnis, und ein verschlüsselter Leerstring wäre nur Ballast.
 */
export function verschluessele(klartext: string): string {
  if (!klartext) return ''
  const iv = randomBytes(IV_BYTES)
  const c = createCipheriv(VERFAHREN, schluessel(), iv)
  const geheim = Buffer.concat([c.update(klartext, 'utf8'), c.final()])
  const etikett = c.getAuthTag()
  return [KENNZEICHEN, iv.toString('base64'), etikett.toString('base64'), geheim.toString('base64')].join(':')
}

/**
 * Entschlüsselt einen gespeicherten Wert.
 *
 * Altbestand (ohne `v1:`) kommt unverändert zurück — sonst stünde der
 * Mailversand aller Betriebe still, die ihr Passwort vor der Umstellung
 * hinterlegt haben. Das ist Absicht und endet, sobald sie einmal gespeichert
 * haben.
 */
export function entschluessele(gespeichert: string | null | undefined): string {
  const w = gespeichert ?? ''
  if (!w) return ''
  if (!istVerschluesselt(w)) {
    console.warn('[geheimnis] Wert liegt noch im Klartext vor — wird beim nächsten Speichern verschlüsselt.')
    return w
  }
  const [, ivB64, etikettB64, geheimB64] = w.split(':')
  if (!ivB64 || !etikettB64 || !geheimB64) {
    throw new Error('Gespeichertes Geheimnis ist unvollständig.')
  }
  const d = createDecipheriv(VERFAHREN, schluessel(), Buffer.from(ivB64, 'base64'))
  d.setAuthTag(Buffer.from(etikettB64, 'base64'))
  return Buffer.concat([d.update(Buffer.from(geheimB64, 'base64')), d.final()]).toString('utf8')
}
