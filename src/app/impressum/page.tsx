import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Impressum — CraftFlow' }

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

const Hi = ({ children }: { children: React.ReactNode }) => <span style={st.hi}>{children}</span>

export default function Impressum() {
  return (
    <div style={st.page}>
      <nav style={st.nav}>
        <a href="/" style={st.logo}>Craft<span style={st.copper}>Flow</span></a>
        <a href="/" style={st.back}>← Zurück</a>
      </nav>

      <div style={st.wrap}>
        <p style={st.label}>Rechtliches</p>
        <h1 style={st.h1}>Impressum</h1>
        <p style={st.sub}>Angaben gemäß § 5 DDG</p>

        {/* Anbieter */}
        <div style={st.section}>
          <p style={st.h2}>Anbieter</p>
          <p style={st.p}>
            <Hi>Fabian Scharf</Hi><br />
            FS Crafted<br />
            Fuldaer Straße 15<br />
            63517 Rodenbach<br />
            Deutschland
          </p>
          <p style={st.p}>
            Rechtsform: <Hi>Einzelunternehmen</Hi>
          </p>
        </div>

        <div style={st.divider} />

        {/* Kontakt */}
        <div style={st.section}>
          <p style={st.h2}>Kontakt</p>
          <p style={st.p}>
            Telefon: <Hi>+49 160 4416822</Hi><br />
            E-Mail:{' '}
            <a href="mailto:anfrage@fscrafted.de" style={{ color: '#C8885A' }}>
              anfrage@fscrafted.de
            </a>
          </p>
        </div>

        <div style={st.divider} />

        {/* Steuer */}
        <div style={st.section}>
          <p style={st.h2}>Steuerliche Angaben</p>
          <p style={st.p}>
            Umsatzsteuer-Identifikationsnummer gemäß § 27a UStG:<br />
            <Hi>DE459348681</Hi>
          </p>
        </div>

        <div style={st.divider} />

        {/* Handwerksrecht */}
        <div style={st.section}>
          <p style={st.h2}>Berufsrechtliche Angaben</p>
          <p style={st.p}>
            Berufsbezeichnung: <Hi>Schreinermeister</Hi><br />
            Berufsbezeichnung verliehen in: <Hi>Deutschland</Hi><br />
            Zuständige Kammer: <Hi>Handwerkskammer Frankfurt-Rhein-Main</Hi><br />
            Berufsrechtliche Regelung: Handwerksordnung (HwO)
          </p>
          <p style={st.p}>
            Die berufsrechtlichen Regelungen sind einsehbar unter:{' '}
            <a href="https://www.gesetze-im-internet.de/hwo/" style={{ color: '#C8885A' }} target="_blank" rel="noopener noreferrer">
              www.gesetze-im-internet.de/hwo
            </a>
          </p>
        </div>

        <div style={st.divider} />

        {/* Inhaltlich Verantwortlicher */}
        <div style={st.section}>
          <p style={st.h2}>Inhaltlich Verantwortlicher</p>
          <p style={st.p}>
            Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV:<br />
            <Hi>Fabian Scharf</Hi><br />
            Fuldaer Straße 15, 63517 Rodenbach
          </p>
        </div>

        <div style={st.divider} />

        {/* Streitschlichtung */}
        <div style={st.section}>
          <p style={st.h2}>Online-Streitbeilegung</p>
          <p style={st.p}>
            Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung bereit:{' '}
            <a href="https://ec.europa.eu/consumers/odr/" style={{ color: '#C8885A' }} target="_blank" rel="noopener noreferrer">
              ec.europa.eu/consumers/odr
            </a>
          </p>
          <p style={st.p}>
            CraftFlow richtet sich ausschließlich an Unternehmer (B2B). Wir sind nicht
            verpflichtet und nicht bereit, an Streitbeilegungsverfahren vor einer
            Verbraucherschlichtungsstelle teilzunehmen.
          </p>
        </div>

        <div style={st.divider} />

        {/* Haftungshinweis */}
        <div style={st.section}>
          <p style={st.h2}>Haftungshinweis</p>
          <p style={st.p}>
            Trotz sorgfältiger inhaltlicher Kontrolle übernehmen wir keine Haftung für
            die Inhalte externer Links. Für den Inhalt verlinkter Seiten sind
            ausschließlich deren Betreiber verantwortlich.
          </p>
        </div>

      </div>
    </div>
  )
}
