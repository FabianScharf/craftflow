'use client'

import { usePlan } from '@/hooks/usePlan'

// Die obere Leiste — dieselbe auf jeder Seite.
//
// Fabian am 2026-09-08: "Die obere Zeile bleibt fast immer gleich, außer wenn man
// auf Einstellungen geht. Das finde ich nicht gut, dass die obere Zeile dann
// verschwindet und man in einer anderen Optik arbeitet."
//
// Die Einstellungen liegen unter einer eigenen Route (/settings) und hatten deshalb
// ihren eigenen Kopf. Diese Komponente traegt die Leiste dorthin — und weil sie an
// beiden Orten dieselbe Datei ist, kann sie nicht mehr auseinanderlaufen.
//
// In page.tsx bleiben die drei Kopfzeilen vorerst eigenstaendig: Der PDF-Bildschirm
// traegt zusaetzlich den Kundennamen, und zwei Knoepfe laufen dort durch die
// Rueckfrage bei ungespeicherten Aenderungen (mitPruefung). Nur das LogoMark ist
// gemeinsam — es soll genau ein Zeichen geben, kein zweites daneben.

const FARBE = {
  darkbg: '#141414',
  black: 'var(--c-primary, #0D0D0D)',
  border: '#2E2E2E',
  textMid: '#8A8A8A',
  accent: 'var(--c-accent, #C8885A)',
}

export const LogoMark = ({ size = 36, userLogoUrl }: { size?: number; userLogoUrl?: string | null }) =>
  userLogoUrl
    ? // eslint-disable-next-line @next/next/no-img-element
      <img src={userLogoUrl} alt="Logo" style={{ height: size, width: 'auto', maxWidth: size * 4, objectFit: 'contain' }} />
    : (
      <svg width={size} height={size} viewBox="0 0 36 36" fill="none" style={{ flexShrink: 0 }}>
        <rect width="36" height="36" rx="7" fill="var(--c-accent, #C8885A)" />
        <text x="18" y="25" textAnchor="middle" fill="#0D0D0D"
          fontFamily="Helvetica Neue, Helvetica, Arial, sans-serif"
          fontSize="15" fontWeight="800" letterSpacing="0.5">CF</text>
      </svg>
    )

type Props = {
  /** Welcher Knopf gerade die aktive Ansicht ist — er wird kupfern hervorgehoben. */
  aktiv?: 'neu' | 'projekte' | 'einstellungen'
  logoUrl?: string | null
  firmenName?: string
  isMobile?: boolean
  userEmail?: string
  onLogout?: () => void
}

export function AppHeader({ aktiv, logoUrl, firmenName, isMobile = false, userEmail, onLogout }: Props) {
  // Der Testversions-Hinweis gehoert zur Leiste, nicht zu einer einzelnen Seite —
  // sonst fehlt er dort, wo man ihn zuletzt vermutet. Fabian am 2026-09-08:
  // "Es fehlt auch der Banner mit der Testversion."
  const { isInTrial, trialDaysLeft } = usePlan()

  const knopf = (an: boolean): React.CSSProperties => ({
    background: an ? FARBE.accent : 'transparent',
    color: an ? FARBE.black : FARBE.textMid,
    border: an ? 'none' : `1px solid ${FARBE.border}`,
    borderRadius: 6,
    padding: isMobile ? (an ? '8px 10px' : '7px 9px') : (an ? '9px 12px' : '9px 11px'),
    cursor: 'pointer', fontSize: 16, lineHeight: 1,
    fontFamily: 'Helvetica Neue,sans-serif', fontWeight: an ? 800 : 400,
  })

  return (
    <>
    {isInTrial && (
      <div
        onClick={() => { window.location.href = '/settings#plan' }}
        style={{ background: `${FARBE.accent}18`, borderBottom: `1px solid ${FARBE.accent}55`,
          padding: '8px 16px', display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: 10, cursor: 'pointer' }}
      >
        <span style={{ fontSize: 14 }}>🎁</span>
        <span style={{ fontSize: 12, color: FARBE.accent, fontFamily: 'Helvetica Neue,sans-serif' }}>
          <strong>{trialDaysLeft} {trialDaysLeft === 1 ? 'Tag' : 'Tage'}</strong> Testversion verbleiben — alle Funktionen freigeschaltet
        </span>
        <span style={{ fontSize: 11, color: FARBE.textMid, marginLeft: 4 }}>Plan wählen →</span>
      </div>
    )}
    <div style={{
      background: FARBE.darkbg, padding: '12px 14px', display: 'flex', alignItems: 'center',
      justifyContent: 'space-between', borderBottom: `2px solid ${FARBE.accent}`, gap: 8,
      position: 'sticky', top: 0, zIndex: 20,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flexShrink: 1 }}>
        <LogoMark size={34} userLogoUrl={logoUrl} />
        <div style={{ minWidth: 0 }}>
          <div style={{ color: FARBE.accent, fontSize: 15, fontWeight: 800, letterSpacing: 3, whiteSpace: 'nowrap' }}>
            CRAFTFLOW
          </div>
          {firmenName && !isMobile && (
            <div style={{ color: FARBE.textMid, fontSize: 9, letterSpacing: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 120 }}>
              {firmenName.toUpperCase()}
            </div>
          )}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 4 : 6, flexShrink: 0 }}>
        <button onClick={() => { window.location.href = '/' }} style={knopf(aktiv === 'neu')} title="Neues Angebot">✏️</button>
        {/* Von einer eigenen Route aus fuehrt kein setScreen zurueck — die Startseite
            liest ?ansicht=projekte und oeffnet die Liste direkt. */}
        <button onClick={() => { window.location.href = '/?ansicht=projekte' }} style={knopf(aktiv === 'projekte')} title="Meine Projekte">📋</button>
        <button onClick={() => { window.location.href = '/settings' }} style={knopf(aktiv === 'einstellungen')} title="Einstellungen">⚙️</button>
        {userEmail && onLogout && (
          <button onClick={onLogout} style={knopf(false)} title="Abmelden">🚪</button>
        )}
      </div>
    </div>
    </>
  )
}
