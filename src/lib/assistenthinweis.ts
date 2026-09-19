// Wann sich der Hilfe-Assistent von selbst vorstellt.
//
// Fabian, 19.09.: „Ich möchte, dass der Hilfeassistent immer mal wieder aufploppt und
// sich vorstellt. Fragt, ob er unterstützen kann, aber das sollte nicht zu nervig sein."
//
// „Nicht nervig" ist die eigentliche Anforderung, und sie steckt in vier Regeln:
//
//   1. NICHT beim ersten Mal. Wer sich neu anmeldet, hat die Programmvorstellung, den
//      Wizard und die Willkommens-Mail — ein fünfter Hinweis geht unter. Erst ab dem
//      dritten Öffnen.
//   2. NIE, wenn er den Assistenten schon benutzt hat. Wer ihn kennt, braucht keine
//      Vorstellung.
//   3. Wegklicken zählt. Nach dem ersten Mal kommt vierzehn Tage nichts, nach dem
//      zweiten nie wieder. Zweimal „nein" ist eine Antwort.
//   4. Eine Sprechblase am Knopf, kein Fenster über der Arbeit.

export type HinweisStand = {
  /** Wie oft die App geöffnet wurde (zählt die Route bei jedem Start hoch). */
  starts?: number
  /** Wie oft der Hinweis weggeklickt wurde. */
  weggeklickt?: number
  /** Wann er zuletzt gezeigt wurde (ISO). */
  zuletzt?: string | null
  /** Hat der Nutzer den Assistenten schon einmal geöffnet? */
  benutzt?: boolean
}

export const AB_START = 3
export const HOECHSTENS_WEGGEKLICKT = 2
export const RUHE_TAGE = 14

export function zeigeHinweis(stand: HinweisStand, jetzt: Date = new Date()): boolean {
  if (stand.benutzt) return false
  if ((stand.starts ?? 0) < AB_START) return false
  if ((stand.weggeklickt ?? 0) >= HOECHSTENS_WEGGEKLICKT) return false

  if (stand.zuletzt) {
    const vergangen = (jetzt.getTime() - new Date(stand.zuletzt).getTime()) / 86_400_000
    if (vergangen < RUHE_TAGE) return false
  }
  return true
}
