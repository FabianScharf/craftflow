'use client'
import { useEffect } from 'react'

export function ThemeLoader() {
  useEffect(() => {
    fetch('/api/settings/betriebsprofil')
      .then(r => r.json())
      .then(({ profil }) => {
        if (!profil) return
        const root = document.documentElement
        if (profil.farbe_primaer) root.style.setProperty('--c-primary', profil.farbe_primaer)
        if (profil.farbe_akzent) root.style.setProperty('--c-accent', profil.farbe_akzent)
      })
      .catch(() => {})
  }, [])
  return null
}
