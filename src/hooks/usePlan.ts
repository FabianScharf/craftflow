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

// Auf KALENDERTAGE gerechnet, nicht auf Stunden. Die frühere Rechnung
// (Math.ceil auf die Millisekunden-Differenz) liess den Zaehler je nach
// Uhrzeit bis zu einen Tag stillstehen: Wer gestern um 20 Uhr registriert hat,
// hatte heute Mittag noch 13,3 Tage — aufgerundet also weiterhin "14 Tage".
// Der Nutzer zaehlt aber Kalendertage, nicht Stunden.
function calcTrialDaysLeft(trialStartsAt: string | null): number {
  if (!trialStartsAt) return 0
  const start = new Date(trialStartsAt)
  if (Number.isNaN(start.getTime())) return 0
  const jetzt = new Date()
  const startTag = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate())
  const heuteTag = Date.UTC(jetzt.getFullYear(), jetzt.getMonth(), jetzt.getDate())
  const vergangeneTage = Math.round((heuteTag - startTag) / 86400_000)
  return Math.max(0, TRIAL_DAYS - vergangeneTage)
}

// Ob der Trial noch laeuft, entscheidet weiterhin die exakte Zeitgrenze —
// identisch zu /api/usage/route.ts. Waere das an die Kalendertag-Anzeige
// gekoppelt, wuerde die Oberflaeche am letzten Tag sperren, waehrend der
// Server noch erlaubt.
function trialLaeuft(trialStartsAt: string | null): boolean {
  if (!trialStartsAt) return false
  const start = new Date(trialStartsAt).getTime()
  if (Number.isNaN(start)) return false
  return Date.now() < start + TRIAL_DAYS * 86400_000
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

  const isInTrial = trialLaeuft(trialStartsAt)
  // Während Trial hat jeder Enterprise-Zugriff
  const effectivePlan: Plan = isInTrial ? 'enterprise' : plan

  // Trial abgelaufen + kein bezahlter Plan = gesperrt
  const trialExpired = trialStartsAt !== null && !isInTrial
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
