import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const PUBLIC_PATHS = ['/login', '/register', '/impressum', '/datenschutz', '/agb', '/avv', '/auth/forgot-password', '/auth/reset-password', '/auth/callback', '/api/notify-signup']

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Session refresh — wichtig für SSR-Auth
  // Abgelaufene Refresh Tokens werfen einen AuthApiError → graceful redirect statt 500
  let user = null
  try {
    const { data } = await supabase.auth.getUser()
    user = data.user
  } catch {
    // Refresh Token abgelaufen oder ungültig — Cookies löschen und zur Login-Seite
    const loginUrl = new URL('/login', request.url)
    const res = NextResponse.redirect(loginUrl)
    // Alle Supabase Auth Cookies entfernen damit kein Retry-Loop entsteht
    for (const cookie of request.cookies.getAll()) {
      if (cookie.name.startsWith('sb-')) res.cookies.delete(cookie.name)
    }
    return res
  }

  const pathname = request.nextUrl.pathname

  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return supabaseResponse
  }

  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return supabaseResponse
}

export const config = {
  // woff2 und Co. gehoeren dazu: Schriftdateien sind oeffentliche Dateien wie Bilder.
  //
  // GEFUNDEN AM 2026-09-08 direkt nach dem Livegang: /fonts/inter-400.woff2 bekam
  // eine 307 auf die Anmeldeseite. Fuer angemeldete Nutzer ging es durch, aber jeder
  // Schriftabruf lief unnoetig durch die Anmeldepruefung — und ohne Sitzung waere
  // statt der Schrift eine HTML-Seite gekommen.
  //
  // Das PDF war davon NICHT betroffen: Dort werden die Schriften serverseitig aus dem
  // Dateisystem eingebacken, ohne Netzabruf.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|manifest\\.json|icon.*\\.png|fonts/|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|woff|woff2|ttf|otf)).*)'],
}
