'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import {
  C, CAT_COL, KALK_TYPEN, FIRMA,
  calcPos, eur, today, inDays,
  ladeKunden, speichereKunden,
  type Kunde, type KundeDB, type Position,
} from '@/lib/types'
import { buildPDF } from '@/lib/pdf'

/* ── Primitive UI ─────────────────────────────────── */
const Lbl = ({ children, c }: { children: React.ReactNode; c?: string }) => (
  <div style={{ fontSize: 9, letterSpacing: 2.5, textTransform: 'uppercase', color: c || C.textMid, marginBottom: 5 }}>
    {children}
  </div>
)
const HR = ({ my = 12, color }: { my?: number; color?: string }) => (
  <div style={{ height: 1, background: color || C.border, margin: `${my}px 0` }} />
)
const LogoMark = ({ size = 36 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 100 100">
    <polygon points="50,4 94,27 94,73 50,96 6,73 6,27" fill="none" stroke={C.copper} strokeWidth="6" />
    <text x="50" y="64" textAnchor="middle" fontFamily="Helvetica Neue,sans-serif" fontSize="32" fontWeight="800" fill={C.copper} letterSpacing="-1">FS</text>
  </svg>
)
const Card = ({ children, accent, style = {} }: { children: React.ReactNode; accent?: string; style?: React.CSSProperties }) => (
  <div style={{
    background: C.gray1, borderRadius: 4,
    border: `1px solid ${accent || C.border}`,
    borderLeft: accent ? `3px solid ${accent}` : undefined,
    marginBottom: 12, overflow: 'hidden',
    boxShadow: '0 1px 4px rgba(0,0,0,.4)', ...style,
  }}>
    {children}
  </div>
)
const NumInput = ({ value, onChange }: { value: number; onChange: (v: number) => void }) => (
  <input type="number" step="0.01" value={value}
    onChange={e => onChange(parseFloat(e.target.value) || 0)}
    style={{ width: '100%', padding: '8px 10px', border: `1px solid ${C.border}`, borderRadius: 3, fontSize: 14, fontFamily: 'Helvetica Neue,sans-serif', background: C.gray2, color: C.white, boxSizing: 'border-box', outline: 'none' }} />
)
const TxtInput = ({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) => (
  <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder || ''}
    style={{ width: '100%', padding: '9px 11px', background: C.gray2, border: `1px solid ${C.border}`, borderRadius: 3, fontSize: 13, color: C.white, fontFamily: 'Helvetica Neue,sans-serif', outline: 'none', boxSizing: 'border-box' }} />
)
const ReadOnly = ({ value }: { value: string }) => (
  <div style={{ width: '100%', padding: '8px 10px', border: `1px solid ${C.border}`, borderRadius: 3, fontSize: 13, background: C.black, color: C.white, boxSizing: 'border-box', fontFamily: 'Helvetica Neue,sans-serif' }}>
    {value}
  </div>
)

/* ── Default Position ─────────────────────────────── */
const defaultPos = (id: number): Position => ({
  id, kat: 'Sonstiges', titel: 'Neue Position', bez: '',
  kalkTyp: 'detail', menge: 1, einheit: 'Stk',
  materialKosten: 0, lohnStd: 0, lohnSatz: 0, gkProzent: 0.30, fremdleistung: 0,
  ep: 0, std: 0, mat: 0, aufschlag: 0.3,
})

/* ── Haupt-Komponente ─────────────────────────────── */
export default function CraftFlow() {
  const [screen, setScreen] = useState<'start' | 'app' | 'pdf'>('start')
  const [kunden, setKunden] = useState<KundeDB[]>(ladeKunden)
  const [kunde, setKunde] = useState<Kunde>({ name: '', zusatz: '', strasse: '', ort: '', projekt: '' })

  const [tab, setTab] = useState('kunde')
  const [pos, setPos] = useState<Position[]>([
    {
      id: 1, kat: 'Korpus', titel: 'Einbauschrank Korpus', bez: 'Maße und Material nach Absprache.',
      kalkTyp: 'detail', menge: 1, einheit: 'Stk',
      materialKosten: 380, lohnStd: 8, lohnSatz: 0, gkProzent: 0.30, fremdleistung: 0,
      ep: 0, std: 0, mat: 0, aufschlag: 0.3,
    },
    {
      id: 2, kat: 'Montage', titel: 'Lieferung & Montage', bez: 'Fachgerechte Montage inkl. An-/Abfahrt.',
      kalkTyp: 'detail', menge: 1, einheit: 'Stk',
      materialKosten: 0, lohnStd: 8, lohnSatz: 0, gkProzent: 0.30, fremdleistung: 50,
      ep: 0, std: 0, mat: 0, aufschlag: 0,
    },
  ])
  const [globalStd, setGlobalStd] = useState(65)
  const [docNr, setDocNr] = useState('AB-264')
  const [docTyp, setDocTyp] = useState('Auftragsbestätigung')
  const [anschr, setAnschr] = useState('herzlichen Dank für Ihren Auftrag, den wir hiermit gerne bestätigen:')
  const [widerruf, setWiderruf] = useState(true)
  const [pdfHTML, setPdfHTML] = useState('')

  // Start Screen State
  const [startText, setStartText] = useState('')
  const [startBild, setStartBild] = useState<string | null>(null)
  const [startBildB64, setStartBildB64] = useState<string | null>(null)
  const [startStatus, setStartStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [startMsg, setStartMsg] = useState('')

  // Mikrofon State
  const [micStatus, setMicStatus] = useState<'idle' | 'recording' | 'transcribing'>('idle')
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const wakeLockRef = useRef<{ release: () => Promise<void> } | null>(null)

  const startFileRef = useRef<HTMLInputElement>(null)

  const updK = (f: keyof Kunde, v: string) => setKunde(prev => ({ ...prev, [f]: v }))
  const updPos = (id: number, f: keyof Position, v: unknown) =>
    setPos(prev => prev.map(p => p.id === id ? { ...p, [f]: v } : p))
  const addPos = () => setPos(prev => [...prev, defaultPos(Date.now())])
  const delPos = (id: number) => setPos(prev => prev.filter(p => p.id !== id))

  const totals = pos.reduce((a, p) => ({ net: a.net + calcPos(p, globalStd).gesamt }), { net: 0 })
  const vat = totals.net * 0.19
  const gross = totals.net + vat

  // ── Bild komprimieren (Canvas, max 1024px, JPEG 60%) ──
  const compressImage = useCallback((file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image()
      const url = URL.createObjectURL(file)
      img.onload = () => {
        const maxW = 1024
        let w = img.width, h = img.height
        if (w > maxW) { h = Math.round(h * maxW / w); w = maxW }
        const canvas = document.createElement('canvas')
        canvas.width = w; canvas.height = h
        canvas.getContext('2d')!.drawImage(img, 0, 0, w, h)
        resolve(canvas.toDataURL('image/jpeg', 0.6).split(',')[1])
        URL.revokeObjectURL(url)
      }
      img.onerror = reject
      img.src = url
    })
  }, [])

  const loadBild = useCallback(async (file: File) => {
    setStartBild(URL.createObjectURL(file))
    try {
      setStartBildB64(await compressImage(file))
    } catch {
      const reader = new FileReader()
      reader.onload = ev => setStartBildB64((ev.target?.result as string).split(',')[1])
      reader.readAsDataURL(file)
    }
  }, [compressImage])

  // ── Mikrofon Aufnahme ────────────────────────────────
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4'
      const mr = new MediaRecorder(stream, { mimeType })
      audioChunksRef.current = []
      mr.ondataavailable = e => { if (e.data.size > 0) audioChunksRef.current.push(e.data) }
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        wakeLockRef.current?.release().catch(() => {})
        wakeLockRef.current = null
        setMicStatus('transcribing')
        try {
          const ext = mimeType.includes('webm') ? 'webm' : 'mp4'
          const blob = new Blob(audioChunksRef.current, { type: mimeType })
          const fd = new FormData()
          fd.append('audio', blob, `audio.${ext}`)
          const res = await fetch('/api/transcribe', { method: 'POST', body: fd })
          const json = await res.json()
          if (json.success && json.text) {
            setStartText(prev => prev ? prev + ' ' + json.text : json.text)
          } else {
            console.error('Transkription Fehler:', json.error)
          }
        } catch (e) {
          console.error('Transkription fehlgeschlagen:', e)
        }
        setMicStatus('idle')
      }
      mr.start()
      mediaRecorderRef.current = mr
      setMicStatus('recording')
      // Wake Lock: Bildschirm während Aufnahme nicht ausschalten
      try {
        const nav = navigator as { wakeLock?: { request: (t: string) => Promise<{ release: () => Promise<void> }> } }
        if (nav.wakeLock) wakeLockRef.current = await nav.wakeLock.request('screen')
      } catch { /* nicht unterstützt oder verweigert – ignorieren */ }
    } catch {
      alert('Mikrofon nicht verfügbar. Bitte Zugriff erlauben.')
    }
  }, [])

  // Wake Lock nach App-Hintergrund wiederherstellen wenn Aufnahme noch läuft
  useEffect(() => {
    const handleVisibility = async () => {
      if (document.visibilityState === 'visible' && micStatus === 'recording') {
        try {
          const nav = navigator as { wakeLock?: { request: (t: string) => Promise<{ release: () => Promise<void> }> } }
          if (nav.wakeLock) wakeLockRef.current = await nav.wakeLock.request('screen')
        } catch { /* ignorieren */ }
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [micStatus])

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop()
    setMicStatus('transcribing')
  }, [])

  const toggleRecording = useCallback(() => {
    if (micStatus === 'recording') stopRecording()
    else if (micStatus === 'idle') startRecording()
  }, [micStatus, startRecording, stopRecording])

  // ── KI Analyse ─────────────────────────────────────
  const callAI = useCallback(async (text: string, imageB64: string | null) => {
    const res = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, imageBase64: imageB64 }),
    })
    if (!res.ok) throw new Error(`API Fehler: ${res.status}`)
    const json = await res.json()
    if (!json.success) throw new Error(json.error || 'Unbekannter Fehler')
    return json.data
  }, [])

  const startAnalyse = useCallback(async () => {
    if (!startText.trim() && !startBildB64) return
    setStartStatus('loading')
    setStartMsg('')
    try {
      const data = await callAI(startText, startBildB64)
      if (data.kunde) {
        setKunde({
          name: data.kunde.name || '',
          zusatz: data.kunde.zusatz || '',
          strasse: data.kunde.strasse || '',
          ort: data.kunde.ort || '',
          projekt: data.kunde.projekt || '',
        })
      }
      if (data.positionen?.length > 0) {
        setPos(data.positionen.map((p: Partial<Position>, i: number) => ({
          id: Date.now() + i,
          kat: p.kat || 'Sonstiges',
          titel: p.titel || 'Position',
          bez: p.bez || '',
          kalkTyp: p.kalkTyp || 'detail',
          menge: p.menge ?? 1,
          einheit: p.einheit || 'Stk',
          materialKosten: (p as Record<string, unknown>).materialKosten as number ?? 0,
          lohnStd: (p as Record<string, unknown>).lohnStd as number ?? 0,
          lohnSatz: (p as Record<string, unknown>).lohnSatz as number ?? 0,
          gkProzent: (p as Record<string, unknown>).gkProzent as number ?? 0.30,
          fremdleistung: (p as Record<string, unknown>).fremdleistung as number ?? 0,
          ep: p.ep ?? 0,
          std: 0, mat: 0, aufschlag: 0.3,
        })))
      }
      if (data.anschreiben) setAnschr(data.anschreiben)
      setStartStatus('idle')
      setScreen('app')
      setTab('kunde')
    } catch (e: unknown) {
      setStartStatus('error')
      setStartMsg(`Fehler: ${e instanceof Error ? e.message : 'Unbekannt'}`)
    }
  }, [startText, startBildB64, callAI])

  /* ══════════════════════════════════════════════════
     SCREEN: PDF
  ══════════════════════════════════════════════════ */
  if (screen === 'pdf') {
    return (
      <div style={{ fontFamily: 'Helvetica Neue,sans-serif', background: C.black, minHeight: '100vh' }}>
        <div style={{ background: C.darkbg, padding: '13px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `2px solid ${C.copper}` }}>
          <div style={{ color: C.copper, fontSize: 14, fontWeight: 700, letterSpacing: 2 }}>PDF VORSCHAU</div>
          <button onClick={() => setScreen('app')} style={{ background: 'transparent', color: C.copper, border: `1px solid ${C.copper}`, borderRadius: 3, padding: '6px 16px', cursor: 'pointer', fontSize: 12, fontFamily: 'Helvetica Neue,sans-serif' }}>← Zurück</button>
        </div>
        <div style={{ padding: 14, maxWidth: 760, margin: '0 auto' }}>
          <div style={{ background: '#1a2a1a', border: '1px solid #3a6a3a', borderRadius: 4, padding: '12px 16px', marginBottom: 14, fontSize: 13, color: '#90EE90' }}>
            💡 PDF speichern: Teilen-Symbol → &quot;Als PDF sichern&quot;
          </div>
          <div style={{ background: '#fff', borderRadius: 4, overflow: 'hidden', boxShadow: '0 4px 24px rgba(0,0,0,.5)' }}
            dangerouslySetInnerHTML={{ __html: pdfHTML.replace(/<script[\s\S]*?<\/script>/gi, '') }} />
        </div>
      </div>
    )
  }

  /* ══════════════════════════════════════════════════
     SCREEN: START
  ══════════════════════════════════════════════════ */
  if (screen === 'start') {
    const canGenerate = !!(startText.trim() || startBildB64)
    const loading = startStatus === 'loading'
    const isRecording = micStatus === 'recording'
    const isTranscribing = micStatus === 'transcribing'

    return (
      <div style={{ fontFamily: 'Helvetica Neue,Helvetica,Arial,sans-serif', background: C.black, minHeight: '100vh', color: C.white }}>
        <style>{`
          @keyframes cfpulse {
            0%, 100% { transform: scale(1); opacity: 0.5; }
            50% { transform: scale(1.18); opacity: 0.15; }
          }
          @keyframes cfspin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>

        {/* Header */}
        <div style={{ background: C.darkbg, padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `2px solid ${C.copper}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <LogoMark size={38} />
            <div>
              <div style={{ color: C.copper, fontSize: 17, fontWeight: 800, letterSpacing: 3 }}>CRAFTFLOW</div>
              <div style={{ color: C.textMid, fontSize: 9, letterSpacing: 2 }}>FS CRAFTED</div>
            </div>
          </div>
          <div style={{ color: C.textMid, fontSize: 12 }}>{today()}</div>
        </div>

        <div style={{ padding: '0 16px 40px', maxWidth: 500, margin: '0 auto', boxSizing: 'border-box' }}>

          {/* Großer Mic-Button – dominantes Element */}
          <div style={{ textAlign: 'center', padding: '44px 0 32px' }}>
            <div style={{ color: C.textMid, fontSize: 13, marginBottom: 36, lineHeight: 1.6 }}>
              Beschreibe Kunde und Projekt –<br />ich erstelle die Kalkulation automatisch.
            </div>

            {/* Puls-Ring + Button */}
            <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
              {isRecording && (
                <>
                  <div style={{ position: 'absolute', width: 160, height: 160, borderRadius: '50%', border: '2px solid #cc2222', animation: 'cfpulse 1.4s ease-in-out infinite', pointerEvents: 'none' }} />
                  <div style={{ position: 'absolute', width: 140, height: 140, borderRadius: '50%', border: '2px solid #cc222244', animation: 'cfpulse 1.4s ease-in-out infinite 0.3s', pointerEvents: 'none' }} />
                </>
              )}
              <button
                onClick={toggleRecording}
                disabled={isTranscribing || loading}
                style={{
                  width: 120, height: 120, borderRadius: '50%',
                  background: isRecording ? '#cc2222' : isTranscribing ? C.gray2 : C.copper,
                  border: 'none',
                  cursor: (isTranscribing || loading) ? 'wait' : 'pointer',
                  fontSize: 52,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: isRecording
                    ? '0 0 0 6px rgba(204,34,34,0.2), 0 6px 32px rgba(0,0,0,.5)'
                    : '0 6px 32px rgba(0,0,0,.4)',
                  transition: 'background 0.2s ease, box-shadow 0.2s ease',
                  flexShrink: 0,
                }}
              >
                {isTranscribing ? '⟳' : '🎤'}
              </button>
            </div>

            <div style={{
              marginTop: 18, fontSize: 13, fontWeight: isRecording ? 700 : 400,
              color: isRecording ? '#ff6666' : isTranscribing ? C.copper : C.textMid,
              letterSpacing: isRecording ? 1 : 0,
            }}>
              {micStatus === 'idle' && 'Tippen zum Aufnehmen'}
              {micStatus === 'recording' && '● Aufnahme läuft – erneut tippen zum Stoppen'}
              {micStatus === 'transcribing' && 'Wird transkribiert…'}
            </div>
          </div>

          {/* Foto-Button */}
          <div style={{ marginBottom: 14 }}>
            <input
              ref={startFileRef}
              type="file" accept="image/*"
              onChange={e => { const f = e.target.files?.[0]; if (f) loadBild(f) }}
              style={{ display: 'none' }}
            />
            <button
              onClick={() => startFileRef.current?.click()}
              style={{
                width: '100%', padding: '16px',
                background: startBild ? `${C.copper}18` : C.gray1,
                border: `2px dashed ${startBild ? C.copper : C.border}`,
                borderRadius: 10, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              }}
            >
              <span style={{ fontSize: 28 }}>{startBild ? '✓' : '📷'}</span>
              <span style={{ color: startBild ? C.copper : C.textMid, fontSize: 13, fontFamily: 'Helvetica Neue,sans-serif' }}>
                {startBild ? 'Foto vorhanden – neues aufnehmen' : 'Situationsfoto aufnehmen oder auswählen'}
              </span>
            </button>
            {startBild && (
              <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 12 }}>
                <img src={startBild} alt="" style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 6, border: `2px solid ${C.copper}` }} />
                <button
                  onClick={() => { setStartBild(null); setStartBildB64(null) }}
                  style={{ background: 'transparent', color: C.textMid, border: `1px solid ${C.border}`, borderRadius: 4, padding: '5px 12px', cursor: 'pointer', fontSize: 11, fontFamily: 'Helvetica Neue,sans-serif' }}
                >
                  × Entfernen
                </button>
              </div>
            )}
          </div>

          {/* Textarea – für manuelle Eingabe oder Korrekturen nach Transkription */}
          <textarea
            value={startText}
            onChange={e => setStartText(e.target.value)}
            placeholder="Oder hier direkt eingeben / Transkription erscheint hier…"
            style={{
              width: '100%', background: C.gray1,
              border: `1px solid ${startText ? C.copper + '66' : C.border}`,
              borderRadius: 10, padding: '14px', fontSize: 14, lineHeight: 1.7,
              color: C.white, fontFamily: 'Helvetica Neue,sans-serif',
              resize: 'none', minHeight: 120, boxSizing: 'border-box', outline: 'none',
            }}
          />

          {/* Generieren Button */}
          <button
            onClick={startAnalyse}
            disabled={!canGenerate || loading}
            style={{
              width: '100%', marginTop: 14,
              background: (!canGenerate || loading) ? C.gray2 : C.copper,
              color: (!canGenerate || loading) ? C.textMid : C.black,
              border: 'none', borderRadius: 10, padding: '18px 0',
              cursor: (!canGenerate || loading) ? 'not-allowed' : 'pointer',
              fontSize: 17, fontFamily: 'Helvetica Neue,sans-serif',
              fontWeight: 800, letterSpacing: 2,
            }}
          >
            {loading ? '⟳ KI erstellt Kalkulation…' : '⚡ KALKULATION GENERIEREN'}
          </button>

          {startStatus === 'error' && startMsg && (
            <div style={{ marginTop: 14, background: '#1a0d0d', border: '1px solid #4a2a2a', borderRadius: 8, padding: '14px 16px', fontSize: 13, color: '#ff9999' }}>
              {startMsg}
            </div>
          )}

          <div style={{ textAlign: 'center', marginTop: 24 }}>
            <button
              onClick={() => { setScreen('app'); setTab('kunde') }}
              style={{ background: 'transparent', color: C.textMid, border: 'none', cursor: 'pointer', fontSize: 12, fontFamily: 'Helvetica Neue,sans-serif', textDecoration: 'underline' }}
            >
              Manuell eingeben
            </button>
          </div>
        </div>
      </div>
    )
  }

  /* ══════════════════════════════════════════════════
     SCREEN: APP (3 Tabs)
  ══════════════════════════════════════════════════ */
  const TABS = [
    { id: 'kunde',      label: '👤 Kunde' },
    { id: 'kalkulation', label: '🔢 Kalkulation' },
    { id: 'angebot',    label: '📄 Angebot' },
  ]

  return (
    <div style={{ fontFamily: 'Helvetica Neue,Helvetica,Arial,sans-serif', background: C.black, minHeight: '100vh', color: C.white }}>

      {/* Header */}
      <div style={{ background: C.darkbg, padding: '13px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `2px solid ${C.copper}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <LogoMark size={34} />
          <div>
            <div style={{ color: C.copper, fontSize: 15, fontWeight: 800, letterSpacing: 3 }}>CRAFTFLOW</div>
            <div style={{ color: C.textMid, fontSize: 9, letterSpacing: 2 }}>FS CRAFTED</div>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ color: C.white, fontSize: 11, fontWeight: 600, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {kunde.name || 'Neues Projekt'}
          </div>
          <div style={{ color: C.textMid, fontSize: 10 }}>{docNr} · {today()}</div>
          <div onClick={() => setScreen('start')} style={{ color: C.textMid, fontSize: 9, cursor: 'pointer', textDecoration: 'underline', marginTop: 2 }}>← Neu</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', background: C.darkbg, borderBottom: `1px solid ${C.border}` }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ flex: 1, padding: '11px 4px', background: tab === t.id ? C.copper : 'transparent', color: tab === t.id ? C.black : C.textMid, border: 'none', cursor: 'pointer', fontSize: 11, fontFamily: 'Helvetica Neue,sans-serif', fontWeight: tab === t.id ? 700 : 400 }}>
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ padding: 14, maxWidth: 760, margin: '0 auto', boxSizing: 'border-box' }}>

        {/* ══ KUNDE ══ */}
        {tab === 'kunde' && (
          <div>
            <Card accent={C.copper}>
              <div style={{ padding: '14px 16px' }}>
                <Lbl>Kundendaten prüfen & bearbeiten</Lbl>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                  {([
                    { f: 'name' as keyof Kunde,    l: 'Kundenname',  p: 'z.B. Familie Müller' },
                    { f: 'projekt' as keyof Kunde, l: 'Bauvorhaben', p: 'z.B. TV-Board' },
                    { f: 'strasse' as keyof Kunde, l: 'Straße',      p: 'z.B. Hauptstr. 12' },
                    { f: 'ort' as keyof Kunde,     l: 'PLZ Ort',     p: 'z.B. 63825 Schöllkrippen' },
                  ] as const).map(({ f, l, p }) => (
                    <div key={f}>
                      <Lbl>{l}</Lbl>
                      <TxtInput value={kunde[f]} onChange={v => updK(f, v)} placeholder={p} />
                    </div>
                  ))}
                </div>
                <div>
                  <Lbl>Ansprechpartner / Zusatz</Lbl>
                  <TxtInput value={kunde.zusatz} onChange={v => updK('zusatz', v)} placeholder="z.B. Thomas Müller" />
                </div>
              </div>
            </Card>

            {kunde.name && (
              <button
                onClick={() => {
                  const neu: KundeDB = { id: Date.now(), ...kunde, typ: 'Privat' }
                  const updated = [...kunden, neu]
                  setKunden(updated); speichereKunden(updated)
                }}
                style={{ width: '100%', background: 'transparent', color: C.copper, border: `1px solid ${C.copper}`, borderRadius: 4, padding: '11px 0', cursor: 'pointer', fontSize: 12, fontFamily: 'Helvetica Neue,sans-serif', marginBottom: 12 }}
              >
                + In Kundendatenbank speichern
              </button>
            )}

            <button
              onClick={() => setTab('kalkulation')}
              style={{ width: '100%', background: C.copper, color: C.black, border: 'none', borderRadius: 4, padding: '15px 0', fontSize: 14, fontFamily: 'Helvetica Neue,sans-serif', fontWeight: 800, letterSpacing: 1, cursor: 'pointer' }}
            >
              → Weiter zur Kalkulation
            </button>
          </div>
        )}

        {/* ══ KALKULATION ══ */}
        {tab === 'kalkulation' && (
          <div>
            {/* Parameter-Leiste */}
            <Card accent={C.copper}>
              <div style={{ padding: '12px 16px' }}>
                <div style={{ display: 'flex', gap: 0, border: `1px solid ${C.border}`, borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ flex: 1, padding: '9px 11px' }}>
                    <Lbl>Stundensatz (€/h)</Lbl>
                    <NumInput value={globalStd} onChange={setGlobalStd} />
                  </div>
                  <div style={{ width: 1, background: C.border }} />
                  <div style={{ flex: 2, padding: '9px 14px', background: C.black, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <Lbl c={C.textMid}>Netto</Lbl>
                      <div style={{ color: C.copper, fontSize: 19, fontWeight: 800 }}>{eur(totals.net)}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <Lbl c={C.textMid}>Brutto</Lbl>
                      <div style={{ color: C.white, fontSize: 15, fontWeight: 700 }}>{eur(gross)}</div>
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            {pos.map(p => {
              const c = calcPos(p, globalStd)
              const col = CAT_COL[p.kat] || C.copper
              const kt = KALK_TYPEN.find(k => k.id === p.kalkTyp) || KALK_TYPEN[0]
              // Zwischenwerte für detail-Modus
              const satz = p.lohnSatz > 0 ? p.lohnSatz : globalStd
              const lohnWert = (p.lohnStd || 0) * satz
              const gkWert = (p.materialKosten + lohnWert) * (p.gkProzent ?? 0.3)

              return (
                <Card key={p.id} accent={col}>
                  <div style={{ padding: '12px 14px' }}>
                    {/* Kopfzeile */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ background: col, color: C.black, fontSize: 8, padding: '2px 8px', borderRadius: 10, display: 'inline-block', fontWeight: 700, marginBottom: 4 }}>{p.kat.toUpperCase()}</span>
                        <input value={p.titel} onChange={e => updPos(p.id, 'titel', e.target.value)}
                          style={{ width: '100%', background: 'transparent', border: 'none', fontSize: 13, fontWeight: 700, color: C.white, fontFamily: 'Helvetica Neue,sans-serif', outline: 'none', display: 'block', marginTop: 2 }} />
                        <textarea value={p.bez} onChange={e => updPos(p.id, 'bez', e.target.value)}
                          rows={2} style={{ width: '100%', background: 'transparent', border: 'none', fontSize: 11, color: C.textMid, resize: 'none', outline: 'none', fontFamily: 'Helvetica Neue,sans-serif', boxSizing: 'border-box' }} />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                        <div style={{ fontSize: 14, fontWeight: 800, color: col }}>{eur(c.gesamt)}</div>
                        <button onClick={() => delPos(p.id)} style={{ background: 'transparent', color: C.textMid, border: `1px solid ${C.border}`, borderRadius: 3, padding: '2px 8px', cursor: 'pointer', fontSize: 10 }}>✕</button>
                      </div>
                    </div>

                    {/* Modus-Auswahl */}
                    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 6 }}>
                      {KALK_TYPEN.map(k => (
                        <button key={k.id} onClick={() => updPos(p.id, 'kalkTyp', k.id)} style={{ padding: '4px 9px', fontSize: 9, fontWeight: 700, background: p.kalkTyp === k.id ? col : C.gray2, color: p.kalkTyp === k.id ? C.black : C.textMid, border: `1px solid ${p.kalkTyp === k.id ? col : C.border}`, borderRadius: 3, cursor: 'pointer', fontFamily: 'Helvetica Neue,sans-serif' }}>
                          {k.icon} {k.label}
                        </button>
                      ))}
                    </div>
                    <div style={{ fontSize: 10, color: C.textMid, marginBottom: 8 }}>{kt.desc}</div>

                    <HR color={C.border} my={8} />

                    {/* ─ Detail-Kalkulation ─ */}
                    {p.kalkTyp === 'detail' && (
                      <div>
                        {/* Menge + Material */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                          <div>
                            <Lbl>Menge</Lbl>
                            <div style={{ display: 'flex', gap: 4 }}>
                              <div style={{ flex: 1 }}>
                                <NumInput value={p.menge} onChange={v => updPos(p.id, 'menge', v)} />
                              </div>
                              <input value={p.einheit} onChange={e => updPos(p.id, 'einheit', e.target.value)}
                                style={{ width: 52, padding: '8px 6px', background: C.black, border: `1px solid ${C.border}`, borderRadius: 3, fontSize: 11, color: C.textMid, fontFamily: 'Helvetica Neue,sans-serif', outline: 'none', textAlign: 'center' }} />
                            </div>
                          </div>
                          <div>
                            <Lbl>Material (€/Stk)</Lbl>
                            <NumInput value={p.materialKosten} onChange={v => updPos(p.id, 'materialKosten', v)} />
                          </div>
                        </div>

                        {/* Arbeit */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
                          <div>
                            <Lbl>Arbeit (Std/Stk)</Lbl>
                            <NumInput value={p.lohnStd} onChange={v => updPos(p.id, 'lohnStd', v)} />
                          </div>
                          <div>
                            <Lbl>× {globalStd} €/h</Lbl>
                            <ReadOnly value={eur(lohnWert)} />
                          </div>
                          <div>
                            <Lbl>GK-Zuschlag (%)</Lbl>
                            <NumInput value={Math.round((p.gkProzent ?? 0.3) * 100)} onChange={v => updPos(p.id, 'gkProzent', v / 100)} />
                          </div>
                        </div>

                        {/* GK + Fremdleistung + Summary */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                          <div>
                            <Lbl>GK-Betrag</Lbl>
                            <ReadOnly value={eur(gkWert)} />
                          </div>
                          <div>
                            <Lbl>Fremdleistung gesamt (€)</Lbl>
                            <NumInput value={p.fremdleistung} onChange={v => updPos(p.id, 'fremdleistung', v)} />
                          </div>
                        </div>

                        {/* Ergebnis-Zeile */}
                        <div style={{ background: C.black, borderRadius: 3, padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <div style={{ fontSize: 9, color: C.textMid, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 2 }}>Netto / Stk</div>
                            <div style={{ color: C.white, fontSize: 12, fontWeight: 700 }}>{eur(c.ep)}</div>
                          </div>
                          {p.menge > 1 && (
                            <div style={{ textAlign: 'center' }}>
                              <div style={{ fontSize: 9, color: C.textMid, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 2 }}>× {p.menge} Stk</div>
                              <div style={{ color: C.textMid, fontSize: 11 }}>{eur(c.ep * p.menge)}</div>
                            </div>
                          )}
                          {p.fremdleistung > 0 && (
                            <div style={{ textAlign: 'center' }}>
                              <div style={{ fontSize: 9, color: C.textMid, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 2 }}>+ Fremd</div>
                              <div style={{ color: C.textMid, fontSize: 11 }}>{eur(p.fremdleistung)}</div>
                            </div>
                          )}
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: 9, color: C.textMid, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 2 }}>Gesamt</div>
                            <div style={{ color: col, fontSize: 15, fontWeight: 800 }}>{eur(c.gesamt)}</div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* ─ Einfache Modi ─ */}
                    {(p.kalkTyp === 'pauschale' || p.kalkTyp === 'qm' || p.kalkTyp === 'lfm') && (
                      <div style={{ display: 'flex', gap: 0, border: `1px solid ${C.border}`, borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ flex: 1, padding: '9px 10px' }}>
                          <Lbl>Menge</Lbl>
                          <NumInput value={p.menge} onChange={v => updPos(p.id, 'menge', v)} />
                          <input value={p.einheit} onChange={e => updPos(p.id, 'einheit', e.target.value)}
                            style={{ width: '100%', marginTop: 4, padding: '3px 7px', background: C.black, border: `1px solid ${C.border}`, borderRadius: 2, fontSize: 10, color: C.textMid, fontFamily: 'Helvetica Neue,sans-serif', outline: 'none', boxSizing: 'border-box' }} />
                        </div>
                        <div style={{ width: 1, background: C.border }} />
                        <div style={{ flex: 2, padding: '9px 10px' }}>
                          <Lbl>{p.kalkTyp === 'pauschale' ? 'Preis gesamt (€)' : p.kalkTyp === 'qm' ? 'Preis/m² (€)' : 'Preis/lfd.m (€)'}</Lbl>
                          <NumInput value={p.ep} onChange={v => updPos(p.id, 'ep', v)} />
                        </div>
                        <div style={{ width: 1, background: C.border }} />
                        <div style={{ flex: 1, padding: '9px 10px', background: C.black, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                          <Lbl c={C.textMid}>Gesamt</Lbl>
                          <div style={{ color: col, fontSize: 13, fontWeight: 800 }}>{eur(c.gesamt)}</div>
                        </div>
                      </div>
                    )}

                    {/* ─ Stunden-Modus (legacy) ─ */}
                    {p.kalkTyp === 'stunden' && (
                      <div style={{ display: 'flex', gap: 0, border: `1px solid ${C.border}`, borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ flex: 1, padding: '9px 10px' }}>
                          <Lbl>Menge</Lbl>
                          <NumInput value={p.menge} onChange={v => updPos(p.id, 'menge', v)} />
                        </div>
                        <div style={{ width: 1, background: C.border }} />
                        <div style={{ flex: 1, padding: '9px 10px' }}>
                          <Lbl>Std/Einh.</Lbl>
                          <NumInput value={p.std} onChange={v => updPos(p.id, 'std', v)} />
                        </div>
                        <div style={{ width: 1, background: C.border }} />
                        <div style={{ flex: 1, padding: '9px 10px' }}>
                          <Lbl>Mat.(€)</Lbl>
                          <NumInput value={p.mat} onChange={v => updPos(p.id, 'mat', v)} />
                        </div>
                        <div style={{ width: 1, background: C.border }} />
                        <div style={{ flex: 1, padding: '9px 10px', background: C.black, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                          <Lbl c={C.textMid}>Gesamt</Lbl>
                          <div style={{ color: col, fontSize: 13, fontWeight: 800 }}>{eur(c.gesamt)}</div>
                        </div>
                      </div>
                    )}
                  </div>
                </Card>
              )
            })}

            <button onClick={addPos} style={{ width: '100%', background: 'transparent', color: C.textMid, border: `1px dashed ${C.border}`, borderRadius: 4, padding: '11px 0', cursor: 'pointer', fontSize: 12, fontFamily: 'Helvetica Neue,sans-serif', marginBottom: 12 }}>
              + Position hinzufügen
            </button>

            {/* Gesamtübersicht */}
            <div style={{ background: C.darkbg, borderRadius: 4, border: `1px solid ${C.copper}44`, overflow: 'hidden', marginBottom: 12 }}>
              <div style={{ display: 'flex' }}>
                {[{ l: 'Positionen', v: `${pos.length}` }, { l: 'Netto', v: eur(totals.net) }, { l: 'MwSt.', v: eur(vat) }, { l: 'Brutto', v: eur(gross) }].map(({ l, v }, i) => (
                  <div key={l} style={{ flex: 1, display: 'flex', flexDirection: 'column', borderLeft: i > 0 ? `1px solid ${C.border}` : undefined }}>
                    <div style={{ padding: '11px 6px', textAlign: 'center' }}>
                      <div style={{ color: C.textMid, fontSize: 8, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 3 }}>{l}</div>
                      <div style={{ color: C.copper, fontSize: 11, fontWeight: 800 }}>{v}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <button onClick={() => setTab('angebot')} style={{ width: '100%', background: C.copper, color: C.black, border: 'none', borderRadius: 4, padding: '15px 0', fontSize: 14, fontFamily: 'Helvetica Neue,sans-serif', fontWeight: 800, letterSpacing: 1, cursor: 'pointer' }}>
              → Weiter zum Angebot
            </button>
          </div>
        )}

        {/* ══ ANGEBOT ══ */}
        {tab === 'angebot' && (
          <div>
            <Card accent={C.copper}>
              <div style={{ padding: '12px 16px' }}>
                <Lbl>Dokumenttyp & Nummer</Lbl>
                <div style={{ display: 'flex', gap: 0, border: `1px solid ${C.border}`, borderRadius: 3, overflow: 'hidden', marginBottom: 10 }}>
                  {['Angebot', 'Auftragsbestätigung', 'Rechnung'].map(t => (
                    <button key={t} onClick={() => setDocTyp(t)} style={{ flex: 1, padding: '8px 2px', fontSize: 10, background: docTyp === t ? C.copper : C.gray2, color: docTyp === t ? C.black : C.textMid, border: 'none', cursor: 'pointer', fontFamily: 'Helvetica Neue,sans-serif', fontWeight: docTyp === t ? 700 : 400 }}>{t}</button>
                  ))}
                </div>
                <TxtInput value={docNr} onChange={setDocNr} />
              </div>
            </Card>

            <Card>
              <div style={{ padding: '12px 16px' }}>
                <Lbl>Empfänger</Lbl>
                <div style={{ background: C.black, borderRadius: 3, padding: '10px 12px', border: `1px solid ${C.border}` }}>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{kunde.name || '–'}</div>
                  <div style={{ color: C.textMid, fontSize: 11, marginTop: 2 }}>{kunde.strasse} · {kunde.ort}</div>
                  <div style={{ color: C.copper, fontSize: 11, marginTop: 2 }}>{kunde.projekt}</div>
                </div>
              </div>
            </Card>

            <Card>
              <div style={{ padding: '12px 16px' }}>
                <Lbl>Anschreiben</Lbl>
                <textarea value={anschr} onChange={e => setAnschr(e.target.value)}
                  style={{ width: '100%', background: C.gray2, border: `1px solid ${C.border}`, borderRadius: 3, padding: 10, fontSize: 12, lineHeight: 1.7, color: C.white, fontFamily: 'Helvetica Neue,sans-serif', resize: 'vertical', minHeight: 70, boxSizing: 'border-box', outline: 'none' }} />
              </div>
            </Card>

            <Card>
              <div style={{ padding: '12px 16px' }}>
                <Lbl>Leistungsübersicht</Lbl>
                {pos.map((p, i) => {
                  const c = calcPos(p, globalStd)
                  const col = CAT_COL[p.kat] || C.copper
                  return (
                    <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: i < pos.length - 1 ? `1px solid ${C.border}` : 'none', gap: 8, alignItems: 'flex-start' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, lineHeight: 1.2 }}>{p.titel}</div>
                        <div style={{ fontSize: 10, color: C.textMid, marginTop: 2 }}>{p.menge} {p.einheit}</div>
                      </div>
                      <div style={{ fontWeight: 800, fontSize: 12, color: col, flexShrink: 0 }}>{eur(c.gesamt)}</div>
                    </div>
                  )
                })}
                <HR my={10} />
                {[
                  { l: 'Nettobetrag', v: eur(totals.net), b: false },
                  { l: 'zzgl. 19% MwSt.', v: eur(vat), b: false },
                  { l: 'Gesamtsumme', v: eur(gross), b: true },
                ].map(({ l, v, b }) => (
                  <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: b ? '7px 0' : '4px 0', borderTop: b ? `2px solid ${C.copper}` : undefined, borderBottom: b ? `2px solid ${C.copper}` : undefined, marginTop: b ? 3 : 0, fontSize: b ? 14 : 12, fontWeight: b ? 800 : 400, color: b ? C.copper : C.white }}>
                    <span>{l}</span><span>{v}</span>
                  </div>
                ))}
              </div>
            </Card>

            <Card>
              <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }} onClick={() => setWiderruf(!widerruf)}>
                <div style={{ width: 20, height: 20, border: `2px solid ${C.copper}`, borderRadius: 3, background: widerruf ? C.copper : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: C.black, fontWeight: 800, flexShrink: 0 }}>
                  {widerruf ? '✓' : ''}
                </div>
                <span style={{ fontSize: 12 }}>Widerrufsbelehrung einfügen</span>
              </div>
            </Card>

            <button onClick={() => {
              setPdfHTML(buildPDF(pos, globalStd, kunde, docNr, docTyp, anschr, widerruf))
              setScreen('pdf')
            }} style={{ width: '100%', background: C.copper, color: C.black, border: 'none', padding: '14px 0', borderRadius: 3, fontSize: 13, fontFamily: 'Helvetica Neue,sans-serif', fontWeight: 800, letterSpacing: 2, cursor: 'pointer' }}>
              ▶ DOKUMENT ALS PDF ANZEIGEN
            </button>
          </div>
        )}

      </div>
    </div>
  )
}
