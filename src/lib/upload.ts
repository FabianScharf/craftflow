// Reine Prüf- und Hilfsfunktionen für den Datei-Upload (Teil C, Task C1) — ausgelagert
// aus der Route, damit sie ohne NextRequest/File in tests/upload.test.mjs laufen. Node
// führt .ts-Dateien direkt aus (Type Stripping), keine Test-Pakete nötig.
//
// Grenzen wörtlich aus der Spec: Datei ≤ 10 MB, erlaubt sind JPG, PNG, WEBP und PDF.

export const MAX_BYTES = 10 * 1024 * 1024
export const ERLAUBTE_TYPEN = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
export const ERLAUBTE_ENDUNGEN = ['.jpg', '.jpeg', '.png', '.webp', '.pdf']

/**
 * Dateiname ohne Pfadtrenner und Sonderzeichen, die den Storage-Pfad sprengen würden
 * (der Name landet 1:1 hinter `<user_id>/<projekt_id>/<uuid>-` im Objektpfad).
 */
export function sichererName(name: string): string {
  return String(name ?? 'datei')
    .replace(/[/\\]/g, '-')
    .replace(/[^A-Za-z0-9._\- ]/g, '_')
    .slice(-80) || 'datei'
}

export type DateiPruefung = { ok: true } | { ok: false; error: string }

/** Größe und Typ prüfen. Der Typ gilt als erlaubt, wenn MIME-Typ ODER Endung passt. */
export function pruefeDatei(datei: { name: string; size: number; type: string }): DateiPruefung {
  if (datei.size > MAX_BYTES) {
    return { ok: false, error: `„${datei.name}“ ist größer als 10 MB.` }
  }
  const punkt = datei.name.lastIndexOf('.')
  const endung = punkt >= 0 ? datei.name.slice(punkt).toLowerCase() : ''
  if (!ERLAUBTE_TYPEN.includes(datei.type) && !ERLAUBTE_ENDUNGEN.includes(endung)) {
    return { ok: false, error: `„${datei.name}“ ist kein Bild und kein PDF. Erlaubt sind JPG, PNG, WEBP und PDF.` }
  }
  return { ok: true }
}

/**
 * Zählt eine Datei gegen den Deckel `dateien`? Dateien mit führendem Unterstrich sind
 * interne Zwischenstände (z. B. `_vorbereitet.json` aus Teil C2) und zählen nicht mit.
 */
export function zaehltGegenDeckel(name: string): boolean {
  return !name.startsWith('_')
}

/**
 * Objektpfad im Bucket `projektdateien` — eine Stelle, damit Route und Tests nicht
 * auseinanderlaufen. Erstes Segment ist die `kontoId` (Teamfunktion: der Betrieb),
 * nicht `user.id` eines einzelnen Logins — ein Mitarbeiter legt Dateien im Ordner
 * des Inhabers ab, RLS erlaubt das über `konto_ids()`.
 */
export function bauePfad(kontoId: string, projektId: string, uuid: string, name: string): string {
  return `${kontoId}/${projektId}/${uuid}-${sichererName(name)}`
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * Sieht das wie eine echte UUID aus (v1–v5)? Gegen Pfad-Traversal und fremde IDs,
 * bevor `projekt_id` aus dem Client überhaupt in eine Datenbankabfrage geht
 * (Fix-Runde 1, Review-Important: `projekt_id` wurde bis dahin ungeprüft übernommen).
 */
export function istUuid(v: string): boolean {
  return UUID_REGEX.test(v)
}

/**
 * Echter Bild-Medientyp aus den ersten Bytes (Magic Bytes), mit Fallback auf die
 * Dateiendung. Fix-Runde 1 (Live-Test 2026-09-16): Die Block-Route schickte JEDES
 * Bild als `image/jpeg` an Claude — bei einem hochgeladenen PNG antwortet Claude mit
 * 400 ("the image appears to be a image/png image"), weil der deklarierte Typ nicht
 * zu den echten Bytes passt. Dateien werden seit Teil C unverändert hochgeladen
 * (PNG, WebP, JPEG), also muss der Typ aus der Datei selbst kommen, nicht geraten
 * werden. Unbekannt (weder Bytes noch Endung eindeutig) → null, der Aufrufer
 * überspringt das Bild dann NAMENTLICH statt es mit falschem Typ zu senden.
 */
export function bildMedientyp(bytes: Uint8Array, name: string): 'image/png' | 'image/jpeg' | 'image/webp' | null {
  // PNG-Signatur: 89 50 4E 47 ...
  if (bytes.length >= 4 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return 'image/png'
  }
  // JPEG-Signatur: FF D8 FF
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg'
  }
  // WebP: RIFF-Container (Bytes 0–3) mit "WEBP"-Kennung ab Byte 8
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) {
    return 'image/webp'
  }
  // Magic Bytes nicht erkannt (z. B. abgeschnittener Download) — Endung als Fallback.
  const punkt = name.lastIndexOf('.')
  const endung = punkt >= 0 ? name.slice(punkt).toLowerCase() : ''
  if (endung === '.png') return 'image/png'
  if (endung === '.jpg' || endung === '.jpeg') return 'image/jpeg'
  if (endung === '.webp') return 'image/webp'
  return null
}
