// Werkzeug-Definitionen für den Lern-Dialog im Chat und der Erfindungsschutz.
//
// Importiert bewusst NICHTS — wie src/lib/learn.ts und src/lib/materialpreise.ts.
//
// Warum es diese Prüfung gibt: Auf Fabians Wunsch (2026-09-06) darf die KI auch
// dann fragen, wenn er es nicht wörtlich gesagt hat — etwa weil er dasselbe zum
// zweiten Mal ändert. Damit entfällt der bisherige wörtliche Beleg. Der Schutz
// wandert deshalb hierher: Abgeleitet werden darf die ABSICHT ("das ist dein
// Standard"), niemals der INHALT. Genau diese Grenze ist im Projekt `stimme`
// gerissen, als das Modell eine Holzart, einen Kontext und eine persönliche
// Anekdote dazuerfunden hat.
//
// Belegquellen sind die Materialbezeichnungen der echten Kalkulation und die
// Nachrichten des Nutzers.

// Umlaute werden aufgeloest, BEVOR verglichen wird. Grund ist der deutsche
// Umlaut-Plural: "Rueckwand" wird zu "Rueckwaende" — der Vokal wechselt, ein
// Praefix-Vergleich allein laeuft ins Leere. Nach der Aufloesung teilen beide
// Formen den Stamm "ruckwand". Beide Seiten werden gleich behandelt, es kann
// also nichts auseinanderlaufen.
function normalisiere(s: string): string {
  return (s ?? '')
    .toLowerCase()
    .replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9.,]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Inhaltswörter: alles ab 3 Zeichen, plus alles, was mit einer Ziffer beginnt.
// Zahlen müssen mit, auch kurze wie "8" — eine erfundene Materialstärke sieht
// harmlos aus und verändert die Kalkulation.
function inhaltsWoerter(text: string): string[] {
  return normalisiere(text)
    .split(' ')
    .filter(w => w !== '' && (w.length >= 3 || /^[0-9]/.test(w)))
}

// Wörter ohne eigene Aussage. Sie dürfen fehlen, ohne dass ein Inhalt als
// erfunden gilt — sonst scheitert jede natürlich formulierte Regel.
const FUELLWOERTER = new Set([
  'der', 'die', 'das', 'den', 'dem', 'des', 'ein', 'eine', 'einer', 'einem', 'einen',
  'und', 'oder', 'aus', 'mit', 'für', 'fuer', 'von', 'vom', 'bei', 'als', 'auf', 'ist',
  'sind', 'wird', 'werden', 'immer', 'nie', 'nicht', 'kein', 'keine', 'mein', 'meine',
  'meiner', 'meinem', 'ich', 'mir', 'mich', 'standardmäßig', 'standardmaessig',
  'grundsätzlich', 'grundsaetzlich', 'inkl', 'ca', 'etwa', 'nur', 'auch', 'dann',
  'wenn', 'statt', 'sondern', 'aber', 'wie', 'zum', 'zur', 'ins', 'ohne',
])

// Deutsche Flexion: Die KI formuliert allgemeine Regeln im Plural ("Rückwände"),
// die Kalkulation nennt das Einzelteil ("Rückwand"). Ein exakter Wortvergleich
// würde deshalb JEDE natürlich formulierte Regel ablehnen. Zwei abgeschnittene
// Endzeichen decken die deutschen Endungen ab (-e, -n, -en, -er, -es).
//
// GRENZE, bewusst in Kauf genommen: Diese Prüfung vergleicht Wörter, nicht
// Bedeutung. Steht "19 mm" irgendwo im Angebot, gilt "19" als belegt — auch
// wenn es dort zu einem anderen Bauteil gehörte. Der Schutz fängt frei
// erfundene Inhalte ab, nicht falsch zugeordnete. Gegen Letzteres schützt die
// Rückfrage: Der Nutzer sieht die Regel im Klartext, bevor er zustimmt.
function kommtVor(wort: string, quelle: string): boolean {
  if (quelle.includes(wort)) return true
  if (wort.length >= 6) return quelle.includes(wort.slice(0, wort.length - 2))
  return false
}

function belegt(woerter: string[], quelle: string): boolean {
  const inhalt = woerter.filter(w => !FUELLWOERTER.has(w))
  if (inhalt.length === 0) return false
  // JEDES Inhaltswort muss vorkommen. Eine Mehrheitsregel würde genau den Fall
  // durchlassen, um den es geht: viel Belegtes plus ein erfundenes Detail.
  return inhalt.every(w => kommtVor(w, quelle))
}

