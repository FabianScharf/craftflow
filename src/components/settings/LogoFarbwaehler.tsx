'use client'
// Pipette fürs Logo: Das Logo wird groß gezeigt, der Nutzer fährt mit der Maus (oder
// dem Finger) darüber, sieht die Farbe unter dem Zeiger mit Lupe und tippt den Punkt
// an. Danach entscheidet er, ob die Farbe Akzent- oder Primärfarbe wird.
//
// ANLASS (16.09.2026, Tischlerei Lembeck / Fabian): Ein Logo hat oft mehrere Farben.
// „Die kräftigste automatisch nehmen" trifft dann die falsche — der Nutzer muss den
// Punkt selbst wählen. Der Vorschlag (kräftigste Farbe) steht trotzdem als Startwert da.
import { useEffect, useRef, useState } from 'react'
import { C } from '@/lib/types'
import { dominanteFarbe, hexVon } from '@/lib/logofarbe'

type Ziel = 'akzent' | 'primaer'

const LUPE_PUNKTE = 11      // 11 × 11 Bildpunkte in der Lupe
const LUPE_GROESSE = 132    // Bildschirmgröße der Lupe in px
const MAX_BREITE = 900      // Zeichenfläche: größer als das Logo, aber nie über den Schirm hinaus

export default function LogoFarbwaehler({ logoUrl, onWahl, onClose }: {
  logoUrl: string
  onWahl: (hex: string, ziel: Ziel) => void
  onClose: () => void
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const lupeRef = useRef<HTMLCanvasElement | null>(null)
  const [fehler, setFehler] = useState('')
  const [laedt, setLaedt] = useState(true)
  const [unterZeiger, setUnterZeiger] = useState<string | null>(null)
  const [gewaehlt, setGewaehlt] = useState<string | null>(null)
  const [vorschlag, setVorschlag] = useState<string | null>(null)

  useEffect(() => {
    let abgebrochen = false
    ;(async () => {
      try {
        // Cache-Brecher: Der Storage-CDN liefert unter demselben Pfad sonst das alte Logo.
        const trenner = logoUrl.includes('?') ? '&' : '?'
        const res = await fetch(`${logoUrl}${trenner}v=${Date.now()}`, { cache: 'no-store' })
        if (!res.ok) throw new Error(`Logo nicht ladbar (${res.status})`)
        const bitmap = await createImageBitmap(await res.blob())
        if (abgebrochen) return
        const canvas = canvasRef.current
        if (!canvas) return
        // Groß, aber nicht größer als der Schirm; kleine Logos werden vergrößert.
        const maxB = Math.min(MAX_BREITE, window.innerWidth - 48)
        const maxH = Math.max(160, window.innerHeight - 260)
        const faktor = Math.min(maxB / bitmap.width, maxH / bitmap.height)
        canvas.width = Math.max(1, Math.round(bitmap.width * faktor))
        canvas.height = Math.max(1, Math.round(bitmap.height * faktor))
        const ctx = canvas.getContext('2d')
        if (!ctx) throw new Error('Kein Zeichenbereich')
        ctx.imageSmoothingEnabled = faktor < 1 // beim Vergrößern scharfe Pixel, kein Weichzeichnen
        ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
        setVorschlag(dominanteFarbe(ctx.getImageData(0, 0, canvas.width, canvas.height).data))
        setLaedt(false)
      } catch (e) {
        if (!abgebrochen) { setFehler(e instanceof Error ? e.message : 'Unbekannter Fehler'); setLaedt(false) }
      }
    })()
    return () => { abgebrochen = true }
  }, [logoUrl])

  /** Bildpunkt unter der Zeigerposition lesen und Lupe zeichnen. */
  function lies(clientX: number, clientY: number): string | null {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return null
    const r = canvas.getBoundingClientRect()
    const x = Math.floor((clientX - r.left) * (canvas.width / r.width))
    const y = Math.floor((clientY - r.top) * (canvas.height / r.height))
    if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) return null
    const d = ctx.getImageData(x, y, 1, 1).data
    if (d[3] < 128) return null // durchsichtig: keine Farbe
    const lupe = lupeRef.current
    const lctx = lupe?.getContext('2d')
    if (lupe && lctx) {
      const halb = Math.floor(LUPE_PUNKTE / 2)
      lctx.imageSmoothingEnabled = false
      lctx.clearRect(0, 0, lupe.width, lupe.height)
      lctx.drawImage(canvas, x - halb, y - halb, LUPE_PUNKTE, LUPE_PUNKTE, 0, 0, lupe.width, lupe.height)
      const z = lupe.width / LUPE_PUNKTE
      // Canvas versteht keine CSS-Variablen — den echten Wert der Textfarbe lesen.
      const rahmen = getComputedStyle(document.documentElement).getPropertyValue('--c-text').trim() || 'white'
      lctx.strokeStyle = rahmen; lctx.lineWidth = 2
      lctx.strokeRect(halb * z, halb * z, z, z)
    }
    return hexVon(d[0], d[1], d[2])
  }

  const knopf = (aktiv: boolean) => ({
    background: aktiv ? C.copper : 'transparent', color: aktiv ? C.black : C.textMid,
    border: `1px solid ${aktiv ? C.copper : C.border}`, borderRadius: 6, padding: '9px 16px',
    fontSize: 12, fontWeight: 700 as const, cursor: aktiv ? 'pointer' : 'not-allowed',
    fontFamily: 'Helvetica Neue,sans-serif',
  })

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,.82)',
        // Oben Platz lassen: Der Testphasen-Balken der App liegt sonst über der Kopfzeile.
        display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '64px 16px 24px', overflow: 'auto' }}
    >
      <div onClick={e => e.stopPropagation()} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, maxWidth: '100%' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
          <div style={{ color: C.white, fontSize: 11, letterSpacing: 2, textTransform: 'uppercase' }}>
            Farbe aus dem Logo — Punkt antippen
          </div>
          <button onClick={onClose} style={{ background: 'transparent', color: C.textMid, border: `1px solid ${C.border}`,
            borderRadius: 6, padding: '6px 14px', fontSize: 12, cursor: 'pointer', fontFamily: 'Helvetica Neue,sans-serif' }}>
            Schließen
          </button>
        </div>

        {fehler && <div style={{ color: C.err, fontSize: 12 }}>Fehler: Das Logo konnte nicht gelesen werden ({fehler}).</div>}
        {laedt && !fehler && <div style={{ color: C.textMid, fontSize: 12 }}>Lade Logo …</div>}

        {/* Schachbrett hinter dem Logo, damit Weiß und Durchsichtig unterscheidbar sind */}
        <div style={{ padding: 8, borderRadius: 8, border: `1px solid ${C.border}`,
          backgroundColor: C.gray2,
          backgroundImage: `linear-gradient(45deg, ${C.gray1} 25%, transparent 25%, transparent 75%, ${C.gray1} 75%), linear-gradient(45deg, ${C.gray1} 25%, transparent 25%, transparent 75%, ${C.gray1} 75%)`,
          backgroundSize: '16px 16px', backgroundPosition: '0 0, 8px 8px', maxWidth: '100%', overflow: 'auto' }}>
          <canvas
            ref={canvasRef}
            data-testid="logo-pipette"
            onMouseMove={e => setUnterZeiger(lies(e.clientX, e.clientY))}
            onMouseLeave={() => setUnterZeiger(null)}
            onClick={e => { const h = lies(e.clientX, e.clientY); if (h) setGewaehlt(h) }}
            onTouchMove={e => { const t = e.touches[0]; if (t) setUnterZeiger(lies(t.clientX, t.clientY)) }}
            onTouchEnd={e => { const t = e.changedTouches[0]; if (t) { const h = lies(t.clientX, t.clientY); if (h) setGewaehlt(h) } }}
            style={{ display: laedt || fehler ? 'none' : 'block', cursor: 'crosshair', maxWidth: '100%', touchAction: 'none' }}
          />
        </div>

        <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
          <canvas ref={lupeRef} width={LUPE_GROESSE} height={LUPE_GROESSE}
            style={{ width: LUPE_GROESSE, height: LUPE_GROESSE, borderRadius: 8, border: `1px solid ${C.border}`, background: C.gray2 }} />
          <div style={{ display: 'grid', gap: 8, fontSize: 12, color: C.textMid, minWidth: 220 }}>
            <Zeile label="Unter dem Zeiger" hex={unterZeiger} />
            <Zeile label="Gewählt" hex={gewaehlt} />
            <Zeile label="Vorschlag (kräftigste Farbe)" hex={vorschlag} onClick={vorschlag ? () => setGewaehlt(vorschlag) : undefined} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
          <button disabled={!gewaehlt} onClick={() => gewaehlt && onWahl(gewaehlt, 'akzent')} style={knopf(!!gewaehlt)}>
            Als Akzentfarbe übernehmen
          </button>
          <button disabled={!gewaehlt} onClick={() => gewaehlt && onWahl(gewaehlt, 'primaer')} style={knopf(!!gewaehlt)}>
            Als Primärfarbe übernehmen
          </button>
        </div>
        <div style={{ color: C.textMid, fontSize: 11, textAlign: 'center', maxWidth: 520, lineHeight: 1.6 }}>
          Die Lupe zeigt die Bildpunkte um den Zeiger. Gespeichert wird erst mit „Speichern“ unten auf der Seite.
        </div>
      </div>
    </div>
  )
}

function Zeile({ label, hex, onClick }: { label: string; hex: string | null; onClick?: () => void }) {
  return (
    <div onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: onClick ? 'pointer' : 'default' }}>
      <span style={{ width: 22, height: 22, borderRadius: 4, border: `1px solid ${C.border}`, background: hex ?? 'transparent', flexShrink: 0 }} />
      <span style={{ color: C.textMid }}>{label}:</span>
      <span style={{ color: C.white, fontWeight: 700, fontFamily: 'Menlo, monospace' }}>{hex ?? '–'}</span>
      {onClick && <span style={{ color: C.copper, fontSize: 11 }}>übernehmen</span>}
    </div>
  )
}
