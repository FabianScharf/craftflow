// Prüfung der Briefpapier-Adresse, bevor der Server sie abruft.
//
// ANLASS (Audit 2026-09-17, Critical 3): `/api/generate-pdf` nahm `letterheadUrl`
// ungeprüft aus dem Anfragekörper und rief sie serverseitig per `fetch()` ab. Jeder
// eingeloggte Nutzer konnte damit eine beliebige Adresse angeben — interne
// Netzwerkadressen, Metadaten-Endpunkte einer Cloud, fremde Server — und bekam die
// Antwort zusätzlich als Hintergrund ins zurückgegebene PDF geliefert (SSRF).
//
// Jetzt gilt: Die Adresse kommt serverseitig aus dem eigenen Betriebsprofil, UND sie
// muss diese Prüfung bestehen — gleicher Host wie die Supabase-Instanz des Projekts,
// Bucket `briefpapier`, Ordner der eigenen kontoId. Doppelt, weil in der Spalte des
// Profils theoretisch ein Altwert aus einer anderen Umgebung stehen kann.
//
// TEAMFUNKTION (2026-09-17): Storage-Ordner heißen seit dem Sweep nach der `kontoId`
// (dem Betrieb), nicht mehr nach `user.id` — ein Mitarbeiter lädt Briefpapier unter
// dem Ordner des Inhabers hoch. Der Aufrufer übergibt deshalb `konto.kontoId`.
//
// Reine Funktion ohne Importe — `npm run test` führt sie direkt aus.

/** Der Bucket, in den /api/upload-briefpapier schreibt. */
export const BRIEFPAPIER_BUCKET = 'briefpapier'

/**
 * true nur, wenn `adresse` auf dem Supabase-Host dieses Projekts liegt, im Bucket
 * `briefpapier` und im Ordner genau dieses Kontos (Betriebs). Alles andere (anderer
 * Host, anderer Bucket, fremder Ordner, kaputte Adresse, http statt https, Adresse
 * mit Zugangsdaten) ist falsch — fail closed.
 */
export function istEigenesBriefpapier(
  adresse: string | null | undefined,
  supabaseUrl: string | null | undefined,
  kontoId: string | null | undefined,
): boolean {
  if (!adresse || !supabaseUrl || !kontoId) return false
  let ziel: URL
  let basis: URL
  try {
    ziel = new URL(adresse)
    basis = new URL(supabaseUrl)
  } catch {
    return false
  }
  if (ziel.protocol !== 'https:') return false
  // Zugangsdaten in der Adresse (https://host@boeser-host/) sind ein klassischer
  // Trick, um einen Host-Vergleich auszuhebeln — hier gibt es sie nie.
  if (ziel.username || ziel.password) return false
  if (ziel.host !== basis.host) return false
  // Der Pfad, den getPublicUrl() erzeugt:
  //   /storage/v1/object/public/briefpapier/<kontoId>/briefpapier.pdf
  // `..` kann in einem geparsten URL-Pfad nicht mehr stehen (die URL-Klasse löst es
  // auf), der Präfix-Vergleich reicht deshalb aus.
  const erwartet = `/storage/v1/object/public/${BRIEFPAPIER_BUCKET}/${kontoId}/`
  return ziel.pathname.startsWith(erwartet)
}

/**
 * Der Speicherpfad hinter einer geprüften Briefpapier-Adresse.
 *
 * WOZU (19.09.2026): Der Bucket `briefpapier` stand auf öffentlich, und die
 * Leseregel galt für die Rolle `public` — jede Datei war **ohne Anmeldung**
 * abrufbar, wer die Adresse kannte. In einem Briefpapier stehen Firmenname,
 * Anschrift, oft Steuernummer und Bankverbindung.
 *
 * Seither ist der Bucket privat, und der Server erzeugt beim PDF-Bau eine kurz
 * gültige signierte Adresse. Diese Funktion holt dafür den Pfad
 * `<kontoId>/briefpapier.pdf` aus der gespeicherten Adresse.
 *
 * Gibt null zurück, wenn die Adresse nicht passt — der Aufrufer prüft sie
 * vorher ohnehin mit `istEigenesBriefpapier`.
 */
export function pfadAusBriefpapierAdresse(adresse: string | null | undefined): string | null {
  if (!adresse) return null
  let pfad: string
  try { pfad = new URL(adresse).pathname } catch { return null }
  const marke = `/storage/v1/object/public/${BRIEFPAPIER_BUCKET}/`
  const i = pfad.indexOf(marke)
  if (i === -1) return null
  const rest = pfad.slice(i + marke.length)
  return rest || null
}
