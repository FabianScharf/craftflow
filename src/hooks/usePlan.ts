'use client'
import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'

export type Plan = 'solo' | 'starter' | 'pro' | 'enterprise'

const PLAN_RANK: Record<Plan, number> = {
  solo: 1, starter: 2, pro: 3, enterprise: 4,
}

export const TRIAL_DAYS = 14

export const PLAN_LIMITS_ANGEBOTE: Record<Plan, number | null> = {
  solo: 3, starter: 15, pro: 50, enterprise: null,
}

export const PLAN_FEATURES = {
  spracheingabe:       { minPlan: 'solo'       as Plan, label: 'Spracheingabe' },
  bildUpload:          { minPlan: 'starter'     as Plan, label: 'Bilder & PDFs hochladen' },
  kalkulationsexport:  { minPlan: 'starter'     as Plan, label: 'Kalkulationsexport (CSV/Excel)' },
  lieferantenAnfrage:  { minPlan: 'starter'     as Plan, label: 'Lieferantenanfrage über CraftFlow' },
  multiUser:           { minPlan: 'starter'     as Plan, label: 'Bis zu 3 Benutzer' },
  eigeneEmail:         { minPlan: 'pro'         as Plan, label: 'Lieferantenanfrage über eigene E-Mail' },
  gaebImport:          { minPlan: 'enterprise'  as Plan, label: 'GAEB-Import & Kalkulation' },
  prioritaetsSupport:  { minPlan: 'enterprise'  as Plan, label: 'Priorisierter Support' },
} as const

export type FeatureKey = keyof typeof PLAN_FEATURES

export interface UsageInfo {
  count: number
  limit: number | null
  remaining: number | null
  erlaubt: boolean
}

function calcTrialDaysLeft(trialStartsAt: string | null): number {
  if (!trialStartsAt) return 0
  const end = new Date(trialStartsAt).getTime() + TRIAL_DAYS * 86400_000
  return Math.max(0, Math.ceil((end - Date.now()) / 86400_000))
}

export function usePlan() {
  const [plan, setPlan] = useState<Plan>('solo')
  const [trialDaysLeft, setTrialDaysLeft] = useState(0)
  const [trialStartsAt, setTrialStartsAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [usage, setUsage] = useState<UsageInfo | null>(null)

  const loadUsage = useCallback(async () => {
    const res = await fetch('/api/usage')
    if (res.ok) setUsage(await res.json())
  }, [])

  useEffect(() => {
    ;(async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      const { data } = await supabase
        .from('betriebsprofil')
        .select('plan, trial_starts_at')
        .eq('user_id', user.id)
        .single()
      if (data?.plan) setPlan(data.plan as Plan)
      setTrialStartsAt(data?.trial_starts_at ?? null)
      setTrialDaysLeft(calcTrialDaysLeft(data?.trial_starts_at ?? null))
      setLoading(false)
    })()
    loadUsage()
  }, [loadUsage])

  const isInTrial = trialDaysLeft > 0
  // Während Trial hat jeder Enterprise-Zugriff
  const effectivePlan: Plan = isInTrial ? 'enterprise' : plan

  // Trial abgelaufen + kein bezahlter Plan = gesperrt
  const trialExpired = trialStartsAt !== null && trialDaysLeft === 0
  const isBlocked = trialExpired && plan === 'solo'

  const canUse = (minPlan: Plan) => PLAN_RANK[effectivePlan] >= PLAN_RANK[minPlan]

  const incrementUsage = useCallback(async (): Promise<boolean> => {
    const res = await fetch('/api/usage', { method: 'POST' })
    if (!res.ok) return false
    await loadUsage()
    return true
  }, [loadUsage])

  return { plan, effectivePlan, isInTrial, trialDaysLeft, loading, canUse, usage, incrementUsage, isBlocked, trialExpired }
}
