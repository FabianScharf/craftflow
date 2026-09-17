import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { kostenstellenSollZustand } from '@/lib/kalibrierung'
import { normalizeKsId } from '@/lib/types'
import { berechneFaktoren, deckeleHand, referenzFuer } from '@/lib/kalibrierung'
import { ladeKalibrierung, speichereKalibrierung } from '@/lib/kalibrierungsspeicher'
import { pruefeFunktion } from '@/lib/planpruefung'
import { REFERENZPROJEKTE, mitSaetzen, summen, faustregelKontrolle } from '@/lib/referenzprojekte'

export async function GET() {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })
  const kalibrierung = await ladeKalibrierung(supabase, user.id)

  // Fuer den Ankerpreis: SEINE Stundensaetze und SEIN Materialaufschlag. Gerechnet
  // wird damit in der Oberflaeche, nicht hier.
  //
  // GEFUNDEN AM 2026-09-07, von Fabian: Vorher schickte diese Route einen fertig
  // gerechneten Preis — abgeleitet aus dem GESPEICHERTEN Schwerpunkt. Der Text
  // darueber folgte aber den Klicks in Echtzeit. Ueber jedem Referenzmoebel stand
  // dadurch derselbe Preis (2.134 EUR), naemlich der eines ganz anderen Moebels.
  // Zwei Quellen fuer dieselbe Aussage laufen immer irgendwann auseinander; jetzt
  // rechnet die Oberflaeche beides aus demselben ref.
  const { saetze, aufschlag } = await ladeSaetzeUndAufschlag(supabase, user.id)

  // Task R3: das gerechnete Referenzprojekt fuer die Oberflaeche — MIT den Saetzen
  // und dem Materialaufschlag DIESES Betriebs, nicht mit den Standardsaetzen aus
  // referenzprojekte.ts (die sind nur Platzhalter). Kein Preis kommt aus der
  // Faustregel — sie ist nur die Kontrolle daneben (CLAUDE.md, "KI darf niemals
  // selbst kalkulieren"/Globale Vorgabe dieser Aufgabe).
  const ref = referenzFuer(kalibrierung?.schwerpunkt)
  const projekt = REFERENZPROJEKTE[ref.schluessel]
  const positionen = mitSaetzen(projekt, saetze, aufschlag)
  const projektSummen = summen(positionen, true)
  const referenzprojekt = {
    schluessel: projekt.schluessel,
    name: projekt.name,
    kunde: projekt.kunde,
    text: projekt.text,
    positionen,
    summen: projektSummen,
    faustregel: faustregelKontrolle(projektSummen.netto, projekt.faustregel),
    baender: ref.baender,
  }

  return NextResponse.json({ kalibrierung, saetze, aufschlag, referenzprojekt })
}

// Stundensaetze und Materialaufschlag des Nutzers. Die Referenzkalkulation ist fuer
// jeden Betrieb eine andere Zahl, obwohl das Moebel dasselbe ist.
async function ladeSaetzeUndAufschlag(
  supabase: Awaited<ReturnType<typeof createClient>>, userId: string,
): Promise<{ saetze: Record<string, number>; aufschlag: number }> {
  const saetze: Record<string, number> = {}
  const { data: ks, error: ksErr } = await supabase
    .from('kostenstellen')
    .select('bezeichnung, stundensatz, aktiv')
    .eq('user_id', userId)
  if (ksErr) console.error('[kalibrierung] Kostenstellen:', ksErr.message)
  for (const k of ks ?? []) {
    if (k.aktiv === false) continue
    saetze[String(k.bezeichnung)] = Number(k.stundensatz)
  }

  const { data: mg, error: mgErr } = await supabase
    .from('materialgruppen')
    .select('aufschlag_prozent, aktiv')
    .eq('user_id', userId)
    .order('reihenfolge')
  if (mgErr) console.error('[kalibrierung] Materialgruppen:', mgErr.message)
  const erste = (mg ?? []).find(m => m.aktiv !== false)
  const aufschlag = erste ? Number(erste.aufschlag_prozent) / 100 : 0.30

  return { saetze, aufschlag: Number.isFinite(aufschlag) ? aufschlag : 0.30 }
}

