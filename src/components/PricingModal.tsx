'use client'
import { useState } from 'react'
import { type Plan } from '@/hooks/usePlan'

const C = {
  black: '#0D0D0D', dark: '#141414', gray1: '#1A1A1A', gray2: '#222222',
  border: '#2E2E2E', copper: '#C8885A', white: '#F5F2EE', textMid: '#8A8A8A',
}

const PLANS: {
  id: Plan; name: string; price: number; priceId: string
  features: string[]; highlight?: boolean
}[] = [
  {
    id: 'solo',
    name: 'Solo',
    price: 7,
    priceId: 'price_1TmSblRvozvhvO9J3EKljmMh',
    features: ['Angebote & Kalkulation', 'PDF-Export', '1 Nutzer', 'Kostenstellen-Editor'],
  },
  {
    id: 'starter',
    name: 'Starter',
    price: 29,
    priceId: 'price_1TmScDRvozvhvO9J9tvsywrG',
    features: ['Alles aus Solo', 'Lieferanten-Verwaltung', 'E-Mail-Versand', 'Mehr Projekte'],
    highlight: true,
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 49,
    priceId: 'price_1TmScSRvozvhvO9J0RF42acJ',
    features: ['Alles aus Starter', 'Analysen & Benchmarks', 'Preisempfehlungen', 'API-Zugang'],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 79,
    priceId: 'price_1TmSchRvozvhvO9JOduoM8KU',
    features: ['Alles aus Pro', 'Persönliches Onboarding', 'Dedizierter Support', 'SLA-Garantie'],
  },
]

export function PricingModal({ onClose, currentPlan }: { onClose: () => void; currentPlan: Plan }) {
  const [loading, setLoading] = useState<string | null>(null)

  async function selectPlan(priceId: string, planId: string) {
    if (planId === currentPlan) return
    setLoading(priceId)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId }),
      })
      const { url, error } = await res.json()
      if (error) { alert(error); setLoading(null); return }
      window.location.href = url
    } catch {
      alert('Fehler beim Öffnen des Checkouts')
      setLoading(null)
    }
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(0,0,0,0.75)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: C.dark, borderRadius: 12, border: `1px solid ${C.border}`,
          padding: '28px 24px', maxWidth: 840, width: '100%',
          fontFamily: 'Helvetica Neue, sans-serif',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: C.white, margin: 0 }}>Plan wählen</h2>
            <p style={{ fontSize: 12, color: C.textMid, margin: '4px 0 0' }}>Monatlich kündbar · BETA-Coupon einlösbar</p>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: C.textMid, fontSize: 20, cursor: 'pointer', padding: 0, lineHeight: 1 }}
          >×</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          {PLANS.map(plan => {
            const isCurrent = plan.id === currentPlan
            const isLoading = loading === plan.priceId
            return (
              <div
                key={plan.id}
                style={{
                  background: plan.highlight ? 'rgba(200,136,90,.08)' : C.gray1,
                  border: `1px solid ${plan.highlight ? C.copper : isCurrent ? '#5ABE6A' : C.border}`,
                  borderRadius: 8, padding: '18px 16px',
                  display: 'flex', flexDirection: 'column', gap: 12,
                  position: 'relative',
                }}
              >
                {plan.highlight && (
                  <div style={{
                    position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)',
                    background: C.copper, color: C.black, fontSize: 9, fontWeight: 800,
                    letterSpacing: 1.5, padding: '3px 10px', borderRadius: 20,
                    whiteSpace: 'nowrap',
                  }}>EMPFOHLEN</div>
                )}
                {isCurrent && (
                  <div style={{
                    position: 'absolute', top: -10, right: 12,
                    background: '#5ABE6A', color: C.black, fontSize: 9, fontWeight: 800,
                    letterSpacing: 1, padding: '3px 8px', borderRadius: 20,
                  }}>AKTIV</div>
                )}
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.white }}>{plan.name}</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: plan.highlight ? C.copper : C.white, marginTop: 4 }}>
                    {plan.price} €
                    <span style={{ fontSize: 12, fontWeight: 400, color: C.textMid }}>/Monat</span>
                  </div>
                </div>
                <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 5, flex: 1 }}>
                  {plan.features.map(f => (
                    <li key={f} style={{ fontSize: 12, color: C.textMid, display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                      <span style={{ color: C.copper, flexShrink: 0, marginTop: 1 }}>✓</span>
                      {f}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => selectPlan(plan.priceId, plan.id)}
                  disabled={isCurrent || !!loading}
                  style={{
                    background: isCurrent ? 'transparent' : plan.highlight ? C.copper : C.gray2,
                    color: isCurrent ? '#5ABE6A' : plan.highlight ? C.black : C.white,
                    border: `1px solid ${isCurrent ? '#5ABE6A' : plan.highlight ? C.copper : C.border}`,
                    borderRadius: 6, padding: '9px 0', fontSize: 12, fontWeight: 700,
                    cursor: isCurrent || loading ? 'not-allowed' : 'pointer',
                    fontFamily: 'Helvetica Neue, sans-serif', width: '100%',
                    opacity: loading && !isLoading ? 0.5 : 1,
                  }}
                >
                  {isLoading ? '…' : isCurrent ? 'Aktueller Plan' : 'Auswählen'}
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
