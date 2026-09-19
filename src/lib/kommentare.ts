// Kommentare unter einem Wunsch: Textprüfung, Spam-Bremse und der Anzeigename.
//
// Importiert bewusst NICHTS — wie src/lib/learn.ts und src/lib/materialpreise.ts.
// Die App läuft lokal nicht, deshalb ist `npm run test` der einzige Weg, diese
// Logik auszuführen.
//
// WARUM DAS HIER BESONDERS ZÄHLT: Fabians Entscheidung vom 19.09.2026 ist
// „sofort öffentlich" — ohne Freigabeschritt. Jeder Kommentar steht also in
// dem Moment auf www.getcraftflow.de, in dem jemand auf Senden drückt. Damit
// ist alles, was hier steht, die einzige Bremse vor der Veröffentlichung.

export const KOMMENTAR_MAX = 1000
/** Gegen Spam und gegen Streit im Minutentakt: so viele Kommentare am Tag je Nutzer. */
export const KOMMENTARE_JE_TAG = 10

export type NameArt = 'region' | 'vorname' | 'betrieb'

/** Die Reihenfolge ist die der Auswahl in den Einstellungen: anonymste zuerst. */
export const NAME_ARTEN: NameArt[] = ['region', 'vorname', 'betrieb']

export const NAME_ART_LABEL: Record<NameArt, string> = {
  region: 'Nur die Region',
  vorname: 'Mein Vorname',
  betrieb: 'Mein Betriebsname',
}

/**
 * Voreinstellung für ein Konto, das nie etwas gewählt hat: die anonymste Form.
 * Wer erkannt werden will, entscheidet sich aktiv dafür — nicht umgekehrt.
 */
export const NAME_ART_STANDARD: NameArt = 'region'

export function istNameArt(v: unknown): v is NameArt {
  return typeof v === 'string' && (NAME_ARTEN as string[]).includes(v)
}

export type Profil = {
  firma_name?: string | null
  inhaber?: string | null
  plz?: string | null
  ort?: string | null
}

/** Wenn aus dem Profil nichts Brauchbares kommt. Nie ein leerer Name. */
export const NAME_FALLBACK = 'Ein Schreiner'

/**
 * Der Name, der öffentlich unter dem Kommentar steht.
 *
 * Bewusst beim LESEN gebildet, nicht beim Schreiben mitgespeichert: Stellt jemand
 * später von „Mein Betriebsname" auf „Nur die Region" um, sollen auch seine alten
 * Kommentare anonym werden. Ein mitgespeicherter Name würde für immer stehen
 * bleiben — das wäre das Gegenteil dessen, was die Umstellung bedeutet.
 *
 * Fehlt die Angabe, auf die die Wahl zeigt (kein Betriebsname hinterlegt, keine
 * PLZ), fällt der Name eine Stufe anonymer aus, statt eine Lücke zu zeigen.
 */
export function anzeigeName(art: NameArt | null | undefined, profil: Profil | null | undefined): string {
  const p = profil ?? {}
  const firma = String(p.firma_name ?? '').trim()
  const inhaber = String(p.inhaber ?? '').trim()
  const plz = String(p.plz ?? '').trim()

  const gewaehlt = istNameArt(art) ? art : NAME_ART_STANDARD

  if (gewaehlt === 'betrieb' && firma) return firma
  if (gewaehlt === 'vorname' && inhaber) {
    const vorname = inhaber.split(/\s+/)[0]
    if (vorname) return vorname
  }
  // 'region' — und zugleich der Rückfall, wenn oben nichts hinterlegt war.
  if (plz) return `Schreiner aus ${plz}`
  return NAME_FALLBACK
}

export type KommentarPruefung =
  | { ok: true; text: string }
  | { ok: false; grund: string }

/** Prüft und beschneidet. Kein stilles Abschneiden — zu lang wird abgelehnt. */
export function pruefeKommentar(text: unknown): KommentarPruefung {
  const t = String(text ?? '').trim()
  if (!t) return { ok: false, grund: 'Bitte schreib etwas, bevor du absendest.' }
  if (t.length > KOMMENTAR_MAX) {
    return { ok: false, grund: `Ein Kommentar darf höchstens ${KOMMENTAR_MAX} Zeichen haben. Deiner hat ${t.length}.` }
  }
  return { ok: true, text: t }
}

/**
 * Darf dieser Nutzer noch einen Kommentar schreiben?
 * `heuteGeschrieben` sind seine Kommentare der letzten 24 Stunden.
 */
export function darfSchreiben(heuteGeschrieben: number): { ok: true } | { ok: false; grund: string } {
  if (heuteGeschrieben >= KOMMENTARE_JE_TAG) {
    return {
      ok: false,
      grund: `Mehr als ${KOMMENTARE_JE_TAG} Kommentare am Tag gehen nicht. Morgen wieder — oder schreib direkt an fabian@fscrafted.de.`,
    }
  }
  return { ok: true }
}

export type KommentarZeile = {
  id: string
  wunsch_id: string
  user_id: string
  text: string
  created_at: string
  /** true = Antwort von CraftFlow, wird öffentlich abgesetzt dargestellt. */
  vom_entwickler?: boolean | null
}

export type OeffentlicherKommentar = {
  id: string
  wunschId: string
  autor: string
  text: string
  datum: string
  vomEntwickler: boolean
}

/**
 * Formt die Datenbankzeilen in das, was die Website zeigen darf: Name statt
 * user_id. Die user_id verlässt die App NIE — sie ist der Schlüssel zu allem
 * anderen, was über diesen Betrieb gespeichert ist.
 */
export function fuerDieWebsite(
  zeilen: KommentarZeile[],
  nameArten: Record<string, NameArt | null | undefined>,
  profile: Record<string, Profil | null | undefined>,
): OeffentlicherKommentar[] {
  return (zeilen ?? []).map(z => ({
    id: z.id,
    wunschId: z.wunsch_id,
    autor: z.vom_entwickler ? 'CraftFlow' : anzeigeName(nameArten[z.user_id], profile[z.user_id]),
    text: z.text,
    datum: z.created_at,
    vomEntwickler: !!z.vom_entwickler,
  }))
}
