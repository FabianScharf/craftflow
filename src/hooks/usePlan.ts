'use client'
import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import {
  PLAN_RANK, TRIAL_DAYS, effektiverPlan, sperrgrund as planSperrgrund,
  erlaubt as planErlaubt, deckel as planDeckel,
  mindestPlan, PLAN_LABELS, type Plan, type EffektiverPlan, type Funktion, type DeckelArt,
} from '@/lib/plaene'

export type { Plan, EffektiverPlan } from '@/lib/plaene'
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
  const [aboStatus, setAboStatus] = useState<string | null>(null)
  const [planGueltigBis, setPlanGueltigBis] = useState<string | null>(null)
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
        .select('plan, trial_starts_at, abo_status, plan_gueltig_bis')
        .eq('user_id', user.id)
        .single()
      if (data?.plan) setPlan(data.plan as Plan)
      setTrialStartsAt(data?.trial_starts_at ?? null)
      setAboStatus(data?.abo_status ?? null)
      setPlanGueltigBis(data?.plan_gueltig_bis ?? null)
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
  const profilFuerPlan = { plan, trial_starts_at: trialStartsAt, abo_status: aboStatus, plan_gueltig_bis: planGueltigBis }
  // Während Trial hat jeder Enterprise-Zugriff; danach nur mit aktivem Abo oder
  // gültigem Nicht-Solo-Plan — sonst 'gesperrt' (Aufgabe 0).
  const effectivePlan: EffektiverPlan = effektiverPlan(profilFuerPlan)

  // Trial abgelaufen + kein bezahlter Plan = gesperrt. isBlocked ist jetzt die
  // serverseitige Wahrheit (effectivePlan === 'gesperrt'), nicht mehr nur
  // "trialExpired && plan === 'solo'" — sonst blieb ein Nutzer mit abgelaufenem
  // Gutschein oder beendetem Abo an der Paywall vorbei.
  //
  // `!loading` ist Pflicht: Der Default-Zustand vor dem ersten Laden (plan
  // 'solo', kein trial_starts_at, kein Abo) errechnet sich sonst selbst als
  // 'gesperrt' — jede Seite würde beim Laden kurz die Paywall aufblitzen sehen.
  const trialExpired = trialStartsAt !== null && !isInTrial
  const isBlocked = !loading && effectivePlan === 'gesperrt'
  const sperrgrund = () => planSperrgrund(profilFuerPlan)

  // 'gesperrt' hat Rang 0: niedriger als jeder echte Plan, canUse also immer falsch.
  const canUse = (minPlan: Plan) => effectivePlan !== 'gesperrt' && PLAN_RANK[effectivePlan] >= PLAN_RANK[minPlan]
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
    usage, incrementUsage, refreshUsage: loadUsage, isBlocked, trialExpired, sperrgrund,
  }
}
