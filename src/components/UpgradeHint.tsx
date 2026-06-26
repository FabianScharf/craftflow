'use client'
import { PLAN_FEATURES, type FeatureKey, type Plan } from '@/hooks/usePlan'

const PLAN_LABEL: Record<Plan, string> = {
  solo: 'Solo', starter: 'Starter', pro: 'Pro', enterprise: 'Enterprise',
}

interface Props {
  feature: FeatureKey
  inline?: boolean
}

export function UpgradeHint({ feature, inline = false }: Props) {
  const { minPlan, label } = PLAN_FEATURES[feature]
  const text = `🔒 ${label} — ab ${PLAN_LABEL[minPlan]}`

  if (inline) {
    return (
      <span style={{ fontSize: 10, color: '#C8885A', marginLeft: 6, whiteSpace: 'nowrap' }}>
        🔒 ab {PLAN_LABEL[minPlan]}
      </span>
    )
  }

  return (
    <div
      onClick={() => window.location.href = '/settings#plan'}
      style={{
        background: '#1a1200', border: '1px solid #C8885A44', borderRadius: 6,
        padding: '10px 14px', fontSize: 12, color: '#C8885A', cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: 8,
      }}
    >
      <span>{text}</span>
      <span style={{ marginLeft: 'auto', fontSize: 11, opacity: 0.7 }}>Upgrade →</span>
    </div>
  )
}
