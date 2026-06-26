'use client'
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
      border: '1px dashed rgba(200,136,90,.4)',
      background: 'rgba(200,136,90,.05)',
      padding: '28px 20px',
      textAlign: 'center',
    }}>
      <p style={{ fontSize: 13, color: '#8A8A8A', margin: '0 0 14px' }}>
        Diese Funktion ist ab dem{' '}
        <strong style={{ color: '#C8885A' }}>{PLAN_LABELS[minPlan]}-Plan</strong>{' '}
        verfügbar.
      </p>
      <button style={{
        background: '#C8885A', color: '#0D0D0D', border: 'none', borderRadius: 6,
        padding: '9px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
        fontFamily: 'Helvetica Neue, sans-serif',
      }}>Upgrade</button>
    </div>
  )
}
