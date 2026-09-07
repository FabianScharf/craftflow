// Lernschleife: zieht die Zeitfaktoren aus gewonnenen Angeboten nach.
// Importiert bewusst NICHTS.
//
// WARUM AUS GEWONNENEN ANGEBOTEN: Eine beliebige Korrektur ist mehrdeutig — war
// unsere Schaetzung falsch, gibt der Betrieb diesem einen Kunden Rabatt, oder hat er
// Arbeit vergessen, die trotzdem anfaellt? Ein GEWONNENES Angebot hat der Markt
// bestaetigt. Das ist das sauberste Signal, das ohne zusaetzliche Arbeit des Nutzers
// zu haben ist.
//
// ZWEI WARNUNGEN, die beim Bauen leitend waren:
//
// 1. Ein systematischer Fehler wird nicht weggelernt, sondern EINGEBRANNT. Haette der
//    Laufmeter-Fehler bestanden und fuenfzig Betriebe haetten nach unten korrigiert,
//    haette CraftFlow "diese Betriebe kalkulieren 45 % guenstiger" gelernt — ein
//    Programmfehler als Betriebseigenschaft. Deshalb: Daempfung, Mindestmenge und
//    harte Deckelung. Die Schleife soll nachschleifen, nicht umwerfen.
// 2. Sie haengt daran, dass der Angebotsstatus gepflegt wird. Wer nie auf "Gewonnen"
//    klickt, liefert kein Signal — das ist eine Produktfrage, keine technische.

export type Bereich = 'werkstatt' | 'oberflaeche' | 'massivholz' | 'montage'
export type Faktoren = { werkstatt: number; oberflaeche: number; massivholz: number; montage: number }

export type Beobachtung = {
  bereich: Bereich
  /** Was CraftFlow vorgeschlagen hat (Minuten). */
  vorher: number
  /** Was im gewonnenen Angebot stand (Minuten). */
  nachher: number
}

// Erst ab dieser Menge wird ueberhaupt etwas veraendert. Ein einzelnes Angebot ist
// kein Muster — es kann ein Freundschaftspreis oder ein Ausreisser sein.
export const MIN_BEOBACHTUNGEN = 3

// Es wird nur die halbe Strecke zum errechneten Ziel gegangen. Wer sofort ganz
// nachzieht, schwingt bei jedem Ausreisser durch.
export const DAEMPFUNG = 0.5

// Verhaeltnisse ausserhalb dieser Spanne sind keine Kalibrierung, sondern ein
// anderer Sachverhalt (halbe Position geloescht, Sammelposition angelegt).
const RATIO_MIN = 0.33
const RATIO_MAX = 3

const MIN_FAKTOR = 0.6
const MAX_FAKTOR = 1.4

// Welche Kostenstelle zu welchem Bereich zaehlt. Absichtlich dieselbe Aufteilung wie
// in zeitfaktoren.ts — was der Faktor veraendert, muss die Schleife auch beobachten.
const BEREICH_JE_KS: Record<string, Bereich> = {
  Zuschnitt: 'werkstatt', Bekantung: 'werkstatt', CNC: 'werkstatt',
  Zusammenbau: 'werkstatt', Warenhandling: 'werkstatt', Produktion: 'werkstatt',
  Verpacken: 'werkstatt',
  'Oberfläche': 'oberflaeche',
  Montage: 'montage', Lieferung: 'montage',
}

export function bereichFuer(kostenstelle: string): Bereich | null {
  return BEREICH_JE_KS[kostenstelle] ?? null
}

export function median(zahlen: number[]): number {
  if (zahlen.length === 0) return 1
  const s = [...zahlen].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 === 1 ? s[m] : (s[m - 1] + s[m]) / 2
}

function deckele(f: number): number {
  if (!Number.isFinite(f)) return 1
  return Math.min(MAX_FAKTOR, Math.max(MIN_FAKTOR, Math.round(f * 100) / 100))
}

export type Lernergebnis = {
  faktoren: Faktoren
  /** Klartext fuer den Nutzer, je veraendertem Bereich eine Zeile. */
  begruendung: string[]
}

