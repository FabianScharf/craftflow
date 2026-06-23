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
  divider: { height: 1, background: '#1E1E1E', margin: '32px 0' } as React.CSSProperties,
}

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

        <div style={st.section}>
          <p style={st.h2}>Verantwortlicher</p>
          <p style={st.p}>
            Fabian Scharf<br />
            FS Crafted<br />
            Fuldaer Straße 15<br />
            63517 Rodenbach
          </p>
        </div>

        <div style={st.divider} />

        <div style={st.section}>
          <p style={st.h2}>Kontakt</p>
          <p style={st.p}>
            Telefon: +49 160 4416822<br />
            E-Mail: anfrage@fscrafted.de
          </p>
        </div>

        <div style={st.divider} />

        <div style={st.section}>
          <p style={st.h2}>Umsatzsteuer-ID</p>
          <p style={st.p}>
            Umsatzsteuer-Identifikationsnummer gemäß § 27a UStG:<br />
            DE459348681
          </p>
        </div>

        <div style={st.divider} />

        <div style={st.section}>
          <p style={st.h2}>Streitschlichtung</p>
          <p style={st.p}>
            Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS)
            bereit:{' '}
            <a href="https://ec.europa.eu/consumers/odr/" style={{ color: '#C8885A' }}>
              https://ec.europa.eu/consumers/odr/
            </a>
          </p>
          <p style={st.p}>
            Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren
            vor einer Verbraucherschlichtungsstelle teilzunehmen.
          </p>
        </div>
      </div>
    </div>
  )
}
