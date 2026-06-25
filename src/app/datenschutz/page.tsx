import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Datenschutz — CraftFlow' }

const st = {
  page:    { background: '#0D0D0D', color: '#F5F2EE', fontFamily: 'system-ui, sans-serif', minHeight: '100vh', lineHeight: 1.65 } as React.CSSProperties,
  nav:     { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: '1px solid #1E1E1E' } as React.CSSProperties,
  logo:    { fontWeight: 600, fontSize: 15, color: '#F5F2EE', textDecoration: 'none' } as React.CSSProperties,
  copper:  { color: '#C8885A' } as React.CSSProperties,
  back:    { fontSize: 13, color: '#8A8A8A', textDecoration: 'none' } as React.CSSProperties,
  wrap:    { maxWidth: 640, margin: '0 auto', padding: '56px 24px 80px' } as React.CSSProperties,
  label:   { fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: '#8A8A8A', marginBottom: 12 },
  h1:      { fontSize: 28, fontWeight: 600, color: '#F5F2EE', marginBottom: 6, letterSpacing: '-0.01em' } as React.CSSProperties,
  sub:     { fontSize: 13, color: '#8A8A8A', marginBottom: 44 } as React.CSSProperties,
  section: { marginBottom: 32 } as React.CSSProperties,
  h2:      { fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: '#C8885A', marginBottom: 10 },
  p:       { fontSize: 14, color: '#8A8A8A', lineHeight: 1.75, marginBottom: 8 } as React.CSSProperties,
  hi:      { color: '#F5F2EE', fontWeight: 600 } as React.CSSProperties,
  divider: { height: 1, background: '#1E1E1E', margin: '32px 0' } as React.CSSProperties,
}

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
        <p style={st.sub}>Stand: Juni 2025</p>

        <div style={st.section}>
          <p style={st.h2}>Verantwortlicher</p>
          <p style={st.p}>
            Fabian Scharf · FS Crafted<br />
            Fuldaer Straße 15, 63517 Rodenbach<br />
            E-Mail: anfrage@fscrafted.de
          </p>
        </div>

        <div style={st.divider} />

        <div style={st.section}>
          <p style={st.h2}>Hosting</p>
          <p style={st.p}>
            Diese Anwendung wird gehostet bei <span style={st.hi}>Vercel Inc.</span>,
            340 Pine Street, Suite 701, San Francisco, CA 94104, USA. Die Datenübertragung
            in die USA erfolgt auf Grundlage der Standardvertragsklauseln der EU-Kommission
            (Art. 46 Abs. 2 lit. c DSGVO).
          </p>
          <p style={st.p}>
            Beim Aufruf werden automatisch Server-Logfiles erfasst (IP-Adresse, Browsertyp,
            aufgerufene Seite, Zeitstempel). Diese Daten werden ausschließlich zur Sicherstellung
            des Betriebs verwendet und nach spätestens 30 Tagen gelöscht.
          </p>
        </div>

        <div style={st.divider} />

        <div style={st.section}>
          <p style={st.h2}>Nutzerkonto & Authentifizierung</p>
          <p style={st.p}>
            Zur Nutzung von CraftFlow ist ein Konto erforderlich. Dabei wird Ihre{' '}
            <span style={st.hi}>E-Mail-Adresse</span> gespeichert und zur Authentifizierung
            verwendet. Die Verarbeitung erfolgt auf Grundlage von Art. 6 Abs. 1 lit. b DSGVO
            (Vertragserfüllung).
          </p>
          <p style={st.p}>
            Die Nutzerdaten werden in der Datenbank von <span style={st.hi}>Supabase</span> (Supabase Inc.)
            gespeichert. Der Datenbankserver befindet sich in Frankfurt am Main (AWS eu-central-1)
            und damit innerhalb der EU.
          </p>
        </div>

        <div style={st.divider} />

        <div style={st.section}>
          <p style={st.h2}>KI-Verarbeitung von Projektbeschreibungen</p>
          <p style={st.p}>
            Zur Erstellung von Kalkulationen übermittelt CraftFlow Ihre Projektbeschreibungen
            (Texte, ggf. Fotos) an <span style={st.hi}>Anthropic, PBC</span>,
            548 Market St PMB 90375, San Francisco, CA 94104, USA.
          </p>
          <p style={st.p}>
            Die Übermittlung in die USA erfolgt auf Grundlage der Standardvertragsklauseln
            der EU-Kommission (Art. 46 Abs. 2 lit. c DSGVO). Übermittelte Projektbeschreibungen
            werden von Anthropic nicht dauerhaft gespeichert oder für das Training von KI-Modellen
            verwendet.
          </p>
          <p style={st.p}>
            Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung), da die
            KI-Analyse wesentlicher Bestandteil des gebuchten Dienstes ist.
          </p>
        </div>

        <div style={st.divider} />

        <div style={st.section}>
          <p style={st.h2}>Ihre Rechte</p>
          <p style={st.p}>
            Sie haben jederzeit das Recht auf:
          </p>
          <p style={st.p}>
            — Auskunft über Ihre gespeicherten Daten (Art. 15 DSGVO)<br />
            — Berichtigung unrichtiger Daten (Art. 16 DSGVO)<br />
            — Löschung Ihrer Daten (Art. 17 DSGVO)<br />
            — Einschränkung der Verarbeitung (Art. 18 DSGVO)<br />
            — Datenübertragbarkeit (Art. 20 DSGVO)<br />
            — Widerspruch gegen die Verarbeitung (Art. 21 DSGVO)
          </p>
          <p style={st.p}>
            Für alle Anfragen wenden Sie sich bitte per E-Mail an:{' '}
            <a href="mailto:anfrage@fscrafted.de" style={{ color: '#C8885A' }}>
              anfrage@fscrafted.de
            </a>
          </p>
          <p style={st.p}>
            Sie haben zudem das Recht, sich bei der zuständigen Datenschutz-Aufsichtsbehörde
            zu beschweren. In Hessen ist dies der{' '}
            <span style={st.hi}>Hessische Beauftragte für Datenschutz und Informationsfreiheit</span>.
          </p>
        </div>

        <div style={st.divider} />

        <div style={st.section}>
          <p style={st.h2}>Cookies</p>
          <p style={st.p}>
            CraftFlow verwendet ausschließlich technisch notwendige Cookies zur
            Aufrechterhaltung der Sitzung (Session-Cookie). Es werden keine
            Tracking- oder Marketing-Cookies eingesetzt.
          </p>
        </div>
      </div>
    </div>
  )
}
