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
  // Der Plan liess sich auch nach der Notbremse nicht laden. Dann gilt: nichts
  // behaupten — weder "erlaubt" noch "gesperrt". Die Oberflaeche zeigt die
  // Inhalte (der Server prueft ohnehin jede bezahlte Aktion selbst), aber keine
  // Sperrkarte, die auf einer Vermutung beruht.
  const [planUnbekannt, setPlanUnbekannt] = useState(false)
  const [usage, setUsage] = useState<UsageInfo | null>(null)

  const loadUsage = useCallback(async () => {
    const res = await fetch('/api/usage')
    if (res.ok) setUsage(await res.json())
  }, [])

  // WARUM DER FEHLERZWEIG SO AUSSIEHT (Audit 2026-09-17, I7):
  // Supabase wirft nicht. Das `error`-Feld wurde bisher gar nicht gelesen — bei einem
  // Aussetzer der Datenbank blieben die Startwerte stehen (plan 'solo', kein
  // trial_starts_at, kein Abo), und genau daraus rechnet effektiverPlan() 'gesperrt'.
  // Ein zahlender Kunde sah dann die Paywall, weil die DB eine Sekunde gehustet hat.
  //
  // Die Regel lautet deshalb: Ein Ladefehler beendet `loading` NICHT. Solange
  // `loading` steht, ist `isBlocked` per Definition falsch (Zeile unten) — die App
  // sperrt niemanden wegen eines Datenbankfehlers aus. Ein Versuch wird nach 1,5 s
  // wiederholt; hilft auch der nicht, bleibt die Oberfläche im Ladezustand, statt
  // eine falsche Sperre zu behaupten. Der Server entscheidet ohnehin eigenständig
  // (planpruefung.ts) — der Browser ist nie die Instanz.
  //
  // PGRST116 ("kein Datensatz") ist KEIN Ausfall, sondern ein Konto ohne
  // Betriebsprofil. Das läuft wie bisher mit den Startwerten weiter.
  //
  // NOTBREMSE (Screenshot-Audit 2026-09-16): Bleibt `loading` fuer immer stehen,
  // bleibt auch jeder PlanGate-Bereich fuer immer leer — im automatisierten
  // Rundgang sahen mehrere Einstellungsseiten deshalb aus, als gaebe es sie nicht.
  // Nach 10 Sekunden endet der Ladezustand daher in jedem Fall, mit `planUnbekannt`.
  // Das ist bewusst ein Fail-Open, und zwar NUR im Browser: jede bezahlte Aktion
  // haengt serverseitig an planpruefung.ts, nicht an diesem Wert.
  useEffect(() => {
    let abgebrochen = false
    let fertig = false
    const notbremse = setTimeout(() => {
      if (abgebrochen || fertig) return
      console.error('[usePlan] Plan nach 10 s nicht geladen — Oberflaeche laeuft ohne Plan weiter (planUnbekannt)')
      setPlanUnbekannt(true)
      setLoading(false)
    }, 10_000)
    const laden = async (versuch: number) => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (abgebrochen) return
      if (!user) { fertig = true; setLoading(false); return }
      const { data, error } = await supabase
        .from('betriebsprofil')
        .select('plan, trial_starts_at, abo_status, plan_gueltig_bis')
        .eq('user_id', user.id)
        .single()
      if (abgebrochen) return
      if (error && error.code !== 'PGRST116') {
        console.error('[usePlan] Betriebsprofil laden:', error.message)
        if (versuch === 0) { setTimeout(() => { void laden(1) }, 1500) }
        return   // loading bleibt absichtlich true — keine Sperre aus einem DB-Fehler
      }
      if (data?.plan) setPlan(data.plan as Plan)
      setTrialStartsAt(data?.trial_starts_at ?? null)
      setAboStatus(data?.abo_status ?? null)
      setPlanGueltigBis(data?.plan_gueltig_bis ?? null)
      setTrialDaysLeft(calcTrialDaysLeft(data?.trial_starts_at ?? null))
      fertig = true
      setPlanUnbekannt(false)
      setLoading(false)
    }
    void laden(0)
    loadUsage()
    return () => { abgebrochen = true; clearTimeout(notbremse) }
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
  // `!planUnbekannt` aus demselben Grund wie `!loading`: Nach der Notbremse stehen
  // wieder nur die Startwerte da, aus denen sich 'gesperrt' errechnet. Eine Paywall
  // aus einem Ladefehler ist schlimmer als eine Seite ohne Sperre.
  const isBlocked = !loading && !planUnbekannt && effectivePlan === 'gesperrt'
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
    plan, effectivePlan, isInTrial, trialDaysLeft, loading, planUnbekannt, canUse, erlaubt, deckel,
    usage, incrementUsage, refreshUsage: loadUsage, isBlocked, trialExpired, sperrgrund,
  }
}
