'use client'
import { C } from '@/lib/types'
import { akzentTon } from '@/lib/theme'
import { Plan, usePlan } from '@/hooks/usePlan'

const PLAN_LABELS: Record<Plan, string> = {
  solo: 'Solo', starter: 'Starter', pro: 'Pro', enterprise: 'Enterprise',
}

export function PlanGate({ minPlan, children, fallback }: {
  minPlan: Plan
  children: React.ReactNode
  fallback?: React.ReactNode
}) {
  const { canUse, loading } = usePlan()
  if (loading) return null
  if (canUse(minPlan)) return <>{children}</>
  if (fallback) return <>{fallback}</>
  return (
    <div style={{
      borderRadius: 8,
      border: `1px dashed ${akzentTon('66')}`,
      background: akzentTon('0D'),
      padding: '28px 20px',
      textAlign: 'center',
    }}>
      <p style={{ fontSize: 13, color: C.textMid, margin: '0 0 14px' }}>
        Diese Funktion ist ab dem{' '}
        <strong style={{ color: C.copper }}>{PLAN_LABELS[minPlan]}-Plan</strong>{' '}
        verfügbar.
      </p>
      <button style={{
        background: C.copper, color: C.black, border: 'none', borderRadius: 6,
        padding: '9px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
        fontFamily: 'Helvetica Neue, sans-serif',
      }}>Upgrade</button>
    </div>
  )
}
