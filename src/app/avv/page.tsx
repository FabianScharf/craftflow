import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Auftragsverarbeitungsvertrag — CraftFlow' }

const VERSION = '2026-06'

const st = {
  page:    { background: '#0D0D0D', color: '#F5F2EE', fontFamily: 'system-ui, sans-serif', minHeight: '100vh', lineHeight: 1.65 } as React.CSSProperties,
  nav:     { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: '1px solid #1E1E1E' } as React.CSSProperties,
  logo:    { fontWeight: 600, fontSize: 15, color: '#F5F2EE', textDecoration: 'none' } as React.CSSProperties,
  copper:  { color: '#C8885A' } as React.CSSProperties,
  back:    { fontSize: 13, color: '#8A8A8A', textDecoration: 'none' } as React.CSSProperties,
  wrap:    { maxWidth: 680, margin: '0 auto', padding: '56px 24px 80px' } as React.CSSProperties,
  label:   { fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: '#8A8A8A', marginBottom: 12 },
  h1:      { fontSize: 28, fontWeight: 600, color: '#F5F2EE', marginBottom: 6, letterSpacing: '-0.01em' } as React.CSSProperties,
  sub:     { fontSize: 13, color: '#8A8A8A', marginBottom: 44 } as React.CSSProperties,
  section: { marginBottom: 32 } as React.CSSProperties,
  h2:      { fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: '#C8885A', marginBottom: 10 },
  p:       { fontSize: 14, color: '#8A8A8A', lineHeight: 1.75, marginBottom: 10 } as React.CSSProperties,
  hi:      { color: '#F5F2EE', fontWeight: 600 } as React.CSSProperties,
  divider: { height: 1, background: '#1E1E1E', margin: '32px 0' } as React.CSSProperties,
  box:     { background: '#141414', border: '1px solid #1E1E1E', borderRadius: 8, padding: '16px 20px', marginBottom: 16 } as React.CSSProperties,
  table:   { width: '100%', borderCollapse: 'collapse' as const, fontSize: 13, marginTop: 8 } as React.CSSProperties,
  th:      { textAlign: 'left' as const, color: '#F5F2EE', fontWeight: 600, padding: '6px 12px 6px 0', borderBottom: '1px solid #1E1E1E', fontSize: 12 },
  td:      { color: '#8A8A8A', padding: '8px 12px 8px 0', borderBottom: '1px solid #1A1A1A', verticalAlign: 'top' as const },
}

const Hi = ({ children }: { children: React.ReactNode }) => <span style={st.hi}>{children}</span>
const Link = ({ href, children }: { href: string; children: React.ReactNode }) => (
  <a href={href} style={{ color: '#C8885A' }} target="_blank" rel="noopener noreferrer">{children}</a>
)

