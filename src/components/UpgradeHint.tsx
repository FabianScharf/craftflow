'use client'
import { C } from '@/lib/types'
import { akzentTon } from '@/lib/theme'
import { mindestPlan, PLAN_LABELS, type Funktion } from '@/hooks/usePlan'

// Sprechende Labels für die Funktionen, die im UI hinter einem Upgrade-Hinweis stehen.
const LABEL: Record<Funktion, string> = {
  spracheingabe: 'Spracheingabe',
  pdf: 'PDF-Angebot',
  assistent: 'Hilfe-Assistent',
  dateien: 'Bilder & PDFs hochladen',
  export: 'Kalkulationsexport',
  kalibrierung: 'Betriebskalibrierung',
  bauweise: 'Bauweise-Regeln',
  materialpreise: 'Materialpreise',
  gestaltung: 'Textbausteine & Briefpapier',
  lieferanten: 'Lieferantenanfrage',
  bloecke: 'Große Projekte in Blöcken',
  lernschleife: 'Lernschleife',
  auswertung: 'Auswertung',
  smtp: 'Versand über eigene E-Mail',
  ausschreibung: 'Ausschreibungs-Modus',
  internetsuche: 'Internetsuche',
  gaeb: 'GAEB-Import',
}

interface Props {
  feature: Funktion
  inline?: boolean
}

export function UpgradeHint({ feature, inline = false }: Props) {
  const minPlan = mindestPlan(feature)
  const label = LABEL[feature]
  const text = `🔒 ${label} — ab ${PLAN_LABELS[minPlan]}`

  if (inline) {
    return (
      <span style={{ fontSize: 10, color: C.copper, marginLeft: 6, whiteSpace: 'nowrap' }}>
        🔒 ab {PLAN_LABELS[minPlan]}
      </span>
    )
  }

  return (
    <div
      onClick={() => window.location.href = '/settings#plan'}
      style={{
        background: akzentTon('22'), border: `1px solid ${akzentTon('44')}`, borderRadius: 6,
        padding: '10px 14px', fontSize: 12, color: C.copper, cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: 8,
      }}
    >
      <span>{text}</span>
      <span style={{ marginLeft: 'auto', fontSize: 11, opacity: 0.7 }}>Upgrade →</span>
    </div>
  )
}
