'use client'
import { useEffect } from 'react'
import { C } from '@/lib/types'
import { akzentTon } from '@/lib/theme'
import { PLAN_LABELS, type Plan, type Funktion } from '@/lib/plaene'
import { ablehnung } from '@/lib/plantexte'
import { usePlan } from '@/hooks/usePlan'

/**
 * Sperrt Inhalt, der einen Plan oder eine Funktion voraussetzt. Zwei Wege:
 * `funktion` — der genaue Grund kommt aus ablehnung() (plantexte.ts), also
 * derselbe Text wie bei einer 403-Antwort vom Server. `minPlan` bleibt für
 * Stellen ohne eigene Funktion (Rang-Vergleich, keine Funktions-Textkarte).
 * Der Knopf führt zu den Plan-Einstellungen statt selbst ein Upgrade
 * auszulösen — auf der Zielseite steht die volle Plan-Auswahl.
 */
export function PlanGate({ minPlan, funktion, children, fallback }: {
  minPlan?: Plan
  funktion?: Funktion
  children: React.ReactNode
  fallback?: React.ReactNode
}) {
  const { canUse, erlaubt, loading, planUnbekannt, zustand } = usePlan()
  // Ruhende und entfernte Mitglieder gehoeren auf die Sperrseite, nicht hinter einen
  // Plan-Kasten (Teamfunktion 2026-09-17): Ihr Problem ist kein fehlender Plan,
  // sondern ein fehlender Nutzerplatz im Betrieb — "Plan wechseln" hilft ihnen nicht.
  // Erst nach dem Laden, sonst wuerde der Startwert 'inhaber' nie zum Zug kommen.
  const gesperrterZustand = !loading && (zustand === 'ruhend' || zustand === 'entfernt')
  useEffect(() => {
    if (gesperrterZustand && window.location.pathname !== '/gesperrt') {
      window.location.href = '/gesperrt'
    }
  }, [gesperrterZustand])
  // Frueher stand hier `return null`. Im Screenshot-Audit 2026-09-16 sahen dadurch
  // mehrere Einstellungsseiten komplett leer aus, solange der Plan noch lud — ohne
  // Ueberschrift, ohne Hinweis, ohne Fehler. Ein Wort ist besser als nichts.
  if (loading) return (
    <div style={{ padding: '28px 20px', textAlign: 'center', fontSize: 13, color: C.textMid }}>
      Lädt …
    </div>
  )
  // Der Sprung auf /gesperrt laeuft im Effekt oben. Bis er greift, darf hier kein
  // Inhalt stehen — sonst blitzt der Bereich eines fremden Betriebs kurz auf.
  if (gesperrterZustand) return (
    <div style={{ padding: '28px 20px', textAlign: 'center', fontSize: 13, color: C.textMid }}>
      Kein Zugang zu diesem Betrieb — einen Moment …
    </div>
  )
  // Der Plan liess sich nicht laden (Notbremse in usePlan). Dann lieber zeigen als
  // sperren — jede bezahlte Aktion haengt serverseitig ohnehin an planpruefung.ts.
  if (planUnbekannt) return <>{children}</>
  const ok = funktion ? erlaubt(funktion) : canUse(minPlan ?? 'solo')
  if (ok) return <>{children}</>
  if (fallback) return <>{fallback}</>
  const text = funktion ? ablehnung(funktion).error : `Diese Funktion ist ab dem ${PLAN_LABELS[minPlan ?? 'solo']}-Plan verfügbar.`
  return (
    <div style={{
      borderRadius: 8,
      border: `1px dashed ${akzentTon('66')}`,
      background: akzentTon('0D'),
      padding: '28px 20px',
      textAlign: 'center',
    }}>
      <p style={{ fontSize: 13, color: C.textMid, margin: '0 0 14px' }}>{text}</p>
      <a
        href="/settings#plan"
        style={{
          display: 'inline-block', background: C.copper, color: C.onAccent, border: 'none', borderRadius: 6,
          padding: '9px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
          fontFamily: 'Helvetica Neue, sans-serif', textDecoration: 'none',
        }}
      >Plan wechseln</a>
    </div>
  )
}
