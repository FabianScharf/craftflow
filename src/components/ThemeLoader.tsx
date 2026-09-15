'use client'
import { useEffect } from 'react'
import { leitePaletteAb, wendePaletteAn, type Palette } from '@/lib/theme'

const CACHE = 'craftflow-palette'

/**
 * Laedt die Firmenfarben des Nutzers und leitet daraus die komplette Palette ab
 * (Schrift, Kaesten, Rahmen) — siehe src/lib/theme.ts.
 *
 * Die zuletzt bekannte Palette liegt im localStorage und wird sofort angewendet,
 * damit ein Nutzer mit hellem Grund nicht bei jedem Laden erst die dunkle Seite
 * aufblitzen sieht. Danach kommt der frische Stand vom Server.
 */
export function ThemeLoader() {
  useEffect(() => {
    const root = document.documentElement
    try {
      const alt = localStorage.getItem(CACHE)
      if (alt) wendePaletteAn(root, JSON.parse(alt) as Palette)
    } catch { /* kein Cache — egal */ }

    fetch('/api/settings/betriebsprofil')
      .then(r => r.json())
      .then(({ profil }) => {
        if (!profil) return
        const palette = leitePaletteAb(profil.farbe_primaer, profil.farbe_akzent)
        wendePaletteAn(root, palette)
        try { localStorage.setItem(CACHE, JSON.stringify(palette)) } catch { /* voll oder gesperrt */ }
      })
      .catch(() => {})
  }, [])
  return null
}