// Nennt die Woerter, die nicht belegt sind. Ohne diese Liste bekam die KI nur
// ein pauschales "abgelehnt" zurueck und riet beim naechsten Versuch — drei
// bezahlte Runden lang, am Ende sah der Nutzer nur "nicht verwertbar"
// (gemessen 2026-09-06). Wer ablehnt, muss sagen, woran es lag.
export function unbelegteWoerter(text: string, belegquellen: string[]): string[] {
  const quelle = belegquellen.map(normalisiere).join(' ')
  const inhalt = inhaltsWoerter(text).filter(w => !FUELLWOERTER.has(w))
  const offen = quelle === '' ? inhalt : inhalt.filter(w => !kommtVor(w, quelle))
  // Satzzeichen haengen an den Woertern (normalisiere laesst . und , stehen).
  // Fuer die Rueckmeldung stoeren sie — geprueft wird weiterhin das volle Wort.
  return [...new Set(offen.map(w => w.replace(/^[.,]+|[.,]+$/g, '')).filter(w => w !== ''))]
}

export function pruefeRegelInhalt(dann: string, belegquellen: string[]): boolean {
  const quelle = belegquellen.map(normalisiere).join(' ')
  if (quelle === '') return false
  return belegt(inhaltsWoerter(dann), quelle)
}

// Das Modell hat am 2026-09-06 seine eigene Werkzeug-Syntax in das Feld
// geschrieben: `</parameter><parameter name="dann">...`. Der Text stand danach
// als Bedingung im Vault und waere in JEDE Kalkulation gewandert. Geprueft wird
// nicht der Sinn, nur die Form — Spitzklammern haben in einer Bedingung nichts
// zu suchen.
const MARKUP = /[<>]|parameter\s+name=/i
const WENN_MAXLAENGE = 120

export function bereinigeWenn(wenn: string): string {
  const s = (wenn ?? '').replace(/\s+/g, ' ').trim()
  if (s === '') return ''
  if (MARKUP.test(s)) return ''
  return s.length > WENN_MAXLAENGE ? s.slice(0, WENN_MAXLAENGE).trim() : s
}

// Fabians Entscheidung 2026-09-06: Er bestaetigt den Wortlaut, bevor gespeichert
// wird. Damit zaehlt auch, was die KI ihm gezeigt hat — aber ausschliesslich aus
// FRUEHEREN Runden. `chatHistory` enthaelt nie die Antwort, in der das Werkzeug
// gerade laeuft; die KI kann also nicht im selben Zug erfinden und speichern.
export function baueBelegquellen(
  angebotstexte: string[],
  chatHistory: Array<{ role: 'user' | 'assistant'; content: string }>,
  message: string,
): string[] {
  return [...angebotstexte, ...chatHistory.map(m => m.content), message]
}

export function pruefePreisInhalt(bezeichnung: string, ek: number, belegquellen: string[]): boolean {
  const quelle = belegquellen.map(normalisiere).join(' ')
  if (quelle === '') return false
  if (!belegt(inhaltsWoerter(bezeichnung), quelle)) return false
  if (!Number.isFinite(ek) || ek < 0) return false
  // Der Betrag muss wörtlich vorkommen — mit Punkt ODER Komma. Fabian schreibt
  // "26,27", das Angebot-JSON enthält "26.27".
  const mitPunkt = ek.toFixed(2)
  const mitKomma = mitPunkt.replace('.', ',')
  if (quelle.includes(mitPunkt) || quelle.includes(mitKomma)) return true
  return Number.isInteger(ek) && quelle.includes(String(ek))
}

export const WERKZEUGE = [
  {
    name: 'regel_merken',
    description:
      'Merkt eine Bauweise-Regel dauerhaft für diesen Betrieb. NUR aufrufen, wenn der '
      + 'Nutzer gerade ausdrücklich zugestimmt hat. Niemals für Einkaufspreise, '
      + 'Stundensätze, Aufschläge oder Verkaufspreise verwenden.',
    strict: true,
    input_schema: {
      type: 'object',
      properties: {
        bereich: {
          type: 'string',
          enum: ['Material', 'Konstruktion', 'Zeit', 'Oberfläche', 'Montage', 'Sonstiges'],
        },
        wenn: {
          type: 'string',
          description: 'Bedingung der Regel. Leerer String, wenn sie immer gilt.',
        },
        dann: {
          type: 'string',
          description: 'Was gilt. Ausschließlich Inhalte, die im Angebot oder im Chat wirklich vorkamen.',
        },
        quelle: {
          type: 'string',
          enum: ['woertlich', 'wiederholung'],
          description: 'woertlich = der Nutzer hat es gesagt. wiederholung = er hat dasselbe zweimal geändert.',
        },
      },
      required: ['bereich', 'wenn', 'dann', 'quelle'],
      additionalProperties: false,
    },
  },
  {
    name: 'preis_merken',
    description:
      'Fixiert einen Einkaufspreis dauerhaft. NUR aufrufen, wenn der Nutzer den Preis '
      + 'genannt und dem Merken zugestimmt hat. Preise niemals selbst ausdenken oder schätzen.',
    strict: true,
    input_schema: {
      type: 'object',
      properties: {
        bezeichnung: {
          type: 'string',
          description: 'Materialbezeichnung, wonach später gesucht wird, z. B. "Blum Movento Softclose-Auszug".',
        },
        ek: { type: 'number', description: 'Einkaufspreis netto, wie vom Nutzer genannt.' },
        einheit: { type: 'string', enum: ['Stk', 'm2', 'lfdm', 'm3', 'kg', 'pauschal'] },
      },
      required: ['bezeichnung', 'ek', 'einheit'],
      additionalProperties: false,
    },
  },
] as const

