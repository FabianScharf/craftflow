import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { sicherNext } from '@/lib/team'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  // `next` kommt aus der Bestätigungsmail (Registrierung mit Einladung) und wird
  // GEPRÜFT, nie durchgereicht: Ohne sicherNext wäre
  // /auth/callback?next=//boese.example eine offene Weiterleitung auf eine fremde
  // Domain — mit frischer Sitzung im Gepäck. Alles außer einem eigenen, relativen
  // Pfad landet auf '/'.
  const next = sicherNext(searchParams.get('next'))

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/auth/forgot-password?error=link_expired`)
}
