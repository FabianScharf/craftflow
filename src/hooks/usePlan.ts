'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'

export type Plan = 'solo' | 'starter' | 'pro' | 'enterprise'

const PLAN_RANK: Record<Plan, number> = {
  solo: 1, starter: 2, pro: 3, enterprise: 4,
}

export function usePlan() {
  const [plan, setPlan] = useState<Plan>('solo')
  const [loading, setLoading] = useState(true)

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
  }, [])

  const canUse = (minPlan: Plan) => PLAN_RANK[plan] >= PLAN_RANK[minPlan]

  return { plan, loading, canUse }
}
