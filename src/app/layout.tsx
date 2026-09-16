import type { Metadata, Viewport } from 'next'
import './globals.css'
import { ThemeLoader } from '@/components/ThemeLoader'

export const metadata: Metadata = {
  title: 'CraftFlow – FS Crafted',
  description: 'KI-Angebotssystem für Schreiner',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'CraftFlow',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#0D0D0D',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <head>
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body style={{ margin: 0, padding: 0, background: 'var(--c-primary, #0D0D0D)' }}>
        <ThemeLoader />
        {children}
        <footer style={{ padding: '14px 24px', borderTop: '1px solid var(--c-border, #1E1E1E)', display: 'flex', justifyContent: 'center', gap: 24 }}>
          <a href="/impressum"   style={{ fontSize: 11, color: 'var(--c-text-mid, #8A8A8A)', textDecoration: 'none' }}>Impressum</a>
          <a href="/datenschutz" style={{ fontSize: 11, color: 'var(--c-text-mid, #8A8A8A)', textDecoration: 'none' }}>Datenschutz</a>
          <a href="/agb"         style={{ fontSize: 11, color: 'var(--c-text-mid, #8A8A8A)', textDecoration: 'none' }}>AGB</a>
        </footer>
      </body>
    </html>
  )
}
