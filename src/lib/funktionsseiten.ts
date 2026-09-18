// Die Funktionsseiten der Werkstatt — damit der Hilfe-Assistent auf sie verweisen kann.
//
// ANLASS (Fabian, 18.09.2026): „Gut wäre, wenn wir zu allen Funktionen eine komplett
// eigenständige Seite machen, auf die der Hilfeassistent auch verweisen kann."
//
// WARUM ZUR LAUFZEIT GEHOLT UND NICHT HIER GEPFLEGT: Die Seiten leben im Website-Repo
// (lib/funktionen.ts). Eine zweite Liste hier wäre ein Duplikat, das beim nächsten
// Eintrag lautlos veraltet — genau der Fehler, den der Assistent schon einmal gemacht
// hat (er kannte am 08.09. keine einzige Neuerung der Woche). Die Website ist
// öffentlich, also kann die App sie lesen, auch aus der geschützten dev-Vorschau.
//
// Fällt die Website aus, bleibt der Assistent vollständig — nur ohne Links. Ein
// fehlender Verweis ist ein Schönheitsfehler, ein hängender Assistent wäre keiner.

export type Funktionsseite = {
  slug: string
  titel: string
  kurz: string
  url: string
}

const QUELLE = 'https://www.getcraftflow.de/api/neuheiten'

/** Je Lambda-Instanz einmal holen; die Liste ändert sich mit Live-Gängen, nicht laufend. */
let zwischenspeicher: { zeit: number; liste: Funktionsseite[] } | null = null
const HALTBAR_MS = 10 * 60 * 1000

export async function ladeFunktionsseiten(): Promise<Funktionsseite[]> {
  if (zwischenspeicher && Date.now() - zwischenspeicher.zeit < HALTBAR_MS) {
    return zwischenspeicher.liste
  }
  try {
    // Kurzer Deckel: Der Assistent darf nie an der Website hängen.
    const res = await fetch(QUELLE, { signal: AbortSignal.timeout(3000) })
    if (!res.ok) return zwischenspeicher?.liste ?? []
    const j = await res.json() as { neuheiten?: Array<Partial<Funktionsseite>> }
    const liste = (j.neuheiten ?? [])
      .filter((n): n is Funktionsseite =>
        typeof n.slug === 'string' && typeof n.titel === 'string' && typeof n.url === 'string')
      .map(n => ({ slug: n.slug, titel: n.titel, kurz: n.kurz ?? '', url: n.url }))
    zwischenspeicher = { zeit: Date.now(), liste }
    return liste
  } catch {
    // Alte Liste ist besser als gar keine.
    return zwischenspeicher?.liste ?? []
  }
}

/**
 * Der Block fürs Assistentenwissen. Rein, damit der Test ihn ohne Netz prüfen kann.
 * Leere Liste → leerer String: Der Assistent bekommt dann keinen Abschnitt, statt
 * einer Überschrift ohne Inhalt.
 */
export function funktionsseitenBlock(seiten: Funktionsseite[]): string {
  if (seiten.length === 0) return ''
  const zeilen = seiten.map(s => `- ${s.titel}: ${s.url}${s.kurz ? ` — ${s.kurz}` : ''}`)
  return [
    '',
    '## AUSFÜHRLICHE ANLEITUNGEN IM NETZ',
    'Zu diesen Funktionen gibt es eine eigene Seite mit Anleitung, Beispiel und Tipps.',
    'Wenn eine Frage dazu passt, erkläre sie kurz UND nenne die Adresse als weiterführende',
    'Quelle. Nenne nie eine Adresse, die hier nicht steht — erfundene Links ärgern nur.',
    ...zeilen,
  ].join('\n')
}