const NAME: Record<Bereich, string> = {
  werkstatt: 'Werkstatt', oberflaeche: 'Oberfläche',
  massivholz: 'Massivholz', montage: 'Montage',
}

/**
 * Zieht die Faktoren anhand der Beobachtungen nach.
 *
 * Der Median statt des Mittelwerts: Ein einzelnes Angebot, in dem eine Position
 * halbiert wurde, soll das Ergebnis nicht kippen.
 */
export function lerneFaktoren(alt: Faktoren, beobachtungen: Beobachtung[]): Lernergebnis {
  const faktoren: Faktoren = { ...alt }
  const begruendung: string[] = []

  const nachBereich = new Map<Bereich, number[]>()
  for (const b of beobachtungen) {
    if (!(b.vorher > 0) || !(b.nachher >= 0)) continue
    const ratio = b.nachher / b.vorher
    if (ratio < RATIO_MIN || ratio > RATIO_MAX) continue
    const liste = nachBereich.get(b.bereich) ?? []
    liste.push(ratio)
    nachBereich.set(b.bereich, liste)
  }

  for (const [bereich, ratios] of nachBereich) {
    if (ratios.length < MIN_BEOBACHTUNGEN) continue
    const m = median(ratios)
    const vorher = faktoren[bereich]
    // Halbe Strecke zum Ziel: alt * (1 + (m-1) * Daempfung)
    const neu = deckele(vorher * (1 + (m - 1) * DAEMPFUNG))
    if (Math.abs(neu - vorher) < 0.01) continue
    faktoren[bereich] = neu
    const richtung = neu < vorher ? 'knapper' : 'großzügiger'
    begruendung.push(
      `${NAME[bereich]}: ${vorher.toFixed(2)} → ${neu.toFixed(2)} — `
      + `aus ${ratios.length} gewonnenen Angeboten, du rechnest hier ${richtung} als bisher angenommen.`)
  }

  return { faktoren, begruendung }
}


// ── Beobachtungen aus zwei Fassungen eines Angebots ────────────────────────────
//
// Braucht KEINE neue Tabelle: `offer_versions` haelt die fruehe Fassung mitsamt
// Daten, `projects` den Endstand und den Status. Wo beide Fassungen dieselbe
// Position (ueber die id) und dieselbe Kostenstelle kennen, entsteht eine
// Beobachtung.
//
// Positionen, die nur in einer Fassung stehen, sagen nichts ueber Zeiten aus —
// sie wurden hinzugefuegt oder geloescht. Sie werden uebersprungen.

type LernPos = {
  id?: number | string
  arbeitszeit?: Array<{ kostenstelle?: string; minuten?: number }>
}
type LernOffer = { positionen?: LernPos[] } | null | undefined

export function beobachtungenAus(vorschlag: LernOffer, endstand: LernOffer): Beobachtung[] {
  const alt = vorschlag?.positionen ?? []
  const neu = endstand?.positionen ?? []
  const ergebnis: Beobachtung[] = []

  for (const pA of alt) {
    if (pA.id == null) continue
    const pB = neu.find(x => x.id === pA.id)
    if (!pB) continue

    // Je Bereich summieren, nicht je Kostenstelle: Wer Zeit von Zuschnitt nach
    // Zusammenbau schiebt, hat nichts ueber seine Geschwindigkeit gesagt.
    const summe = (p: LernPos) => {
      const s: Partial<Record<Bereich, number>> = {}
      for (const a of p.arbeitszeit ?? []) {
        const bereich = bereichFuer(String(a.kostenstelle ?? ''))
        if (!bereich) continue
        s[bereich] = (s[bereich] ?? 0) + Number(a.minuten ?? 0)
      }
      return s
    }
    const sA = summe(pA)
    const sB = summe(pB)
    for (const bereich of Object.keys(sA) as Bereich[]) {
      const vorher = sA[bereich] ?? 0
      const nachher = sB[bereich] ?? 0
      if (vorher > 0) ergebnis.push({ bereich, vorher, nachher })
    }
  }
  return ergebnis
}
