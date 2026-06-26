'use client'
import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'

export type Plan = 'solo' | 'starter' | 'pro' | 'enterprise'

const PLAN_RANK: Record<Plan, number> = {
  solo: 1, starter: 2, pro: 3, enterprise: 4,
}

export interface UsageInfo {
  count: number
  limit: number | null
  remaining: number | null
  erlaubt: boolean
}

export function usePlan() {
  const [plan, setPlan] = useState<Plan>('solo')
  const [loading, setLoading] = useState(true)
  const [usage, setUsage] = useState<UsageInfo>({ count: 0, limit: 3, remaining: 3, erlaubt: true })

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
        .select('plan')
        .eq('user_id', user.id)
        .single()
      if (data?.plan) setPlan(data.plan as Plan)
      setLoading(false)
    })()
    loadUsage()
  }, [loadUsage])

  const canUse = (minPlan: Plan) => PLAN_RANK[plan] >= PLAN_RANK[minPlan]

  const incrementUsage = useCallback(async (): Promise<boolean> => {
    const res = await fetch('/api/usage', { method: 'POST' })
    if (!res.ok) return false
    await loadUsage()
    return true
  }, [loadUsage])

  return { plan, loading, canUse, usage, incrementUsage }
}
