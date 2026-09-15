// Texte der 402-Sperrantworten (planpruefung.ts) — als reine Funktion ausgelagert,
// damit sie ohne Supabase/NextResponse testbar sind (tests/plantexte.test.mjs).
// Importiert bewusst nur aus ./plaene.

import type { Plan } from './plaene'

export type Sperrgrund = 'testphase' | 'gutschein'

/** Antwortkörper für die 402-Sperre — dieselbe Form für beide Gründe, nur der Text ändert sich. */
export function zugangAblehnung(grund: Sperrgrund): { error: string; minPlan: Plan } {
  const texte: Record<Sperrgrund, string> = {
    testphase: 'Deine Testphase ist abgelaufen. Wähle einen Plan, um weiterzuarbeiten.',
    gutschein: 'Dein Gutschein ist abgelaufen. Wähle einen Plan, um weiterzuarbeiten.',
  }
  return { error: texte[grund], minPlan: 'solo' }
}
