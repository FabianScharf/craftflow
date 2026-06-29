import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Datenschutz — CraftFlow' }

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
  table:   { width: '100%', borderCollapse: 'collapse' as const, fontSize: 13, marginTop: 8 } as React.CSSProperties,
  th:      { textAlign: 'left' as const, color: '#F5F2EE', fontWeight: 600, padding: '6px 12px 6px 0', borderBottom: '1px solid #1E1E1E', fontSize: 12 },
  td:      { color: '#8A8A8A', padding: '8px 12px 8px 0', borderBottom: '1px solid #1A1A1A', verticalAlign: 'top' as const },
}

const Link = ({ href, children }: { href: string; children: React.ReactNode }) => (
  <a href={href} style={{ color: '#C8885A' }} target="_blank" rel="noopener noreferrer">{children}</a>
)

const Hi = ({ children }: { children: React.ReactNode }) => <span style={st.hi}>{children}</span>

export default function Datenschutz() {
  return (
    <div style={st.page}>
      <nav style={st.nav}>
        <a href="/" style={st.logo}>Craft<span style={st.copper}>Flow</span></a>
        <a href="/" style={st.back}>← Zurück</a>
      </nav>

      <div style={st.wrap}>
        <p style={st.label}>Rechtliches</p>
        <h1 style={st.h1}>Datenschutzerklärung</h1>
        <p style={st.sub}>Stand: Juni 2026 · Entwurf — noch nicht rechtsverbindlich</p>

        {/* 1 */}
        <div style={st.section}>
          <p style={st.h2}>1. Verantwortlicher</p>
          <p style={st.p}>
            <Hi>FS Crafted — Fabian Scharf</Hi><br />
            Fuldaer Straße 15, 63517 Rodenbach<br />
            E-Mail: <Link href="mailto:anfrage@fscrafted.de">anfrage@fscrafted.de</Link><br />
            USt-IdNr.: DE459348681
          </p>
        </div>

        <div style={st.divider} />

        {/* 2 */}
        <div style={st.section}>
          <p style={st.h2}>2. Überblick der verarbeiteten Daten</p>
          <p style={st.p}>
            CraftFlow ist eine cloudbasierte Software (SaaS) für Schreiner und Tischler zur
            KI-gestützten Angebotserstellung. Im Betrieb verarbeiten wir:
          </p>
          <p style={st.p}>
            — <Hi>Accountdaten:</Hi> E-Mail-Adresse, Passwort (verschlüsselt)<br />
            — <Hi>Firmenprofil:</Hi> Firmenname, Adresse, Logo, Stundensätze<br />
            — <Hi>Projektdaten:</Hi> Kalkulationen, Positionen, Materialien, Arbeitszeiten<br />
            — <Hi>Kundendaten Dritter:</Hi> Kontaktdaten der Kunden des Nutzers (soweit im Angebot eingegeben)<br />
            — <Hi>Nutzungsdaten:</Hi> App-Interaktionen (KI-Nutzung, Statusänderungen, PDF-Exporte)<br />
            — <Hi>Technische Daten:</Hi> IP-Adresse, Browser-Typ, Zeitstempel (durch Infrastruktur)
          </p>
        </div>

        <div style={st.divider} />

        {/* 3 */}
        <div style={st.section}>
          <p style={st.h2}>3. Hosting — Vercel</p>
          <p style={st.p}>
            Die Anwendung wird gehostet bei <Hi>Vercel Inc.</Hi>, 340 Pine Street,
            Suite 701, San Francisco, CA 94104, USA. Vercel verarbeitet beim Seitenaufruf
            technische Verbindungsdaten (IP-Adresse, Anfrage-Header, Zeitstempel). Diese
            Daten sind für den sicheren Betrieb der Anwendung erforderlich.
          </p>
          <p style={st.p}>
            Die Übertragung in die USA erfolgt auf Grundlage von Standardvertragsklauseln (SCC)
            gemäß Art. 46 Abs. 2 lit. c DSGVO. Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO.
          </p>
          <p style={st.p}>
            Datenschutzerklärung Vercel:{' '}
            <Link href="https://vercel.com/legal/privacy-policy">vercel.com/legal/privacy-policy</Link>
          </p>
        </div>

        <div style={st.divider} />

        {/* 4 */}
        <div style={st.section}>
          <p style={st.h2}>4. Datenbank und Authentifizierung — Supabase</p>
          <p style={st.p}>
            Alle Nutzer- und Projektdaten werden gespeichert bei <Hi>Supabase Inc.</Hi>{' '}
            Der Datenbankserver ist in der <Hi>EU-Region Frankfurt</Hi> (AWS eu-central-1)
            betrieben — es findet keine Datenübertragung außerhalb der EU statt. Supabase
            verarbeitet alle gespeicherten Daten ausschließlich im Auftrag von FS Crafted
            auf Grundlage eines Auftragsverarbeitungsvertrags gemäß Art. 28 DSGVO.
          </p>
          <p style={st.p}>
            Datenschutzerklärung Supabase:{' '}
            <Link href="https://supabase.com/privacy">supabase.com/privacy</Link>
          </p>
        </div>

        <div style={st.divider} />

        {/* 5 */}
        <div style={st.section}>
          <p style={st.h2}>5. KI-Verarbeitung — Anthropic</p>
          <p style={st.p}>
            CraftFlow nutzt künstliche Intelligenz zur automatischen Erstellung und Optimierung
            von Kalkulationen. Texteingaben, Projektbeschreibungen und hochgeladene Fotos werden
            dafür an <Hi>Anthropic PBC</Hi>, 548 Market Street, PMB 90375,
            San Francisco, CA 94104, USA, übertragen.
          </p>
          <p style={st.p}>
            Übertragene Daten umfassen: Projektbeschreibungen, Maße, Materialangaben, Fotos
            sowie bisherige Kalkulationsdaten. Es werden <Hi>keine personenbezogenen
            Kundendaten</Hi> (Namen, vollständige Adressen) an Anthropic weitergegeben.
          </p>
          <p style={st.p}>
            Die Übertragung in die USA erfolgt auf Grundlage von SCC gemäß Art. 46 Abs. 2
            lit. c DSGVO. Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO (die KI-Analyse ist
            Kernbestandteil des Dienstes).
          </p>
          <p style={st.p}>
            Datenschutzerklärung Anthropic:{' '}
            <Link href="https://www.anthropic.com/privacy">anthropic.com/privacy</Link>
          </p>
        </div>

        <div style={st.divider} />

        {/* 6 */}
        <div style={st.section}>
          <p style={st.h2}>6. Registrierung und Account</p>
          <p style={st.p}>
            Bei der Registrierung erfassen wir Ihre <Hi>E-Mail-Adresse</Hi> und ein
            Passwort (das ausschließlich verschlüsselt gespeichert wird, niemals im Klartext).
            Diese Daten sind für den Betrieb des personalisierten Nutzerzugangs zwingend
            erforderlich.
          </p>
          <p style={st.p}>
            Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO.
            Speicherdauer: Bis zur Konto-Löschung, anschließend 30 Tage Löschfrist.
          </p>
        </div>

        <div style={st.divider} />

        {/* 7 */}
        <div style={st.section}>
          <p style={st.h2}>7. Kundendaten Dritter und Auftragsverarbeitung</p>
          <p style={st.p}>
            Nutzer können im Rahmen der Angebotserstellung Kontaktdaten ihrer eigenen Kunden
            (Name, Adresse, E-Mail) eingeben. In diesem Verhältnis gilt:
          </p>
          <p style={st.p}>
            — Der <Hi>Nutzer</Hi> (Handwerker/Schreiner) ist <Hi>Verantwortlicher</Hi> für
            die Daten seiner Kunden.<br />
            — <Hi>FS Crafted/CraftFlow</Hi> ist <Hi>Auftragsverarbeiter</Hi> gemäß Art. 28 DSGVO
            und verarbeitet diese Daten ausschließlich im Auftrag des Nutzers.
          </p>
          <p style={st.p}>
            Zwischen FS Crafted und jedem Nutzer wird bei der Registrierung ein{' '}
            <Hi>Auftragsverarbeitungsvertrag (AVV)</Hi> vereinbart. Kundendaten Dritter
            werden nicht für eigene Zwecke von CraftFlow genutzt, nicht an weitere Dritte
            weitergegeben und nicht für Benchmarking verwendet.
          </p>
          <p style={st.p}>
            Der Nutzer ist selbst dafür verantwortlich, seine Kunden über die Verarbeitung
            ihrer Daten durch CraftFlow zu informieren, soweit dies gesetzlich erforderlich ist.
          </p>
        </div>

        <div style={st.divider} />

        {/* 8 */}
        <div style={st.section}>
          <p style={st.h2}>8. Nutzungsdaten und Produktverbesserung</p>
          <p style={st.p}>
            Zur Verbesserung von CraftFlow erfassen wir automatisch bestimmte Nutzungsdaten:
          </p>
          <p style={st.p}>
            — Zeitpunkt und Häufigkeit von KI-Optimierungen<br />
            — Preisänderungen durch KI-Vorschläge (aggregiert, kein Projektinhalt)<br />
            — PDF-Export-Zeitstempel<br />
            — Statusänderungen von Projekten (offen, gewonnen, verloren, verhandelt)
          </p>
          <p style={st.p}>
            Diese Daten enthalten <Hi>keine Kundennamen, keine vollständigen Adressen und
            keinen Angebotsinalt</Hi>. Sie dienen ausschließlich der Analyse der App-Qualität
            und der Verbesserung der KI-Ergebnisse.
          </p>
          <p style={st.p}>
            Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse).
            Speicherdauer: 36 Monate.
          </p>
        </div>

        <div style={st.divider} />

        {/* 9 */}
        <div style={st.section}>
          <p style={st.h2}>9. Benchmarking und regionale Preisrichtwerte (Opt-in)</p>
          <p style={st.p}>
            Wenn Nutzer <Hi>ausdrücklich zustimmen</Hi> (Opt-in in Einstellungen → Firmendaten),
            verwenden wir anonymisierte Kalkulationsdaten für die Entwicklung regionaler
            Preisrichtwerte. Dabei werden ausschließlich folgende Daten verarbeitet:
          </p>
          <p style={st.p}>
            — Möbeltyp (z.B. „Einbauschrank")<br />
            — Kalkulierter Preis<br />
            — <Hi>PLZ-Bereich (nur erste 2 Stellen</Hi>, z.B. „63xxx") — kein Personenbezug<br />
            — Angebotsergebnis (gewonnen / verloren / verhandelt)
          </p>
          <p style={st.p}>
            Es werden <Hi>keine Namen, vollständigen Adressen oder sonstige
            personenbezogene Daten</Hi> verarbeitet. Die Daten sind nicht auf Einzelpersonen
            zurückführbar.
          </p>
          <p style={st.p}>
            Die Zustimmung kann jederzeit in den Einstellungen widerrufen werden.
            Rechtsgrundlage: Art. 6 Abs. 1 lit. a DSGVO (Einwilligung).
          </p>
        </div>

        <div style={st.divider} />

        {/* 10 */}
        <div style={st.section}>
          <p style={st.h2}>10. Zahlungsabwicklung — Stripe</p>
          <p style={st.p}>
            Die Abwicklung kostenpflichtiger Pläne erfolgt über <Hi>Stripe Inc.</Hi>,
            510 Townsend Street, San Francisco, CA 94103, USA. CraftFlow speichert
            keine Zahlungsdaten (Kreditkartennummern, Bankverbindungen). Alle Zahlungsdaten
            werden ausschließlich von Stripe verarbeitet.
          </p>
          <p style={st.p}>
            Die Übertragung in die USA erfolgt auf Grundlage von SCC gemäß Art. 46 Abs. 2
            lit. c DSGVO. Datenschutzerklärung Stripe:{' '}
            <Link href="https://stripe.com/de/privacy">stripe.com/de/privacy</Link>
          </p>
        </div>

        <div style={st.divider} />

        {/* 11 */}
        <div style={st.section}>
          <p style={st.h2}>11. Cookies</p>
          <p style={st.p}>
            CraftFlow verwendet ausschließlich <Hi>technisch notwendige Cookies</Hi> zur
            Aufrechterhaltung der Anmeldesitzung (Session-Token). Diese Cookies sind für
            den Betrieb der App zwingend erforderlich und können nicht deaktiviert werden.
          </p>
          <p style={st.p}>
            Es werden <Hi>keine Tracking-Cookies, keine Werbe-Cookies und keine
            Analyse-Cookies</Hi> von Drittanbietern eingesetzt.
            Rechtsgrundlage: § 25 Abs. 2 Nr. 2 TDDDG.
          </p>
        </div>

        <div style={st.divider} />

        {/* 12 */}
        <div style={st.section}>
          <p style={st.h2}>12. Speicherdauer</p>
          <table style={st.table}>
            <thead>
              <tr>
                <th style={st.th}>Datenkategorie</th>
                <th style={st.th}>Speicherdauer</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['Account und Profildaten', 'Bis Konto-Löschung + 30 Tage'],
                ['Projektdaten / Kalkulationen', 'Bis Konto-Löschung + 30 Tage'],
                ['Nutzungsdaten (Tracking)', '36 Monate'],
                ['Anonyme Benchmark-Daten', 'Unbegrenzt (kein Personenbezug)'],
                ['Rechnungsdaten', '10 Jahre (gesetzliche Aufbewahrungspflicht)'],
              ].map(([kat, dauer]) => (
                <tr key={kat}>
                  <td style={st.td}>{kat}</td>
                  <td style={st.td}>{dauer}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={st.divider} />

        {/* 13 */}
        <div style={st.section}>
          <p style={st.h2}>13. Ihre Rechte als betroffene Person</p>
          <p style={st.p}>
            Gemäß DSGVO haben Sie folgende Rechte:
          </p>
          <p style={st.p}>
            — <Hi>Auskunft</Hi> (Art. 15): Welche Daten wir über Sie gespeichert haben<br />
            — <Hi>Berichtigung</Hi> (Art. 16): Korrektur unrichtiger Daten<br />
            — <Hi>Löschung</Hi> (Art. 17): Löschung Ihrer Daten<br />
            — <Hi>Einschränkung</Hi> (Art. 18): Einschränkung der Verarbeitung<br />
            — <Hi>Datenübertragbarkeit</Hi> (Art. 20): Herausgabe Ihrer Daten in maschinenlesbarem Format<br />
            — <Hi>Widerspruch</Hi> (Art. 21): Widerspruch gegen Verarbeitung auf Basis berechtigten Interesses<br />
            — <Hi>Widerruf</Hi> (Art. 7 Abs. 3): Widerruf einer Einwilligung jederzeit ohne Angabe von Gründen
          </p>
          <p style={st.p}>
            Für alle Anfragen:{' '}
            <Link href="mailto:anfrage@fscrafted.de">anfrage@fscrafted.de</Link>
          </p>
        </div>

        <div style={st.divider} />

        {/* 14 */}
        <div style={st.section}>
          <p style={st.h2}>14. Beschwerderecht</p>
          <p style={st.p}>
            Sie haben das Recht, sich bei einer Datenschutz-Aufsichtsbehörde zu beschweren.
            Zuständig für FS Crafted in Hessen ist:
          </p>
          <p style={st.p}>
            <Hi>Der Hessische Beauftragte für Datenschutz und Informationsfreiheit</Hi><br />
            Postfach 3163, 65021 Wiesbaden<br />
            <Link href="mailto:poststelle@datenschutz.hessen.de">poststelle@datenschutz.hessen.de</Link>
          </p>
        </div>

        <div style={st.divider} />

        {/* 15 */}
        <div style={st.section}>
          <p style={st.h2}>15. Änderungen dieser Datenschutzerklärung</p>
          <p style={st.p}>
            Wir behalten uns vor, diese Datenschutzerklärung bei Änderungen des Dienstes
            oder der Rechtslage anzupassen. Die jeweils aktuelle Version ist stets unter{' '}
            <Hi>app.getcraftflow.de/datenschutz</Hi> abrufbar. Bei wesentlichen Änderungen
            informieren wir registrierte Nutzer per E-Mail.
          </p>
        </div>

      </div>
    </div>
  )
}
