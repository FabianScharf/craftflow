import type { Metadata, Viewport } from 'next'

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
      <body style={{ margin: 0, padding: 0, background: '#0D0D0D' }}>
        {children}
      </body>
    </html>
  )
}