export async function PUT(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })
  const sperre = await pruefeFunktion(supabase, user.id, 'kalibrierung')
  if (sperre) return sperre

  const b = await req.json() as Record<string, unknown>
  const text = (k: string) => String(b[k] ?? '')

  const { saetze, aufschlag } = await ladeSaetzeUndAufschlag(supabase, user.id)

  const antworten = {
    grund:   text('antwort_grund'),
    lack:    text('antwort_lack'),
    massiv:  text('antwort_massiv'),
    montage: text('antwort_montage'),
  }
  const schwerpunkt = Array.isArray(b.schwerpunkt) ? (b.schwerpunkt as unknown[]).map(String) : []

  // Das Referenzmoebel richtet sich nach dem Schwerpunkt — ein Treppenbauer wird an
  // einer Treppe gemessen, nicht an einem Flurschrank. Dieselbe Ableitung nutzt die
  // Oberflaeche, um die Baender anzuzeigen; sonst wuerde gegen andere Zahlen
  // gerechnet als gefragt wurde.
  const ref = referenzFuer(schwerpunkt)

  // Die Faktoren entstehen IMMER serverseitig. Sie steuern Preise — was aus dem
  // Browser kommt, wird dafuer nie uebernommen. Gleiche Haltung wie bei vkStunde.
  const f = berechneFaktoren(antworten, saetze, aufschlag, ref)

  // Ausnahme: ein von Hand gesetzter Faktor aus den Einstellungen. Er ueberschreibt
  // die Ableitung bewusst — steht so im Reiter "Mein Betrieb" — und wird gedeckelt.
  // Handeingaben duerfen 0,50 bis 3,00 sein (deckeleHand); die ABLEITUNG aus den
  // Antworten bleibt bei 0,60 bis 1,40 (deckele, in berechneFaktoren).
  const vonHand = (k: string, standard: number) =>
    b[k] === undefined || b[k] === null || b[k] === '' ? standard : deckeleHand(Number(b[k]))

  const r = await speichereKalibrierung(supabase, user.id, {
    mitarbeiter:     text('mitarbeiter'),
    maschinen:       Array.isArray(b.maschinen) ? (b.maschinen as unknown[]).map(String) : [],
    schwerpunkt,
    montage_selbst:  text('montage_selbst'),
    stueckzahlen:    text('stueckzahlen'),
    antwort_grund:   antworten.grund,
    antwort_lack:    antworten.lack,
    antwort_massiv:  antworten.massiv,
    antwort_montage: antworten.montage,
    faktor_werkstatt:   vonHand('faktor_werkstatt', f.werkstatt),
    faktor_oberflaeche: vonHand('faktor_oberflaeche', f.oberflaeche),
    faktor_massivholz:  vonHand('faktor_massivholz', f.massivholz),
    faktor_montage:     vonHand('faktor_montage', f.montage),
    abgeschlossen:   b.abgeschlossen === false ? false : true,
    hinweis_gezeigt: b.hinweis_gezeigt === true,
  })
  if (!r.ok) return NextResponse.json({ error: r.grund }, { status: 500 })

  // Kostenstellen mitziehen: CNC, Bekantung, Montage folgen den Antworten — sonst zeigt
  // „Kostenstellen“ etwas anderes als die Kalkulation rechnet (Fabian, 15.09.).
  const soll = kostenstellenSollZustand({ maschinen: Array.isArray(b.maschinen) ? (b.maschinen as unknown[]).map(String) : [], montage_selbst: text('montage_selbst') })
  const { data: alleKs } = await supabase.from('kostenstellen').select('id, code, aktiv').eq('user_id', user.id)
  const geaendert: string[] = []
  for (const ks of alleKs ?? []) {
    const id = normalizeKsId(ks.code)
    if (!(id in soll) || ks.aktiv === soll[id]) continue
    const { error } = await supabase.from('kostenstellen').update({ aktiv: soll[id] }).eq('id', ks.id).eq('user_id', user.id)
    if (!error) geaendert.push(`${id} ${soll[id] ? 'an' : 'aus'}`)
  }
  return NextResponse.json({ ok: true, faktoren: f, kostenstellen: geaendert })
}
