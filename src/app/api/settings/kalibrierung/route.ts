import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { kostenstellenSollZustand, abzuschaltendeKostenstellen } from '@/lib/kalibrierung'
import { normalizeKsId } from '@/lib/types'
import { berechneFaktoren, deckeleHand, referenzFuer, referenzMitSaetzen, ankerFuer } from '@/lib/kalibrierung'
import { ladeKalibrierung, speichereKalibrierung } from '@/lib/kalibrierungsspeicher'
import { pruefeFunktion } from '@/lib/planpruefung'
import { REFERENZPROJEKTE, mitSaetzen, summen, faustregelKontrolle, umgebucht } from '@/lib/referenzprojekte'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })
  const kalibrierung = await ladeKalibrierung(supabase, user.id)

  // GEFUNDEN 2026-09-17 von Fabian: "Bei den Referenzmoebeln ist jetzt immer die
  // Kueche vorhanden. Auch wenn ich die Kuechen abwaehle. Es wechselt nicht mehr."
  // Das Referenzprojekt wurde aus dem GESPEICHERTEN Schwerpunkt gebaut — die
  // Klicks in Mein Betrieb erreichten nur die Antwortbaender (Oberflaeche), nicht
  // den Kasten. Jetzt duerfen Schwerpunkt, Maschinen und Montage per Query
  // mitkommen (kommagetrennt); ohne Query gilt weiter der gespeicherte Stand.
  const sp = req.nextUrl.searchParams
  const liste = (k: string, gespeichert: unknown) => sp.has(k)
    ? (sp.get(k) ?? '').split(',').map(x => x.trim()).filter(Boolean)
    : (Array.isArray(gespeichert) ? (gespeichert as unknown[]).map(String) : [])
  const schwerpunkt = liste('schwerpunkt', kalibrierung?.schwerpunkt)
  const maschinen = liste('maschinen', kalibrierung?.maschinen)
  const montageSelbst = sp.has('montage_selbst') ? (sp.get('montage_selbst') ?? '') : String(kalibrierung?.montage_selbst ?? '')

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
  //
  // Fix Runde 3 (Controller-Ruling): referenzMitSaetzen() statt referenzFuer() —
  // die Baender selbst muessen mit DENSELBEN Saetzen/demselben Aufschlag gebaut
  // werden, mit denen unten auch der Anker (ankerFuer) gerechnet wird. Sonst zeigt
  // ein teurer Betrieb "über 2.700 €" als hoechstes Band, obwohl sein eigener Preis
  // weit darueber liegt.
  //
  // 2026-09-17 (Fabian: "Die Kostenstelle CNC fehlt komplett"): Die Referenz traegt
  // jetzt CNC-Zeit. Ein Betrieb OHNE CNC/Kantenanleimmaschine sieht sie UMGEBUCHT
  // auf Handarbeit (umgebucht/referenzMitSaetzen) — so, wie seine Kalkulation
  // rechnet. "Montage nie" laesst die Referenz unveraendert (siehe umgebucht).
  const deaktiviert = abzuschaltendeKostenstellen({ maschinen, montage_selbst: montageSelbst })
  const ref = referenzMitSaetzen(referenzFuer(schwerpunkt), saetze, aufschlag, deaktiviert)
  const projekt = umgebucht(REFERENZPROJEKTE[ref.schluessel], deaktiviert)
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
    // Task R2 Fix Runde 2 (Controller-Ruling): EINE Quelle fuer den Anker-Text —
    // mit DIESEM Betrieb gerechnet, nicht mehr in ReferenzprojektKasten.tsx dupliziert.
    anker: ankerFuer(ref, saetze, aufschlag),
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
  //
  // Fix Runde 3: mit DENSELBEN Saetzen/demselben Aufschlag gebaut, mit denen direkt
  // darunter auch berechneFaktoren rechnet — nur so trifft die Antwort auf Band 3
  // (Faktor 1,0) IMMER den eigenen Referenzpreis, unabhaengig vom Satzniveau.
  const maschinen = Array.isArray(b.maschinen) ? (b.maschinen as unknown[]).map(String) : []
  const deaktiviert = abzuschaltendeKostenstellen({ maschinen, montage_selbst: text('montage_selbst') })
  const ref = referenzMitSaetzen(referenzFuer(schwerpunkt), saetze, aufschlag, deaktiviert)

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
    maschinen,
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
  const soll = kostenstellenSollZustand({ maschinen, montage_selbst: text('montage_selbst') })
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
