'use client'
import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import {
  PLAN_RANK, TRIAL_DAYS, effektiverPlan, erlaubt as planErlaubt, deckel as planDeckel,
  mindestPlan, PLAN_LABELS, type Plan, type Funktion, type DeckelArt,
} from '@/lib/plaene'

export type { Plan } from '@/lib/plaene'
export { mindestPlan, PLAN_LABELS, TRIAL_DAYS }
export type { Funktion, DeckelArt }

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

// Reine Zeitprüfung, außerhalb der Komponente — ruft Date.now() nicht direkt
// im Render-Body auf (sonst meldet react-hooks/purity einen Fehler).
function istNochInTrial(trialStartsAt: string | null): boolean {
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

  // Ob der Trial noch laeuft, entscheidet weiterhin die exakte Zeitgrenze —
  // identisch zu /api/usage/route.ts und effektiverPlan() in plaene.ts. Waere
  // das an die Kalendertag-Anzeige gekoppelt, wuerde die Oberflaeche am
  // letzten Tag sperren, waehrend der Server noch erlaubt.
  const isInTrial = istNochInTrial(trialStartsAt)
  // Während Trial hat jeder Enterprise-Zugriff
  const effectivePlan: Plan = effektiverPlan({ plan, trial_starts_at: trialStartsAt })

  // Trial abgelaufen + kein bezahlter Plan = gesperrt
  const trialExpired = trialStartsAt !== null && !isInTrial
  const isBlocked = trialExpired && plan === 'solo'

  const canUse = (minPlan: Plan) => PLAN_RANK[effectivePlan] >= PLAN_RANK[minPlan]
  const erlaubt = (f: Funktion) => planErlaubt(effectivePlan, f)
  const deckel = (art: DeckelArt) => planDeckel(effectivePlan, art)

  const incrementUsage = useCallback(async (): Promise<boolean> => {
    const res = await fetch('/api/usage', { method: 'POST' })
    if (!res.ok) return false
    await loadUsage()
    return true
  }, [loadUsage])

  return {
    plan, effectivePlan, isInTrial, trialDaysLeft, loading, canUse, erlaubt, deckel,
    usage, incrementUsage, isBlocked, trialExpired,
  }
}