export default function AVV() {
  return (
    <div style={st.page}>
      <nav style={st.nav}>
        <a href="/" style={st.logo}>Craft<span style={st.copper}>Flow</span></a>
        <a href="/" style={st.back}>← Zurück</a>
      </nav>

      <div style={st.wrap}>
        <p style={st.label}>Rechtliches</p>
        <h1 style={st.h1}>Auftragsverarbeitungsvertrag</h1>
        <p style={st.sub}>Version {VERSION} · gemäß Art. 28 DSGVO · Entwurf — noch nicht rechtsverbindlich</p>

        {/* Parteien */}
        <div style={st.section}>
          <p style={st.h2}>Vertragsparteien</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={st.box}>
              <p style={{ ...st.p, color: '#C8885A', fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>Auftragsverarbeiter</p>
              <p style={{ ...st.p, marginBottom: 0 }}>
                <Hi>FS Crafted — Fabian Scharf</Hi><br />
                Fuldaer Straße 15<br />
                63517 Rodenbach<br />
                anfrage@fscrafted.de
              </p>
            </div>
            <div style={st.box}>
              <p style={{ ...st.p, color: '#C8885A', fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>Verantwortlicher</p>
              <p style={{ ...st.p, marginBottom: 0 }}>
                Der registrierte Nutzer von CraftFlow (nachfolgend <Hi>„Auftraggeber"</Hi>)
                in der bei der Registrierung angegebenen Person und/oder unter dem angegebenen
                Unternehmen.
              </p>
            </div>
          </div>
        </div>

        <div style={st.divider} />

        {/* § 1 */}
        <div style={st.section}>
          <p style={st.h2}>§ 1 — Gegenstand und Dauer</p>
          <p style={st.p}>
            Dieser Vertrag regelt die Verarbeitung personenbezogener Daten durch FS Crafted
            (Auftragsverarbeiter) im Auftrag des Auftraggebers im Rahmen der Nutzung der
            Software <Hi>CraftFlow</Hi>.
          </p>
          <p style={st.p}>
            Der Vertrag gilt für die gesamte Dauer der Nutzung von CraftFlow. Er endet
            automatisch mit der Kündigung des Nutzerkontos, wobei die Regelungen zur
            Datenlöschung (§ 7) weiterhin gelten.
          </p>
        </div>

        <div style={st.divider} />

        {/* § 2 */}
        <div style={st.section}>
          <p style={st.h2}>§ 2 — Art und Zweck der Verarbeitung</p>
          <p style={st.p}>
            Der Auftragsverarbeiter verarbeitet im Auftrag des Auftraggebers folgende
            Datenkategorien zum folgenden Zweck:
          </p>
          <table style={st.table}>
            <thead>
              <tr>
                <th style={st.th}>Datenkategorie</th>
                <th style={st.th}>Verarbeitungszweck</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['Namen und Kontaktdaten von Endkunden', 'Erstellung von Angebots-PDFs; Adressierung des Kunden im Angebot'],
                ['Projektdaten (Maße, Materialien, Preise)', 'KI-gestützte Kalkulation; Speicherung und Abruf durch den Auftraggeber'],
                ['E-Mail-Adresse des Auftraggebers', 'Authentifizierung; Systembenachrichtigungen'],
                ['Firmenprofil des Auftraggebers', 'Individualisierung der Angebots-PDFs'],
              ].map(([kat, zweck]) => (
                <tr key={kat}>
                  <td style={st.td}>{kat}</td>
                  <td style={st.td}>{zweck}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p style={{ ...st.p, marginTop: 12 }}>
            Eine Verarbeitung der Daten zu anderen als den genannten Zwecken erfolgt nicht,
            es sei denn, der Auftraggeber erteilt eine ausdrückliche schriftliche Weisung.
          </p>
        </div>

        <div style={st.divider} />

        {/* § 3 */}
        <div style={st.section}>
          <p style={st.h2}>§ 3 — Pflichten des Auftragsverarbeiters</p>
          <p style={st.p}>Der Auftragsverarbeiter verpflichtet sich:</p>
          <p style={st.p}>
            a) Personenbezogene Daten ausschließlich auf dokumentierte Weisung des
            Auftraggebers zu verarbeiten (Art. 28 Abs. 3 lit. a DSGVO).<br /><br />
            b) Sicherzustellen, dass alle zur Verarbeitung befugten Personen zur
            Vertraulichkeit verpflichtet sind (Art. 28 Abs. 3 lit. b DSGVO).<br /><br />
            c) Geeignete technische und organisatorische Maßnahmen (TOMs) gemäß Art. 32
            DSGVO zu implementieren und aufrechtzuerhalten (§ 5 dieses Vertrags).<br /><br />
            d) Den Auftraggeber unverzüglich zu informieren, sofern eine Weisung gegen
            datenschutzrechtliche Vorschriften verstößt (Art. 28 Abs. 3 DSGVO).<br /><br />
            e) Den Auftraggeber bei der Erfüllung von Betroffenenrechten (Auskunft,
            Berichtigung, Löschung) zu unterstützen (Art. 28 Abs. 3 lit. e DSGVO).<br /><br />
            f) Datenschutzverletzungen dem Auftraggeber unverzüglich, spätestens innerhalb
            von <Hi>72 Stunden</Hi> nach Bekanntwerden, zu melden (Art. 33 DSGVO).
          </p>
        </div>

        <div style={st.divider} />

        {/* § 4 */}
        <div style={st.section}>
          <p style={st.h2}>§ 4 — Unterauftragsverarbeiter</p>
          <p style={st.p}>
            Der Auftraggeber erteilt mit Abschluss dieses Vertrags eine allgemeine
            Genehmigung zum Einsatz folgender <Hi>Unterauftragsverarbeiter</Hi>. Der
            Auftragsverarbeiter stellt sicher, dass alle Unterauftragsverarbeiter
            gleichwertige Datenschutzpflichten erfüllen:
          </p>
          <table style={st.table}>
            <thead>
              <tr>
                <th style={st.th}>Dienstleister</th>
                <th style={st.th}>Zweck</th>
                <th style={st.th}>Sitz / Übertragungsgrundlage</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['Vercel Inc.', 'Hosting der Webanwendung', 'USA · SCC gem. Art. 46 Abs. 2 lit. c DSGVO'],
                ['Supabase Inc.', 'Datenbankspeicherung und Authentifizierung', 'EU (Frankfurt) · kein Drittlandtransfer'],
                ['Anthropic PBC', 'KI-gestützte Kalkulationsverarbeitung', 'USA · SCC gem. Art. 46 Abs. 2 lit. c DSGVO'],
                ['Stripe Inc.', 'Zahlungsabwicklung (nur Auftraggeberdaten)', 'USA · SCC gem. Art. 46 Abs. 2 lit. c DSGVO'],
              ].map(([name, zweck, sitz]) => (
                <tr key={name}>
                  <td style={st.td}><Hi>{name}</Hi></td>
                  <td style={st.td}>{zweck}</td>
                  <td style={st.td}>{sitz}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p style={{ ...st.p, marginTop: 12 }}>
            Über den Einsatz neuer oder den Wechsel von Unterauftragsverarbeitern informiert
            der Auftragsverarbeiter den Auftraggeber mit einer Vorlaufzeit von mindestens
            <Hi> 14 Tagen</Hi> per E-Mail. Der Auftraggeber kann Änderungen innerhalb dieser
            Frist schriftlich widersprechen.
          </p>
        </div>

        <div style={st.divider} />

        {/* § 5 */}
        <div style={st.section}>
          <p style={st.h2}>§ 5 — Technische und organisatorische Maßnahmen (TOMs)</p>
          <p style={st.p}>
            Der Auftragsverarbeiter trifft folgende Maßnahmen zur Datensicherheit
            gemäß Art. 32 DSGVO:
          </p>
          <p style={st.p}>
            — <Hi>Verschlüsselung:</Hi> Alle Datenübertragungen erfolgen ausschließlich via
            HTTPS/TLS. Passwörter werden ausschließlich als bcrypt-Hash gespeichert.<br />
            — <Hi>Zugriffskontrolle:</Hi> Datenbankzugriff ist durch Row Level Security (RLS)
            pro Nutzer isoliert — kein Nutzer kann Daten eines anderen Nutzers einsehen.<br />
            — <Hi>Verfügbarkeit:</Hi> Betrieb auf hochverfügbarer Cloud-Infrastruktur mit
            automatischen Backups (Supabase, Vercel).<br />
            — <Hi>Pseudonymisierung:</Hi> Nutzungsdaten werden, soweit technisch möglich,
            pseudonymisiert oder anonymisiert gespeichert.<br />
            — <Hi>Zugriffsbeschränkung:</Hi> Datenbankzugriff für den Auftragsverarbeiter
            beschränkt auf das technisch notwendige Minimum für Betrieb und Support.
          </p>
        </div>

        <div style={st.divider} />

        {/* § 6 */}
        <div style={st.section}>
          <p style={st.h2}>§ 6 — Pflichten des Auftraggebers</p>
          <p style={st.p}>Der Auftraggeber ist für Folgendes verantwortlich:</p>
          <p style={st.p}>
            a) Die Rechtmäßigkeit der Erhebung und Eingabe von Endkundendaten in CraftFlow
            sicherzustellen (eigene Rechtsgrundlage gegenüber seinen Kunden).<br /><br />
            b) Seine eigenen Kunden über die Verarbeitung ihrer Daten durch CraftFlow zu
            informieren, soweit gesetzlich erforderlich.<br /><br />
            c) Weisungen zur Datenverarbeitung ausschließlich schriftlich (per E-Mail an
            anfrage@fscrafted.de) zu erteilen.<br /><br />
            d) Den Auftragsverarbeiter unverzüglich zu informieren, sofern er Fehler oder
            Unregelmäßigkeiten bei der Datenverarbeitung feststellt.
          </p>
        </div>

        <div style={st.divider} />

        {/* § 7 */}
        <div style={st.section}>
          <p style={st.h2}>§ 7 — Löschung und Rückgabe nach Vertragsende</p>
          <p style={st.p}>
            Nach Beendigung der Nutzung (Konto-Löschung) werden alle personenbezogenen
            Daten des Auftraggebers und seiner Endkunden innerhalb von <Hi>30 Tagen</Hi>
            unwiderruflich gelöscht, sofern keine gesetzlichen Aufbewahrungspflichten
            entgegenstehen (z.B. steuerrechtliche Aufbewahrungsfristen für Rechnungsdaten:
            10 Jahre).
          </p>
          <p style={st.p}>
            Der Auftraggeber kann vor der Konto-Löschung alle Projektdaten über die
            Export-Funktion (CSV, Excel, JSON) herunterladen. Eine Rückgabe der Daten
            in einem anderen Format ist auf Anfrage möglich (anfrage@fscrafted.de).
          </p>
          <p style={st.p}>
            Anonyme oder aggregierte Benchmark-Daten (sofern der Auftraggeber dem
            Benchmarking zugestimmt hat) enthalten keinen Personenbezug und unterliegen
            keiner Löschpflicht.
          </p>
        </div>

        <div style={st.divider} />

        {/* § 8 */}
        <div style={st.section}>
          <p style={st.h2}>§ 8 — Audit und Nachweis</p>
          <p style={st.p}>
            Der Auftraggeber hat das Recht, die Einhaltung dieses Vertrags durch den
            Auftragsverarbeiter zu überprüfen. Anfragen sind schriftlich an{' '}
            <Link href="mailto:anfrage@fscrafted.de">anfrage@fscrafted.de</Link> zu richten.
            Der Auftragsverarbeiter beantwortet solche Anfragen innerhalb von 30 Tagen.
          </p>
          <p style={st.p}>
            Als Nachweis der Compliance gilt insbesondere die Vorlage dieser veröffentlichten
            TOMs sowie der abgeschlossenen Auftragsverarbeitungsverträge mit den
            Unterauftragsverarbeitern (auf Anfrage).
          </p>
        </div>

        <div style={st.divider} />

        {/* § 9 */}
        <div style={st.section}>
          <p style={st.h2}>§ 9 — Vertragsabschluss und Gültigkeit</p>
          <p style={st.p}>
            Dieser AVV wird mit der Registrierung bei CraftFlow durch Setzen des
            entsprechenden Hakens verbindlich vereinbart. Der Zeitstempel der Zustimmung
            wird im System protokolliert und dient als Nachweis gemäß Art. 28 Abs. 3 DSGVO.
          </p>
          <p style={st.p}>
            Es gilt das Recht der Bundesrepublik Deutschland. Gerichtsstand ist Hanau,
            soweit gesetzlich zulässig.
          </p>
          <p style={st.p}>
            FS Crafted behält sich vor, diesen AVV bei wesentlichen Änderungen des Dienstes
            oder der Rechtslage anzupassen. Nutzer werden per E-Mail informiert und haben
            das Recht, der Änderung innerhalb von 14 Tagen zu widersprechen. Bei Widerspruch
            ist die Konto-Löschung kostenfrei möglich.
          </p>
        </div>

        <div style={st.divider} />

        <div style={st.section}>
          <p style={{ ...st.p, fontSize: 12, fontStyle: 'italic' }}>
            Fragen zu diesem AVV: <Link href="mailto:anfrage@fscrafted.de">anfrage@fscrafted.de</Link>
            {' '}· Version {VERSION} · Änderungen werden mit 14 Tagen Vorlauf kommuniziert.
          </p>
        </div>

      </div>
    </div>
  )
}
