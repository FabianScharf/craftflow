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

/** Objektpfad im Bucket `projektdateien` — eine Stelle, damit Route und Tests nicht auseinanderlaufen. */
export function bauePfad(userId: string, projektId: string, uuid: string, name: string): string {
  return `${userId}/${projektId}/${uuid}-${sichererName(name)}`
}
