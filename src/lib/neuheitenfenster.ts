// Das Fenster „Neu in CraftFlow" beim Einloggen — die reine Logik.
//
// ENTSCHEIDUNGEN VON FABIAN (19.09.2026):
//   · „Ansehen" öffnet die Werkstatt-Seite in einem NEUEN Tab — wer sich gerade
//     eingeloggt hat, will kalkulieren; die App darf ihm nicht weggehen.
//   · Das Fenster wird GENAU EINMAL gezeigt: „Ich bin für 1. und das Fenster sollte
//     nur einmal angezeigt werden, sonst nervt es." Der Merker wird deshalb beim
//     Öffnen gesetzt, nicht erst beim Klicken — auch Wegklicken zählt als gesehen.
//   · Verloren geht dadurch nichts: Die Werkstatt-Seite steht dauerhaft unter
//     Einstellungen → Hilfe und in jeder Neuheiten-Mail.
//
// Der Merker liegt in den app_metadata des ANGEMELDETEN NUTZERS, nicht im
// Betriebsprofil: Seit der Teamfunktion teilen sich mehrere Menschen einen Betrieb.
// Ein Merker am Betrieb hieße, der Inhaber klickt weg und der Geselle sieht nie etwas.

export type Fensterneuheit = {
  slug: string
  datum: string
  bereich: string
  titel: string
  kurz: string
  einstufung: 'gross' | 'klein'
  url: string
}

/** So viele passen ins Fenster. Wer sechs Dinge auf einmal liest, merkt sich keins. */
export const HOECHSTENS = 3

export type Anzeige =
  | { art: 'nichts' }
  | { art: 'fenster'; neuheiten: Fensterneuheit[]; weitere: number }
  | { art: 'streifen'; anzahl: number }

/**
 * Was der Nutzer beim Einloggen sehen soll.
 *
 * `gesehenBis` ist der Zeitstempel seines letzten Besuchs im Fenster (ISO) — alles,
 * was danach veröffentlicht wurde, ist für ihn neu. Fehlt er (neues Konto), gilt
 * ALLES als gesehen: Wer sich gerade erst registriert hat, soll nicht mit einer
 * Liste von Neuerungen begrüßt werden, die für ihn gar nicht neu sind.
 */
export function wasZeigen(
  alle: Fensterneuheit[],
  gesehenBis: string | null | undefined,
  kontoAngelegt: string,
): Anzeige {
  // Schwelle: der spätere der beiden Zeitpunkte. Ein frisches Konto sieht nichts,
  // ein altes alles seit seinem letzten Besuch.
  const schwelle = gesehenBis && gesehenBis > kontoAngelegt ? gesehenBis : kontoAngelegt
  const neu = alle
    .filter(n => n.datum > schwelle.slice(0, 10))
    .sort((a, b) => b.datum.localeCompare(a.datum))
  if (neu.length === 0) return { art: 'nichts' }

  // Fenster nur, wenn etwas Großes dabei ist. Kleine Verbesserungen bekommen den
  // schmalen Streifen — sonst stumpft das Fenster ab und wird weggeklickt.
  const hatGrosses = neu.some(n => n.einstufung === 'gross')
  if (!hatGrosses) return { art: 'streifen', anzahl: neu.length }

  // Große zuerst, dann kleine — bei gleicher Einstufung das Neueste oben.
  const sortiert = [...neu].sort((a, b) => {
    if (a.einstufung !== b.einstufung) return a.einstufung === 'gross' ? -1 : 1
    return b.datum.localeCompare(a.datum)
  })
  return {
    art: 'fenster',
    neuheiten: sortiert.slice(0, HOECHSTENS),
    weitere: Math.max(0, sortiert.length - HOECHSTENS),
  }
}