// ── Unsichere Preisangaben ────────────────────────────────────────────────────
//
// Ein Preis, den der Nutzer nur ungefaehr genannt hat, darf NICHT fixiert werden.
// Gemessen am 2026-09-06: Aus „Eine Eiche Lade in der Groesse kostet ca. 60 EUR"
// wurde eine harte 60,00 EUR in der Preisliste — falsch, sobald Buche statt Eiche
// gebaut wird. Fabians Entscheidung: typische Faelle einzeln hinterlegen
// („Massivholzlade Eiche 600 mm"), unsichere Angaben gar nicht fixieren, sondern
// im naechsten Angebot nachfragen.
//
// Geprueft werden AUSSCHLIESSLICH die eigenen Worte des Nutzers. Das Angebot taugt
// hier nicht als Quelle: `sammleAngebotstexte` schiebt die EK-Zahlen mit hinein —
// die KI wuerde sich selbst bestaetigen, nachdem sie den Betrag dort eingetragen hat.

// Wortgrenzen sind Pflicht, nicht Kosmetik: ohne sie steckt „rund" in „Grundierung"
// und „ab" in „Abstand" — jede zweite Angabe waere faelschlich unsicher.
const UNSICHER_DAVOR = /(\bca\b\.?|\bcirca\b|\bzirka\b|\bungef(ä|ae)hr\b|\betwa\b|\brund\b|\bgrob\b|\bsch(ä|ae)tzungsweise\b|\bum die\b|\bso um\b|\birgendwo\b|\bzwischen\b|\bbis\b|\bab\b)/i
// Nach dem Betrag steht die Einschraenkung meist als Nebensatz: „60 EUR, kommt auf
// Groesse und Holzart an".
const UNSICHER_DANACH = /(\bje nach\b|\bkommt (drauf|darauf|auf)\b|\bvariiert\b|\bunterschiedlich\b|\baufw(ä|ae)rts\b|\bplus\s*\/?\s*minus\b|\babh(ä|ae)ngig\b|\bungef(ä|ae)hr\b)/i
const FENSTER_DAVOR = 35
const FENSTER_DANACH = 55

// Der Betrag kann als 60, 60,00 oder 60.00 dastehen. Die Lookarounds verhindern,
// dass die 60 aus „160" gefunden wird.
function betragsMuster(ek: number): RegExp {
  const punkt = ek.toFixed(2)
  const teile = [punkt, punkt.replace('.', ',')]
  if (Number.isInteger(ek)) teile.push(String(ek))
  const alt = teile.map(t => t.replace(/\./g, '\\.')).join('|')
  return new RegExp(`(?<![\\d.,])(?:${alt})(?![\\d])`, 'g')
}

export function unsichereBetragsangabe(ek: number, nutzertexte: string[]): boolean {
  if (!Number.isFinite(ek)) return false
  const muster = betragsMuster(ek)
  let gefunden = false
  for (const roh of nutzertexte) {
    const s = String(roh ?? '')
    muster.lastIndex = 0
    let treffer: RegExpExecArray | null
    while ((treffer = muster.exec(s)) !== null) {
      gefunden = true
      const i = treffer.index
      const davor = s.slice(Math.max(0, i - FENSTER_DAVOR), i)
      const danach = s.slice(i + treffer[0].length, i + treffer[0].length + FENSTER_DANACH)
      // Eine einzige klare Nennung genuegt — wer erst schaetzt und dann nachsieht,
      // soll seinen genauen Preis fixieren duerfen.
      if (!UNSICHER_DAVOR.test(davor) && !UNSICHER_DANACH.test(danach)) return false
    }
  }
  return gefunden
}
