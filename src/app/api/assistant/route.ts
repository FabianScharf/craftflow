import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { assistentWissen } from '@/lib/assistentwissen'

export const maxDuration = 60

type ChatMsg = { role: 'user' | 'assistant'; content: string }

type AppContext = {
  screen?: string        // 'start' | 'projects' | 'app'
  activeTab?: string     // 'kunde' | 'kalkulation' | 'angebot'
  hasProject?: boolean
  positionCount?: number
  optimPanelOpen?: boolean
}

function getContextNote(context: AppContext): string {
  if (!context) return ''
  const parts: string[] = []

  if (context.screen === 'app') {
    if (context.activeTab === 'kalkulation') {
      parts.push('Der Nutzer befindet sich gerade im Reiter KALKULATION.')
      if (context.positionCount && context.positionCount > 0) {
        parts.push(`Das Angebot hat ${context.positionCount} Position(en).`)
      }
      if (!context.optimPanelOpen) {
        parts.push('Die KI-Optimierung ist aktuell nicht geöffnet — weise gerne darauf hin, wenn es passt.')
      } else {
        parts.push('Die KI-Optimierung ist geöffnet.')
      }
    } else if (context.activeTab === 'kunde') {
      parts.push('Der Nutzer befindet sich gerade im Reiter KUNDE.')
    } else if (context.activeTab === 'angebot') {
      parts.push('Der Nutzer befindet sich gerade im Reiter ANGEBOT.')
    }
    if (context.hasProject) {
      parts.push('Ein Projekt ist geladen.')
    }
  } else if (context.screen === 'start') {
    parts.push('Der Nutzer befindet sich auf dem Startbildschirm (Projektübersicht).')
  }

  return parts.length ? `\n\n[AKTUELLER KONTEXT: ${parts.join(' ')}]` : ''
}

export async function POST(req: NextRequest) {
  try {
    const { chatHistory, message, context } = await req.json() as {
      chatHistory: ChatMsg[]
      message: string
      context?: AppContext
    }

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'Kein API Key konfiguriert' }, { status: 500 })

    // Die ECHTEN Stundensaetze dieses Betriebs. Vorher nannte der Assistent jedem
    // Nutzer die Standardwerte ("Besprechung 65 €/h") als Tatsache — wer 85
    // eingestellt hatte, bekam 65 genannt.
    let saetze: Record<string, number> | undefined
    try {
      const supabase = await createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data, error } = await supabase
          .from('kostenstellen')
          .select('bezeichnung, stundensatz, aktiv')
          .eq('user_id', user.id)
        if (error) console.error('[assistent] Kostenstellen:', error.message)
        else if (data?.length) {
          saetze = {}
          for (const k of data) {
            if (k.aktiv === false) continue
            saetze[String(k.bezeichnung)] = Number(k.stundensatz)
          }
        }
      }
    } catch (e) {
      // Ohne Saetze nennt das Wissen bewusst KEINE Zahlen — besser als falsche.
      console.error('[assistent] Saetze laden:', e)
    }

    const systemWithContext = assistentWissen({ saetze }) + getContextNote(context ?? {})

    const messages: ChatMsg[] = [
      // Ohne Absicherung stuerzt die Route bei fehlendem Feld mit
      // "Cannot read properties of undefined" ab — eine 500 ohne Aussage.
      ...(Array.isArray(chatHistory) ? chatHistory.slice(-8) : []),
      { role: 'user', content: message },
    ]

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 800,
        temperature: 0.3,
        system: systemWithContext,
        messages,
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`API ${res.status}: ${err.slice(0, 200)}`)
    }

    const data = await res.json() as { content?: Array<{ text?: string }> }
    const text = data.content?.[0]?.text ?? ''

    return NextResponse.json({ message: text })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unbekannter Fehler'
    console.error('[assistant]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
