// Die EINE Adresse, die Admin-Rechte hat. Stand bis zum 2026-09-17 fünfmal im Code
// (vier API-Routen plus die Einstellungen-Oberfläche) — fünf Stellen, die beim
// nächsten Wechsel alle einzeln gefunden werden müssten.
//
// Reine Daten ohne Importe: `npm run test` führt src/lib direkt aus.

export const ADMIN_EMAIL = 'l.m.p.1@gmx.de'

/** true nur für genau diese Adresse. `null`/`undefined` (nicht eingeloggt) ist nie Admin. */
export function istAdmin(email: string | null | undefined): boolean {
  return typeof email === 'string' && email === ADMIN_EMAIL
}
