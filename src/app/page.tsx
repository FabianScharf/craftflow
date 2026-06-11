'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import NoSleep from 'nosleep.js'
import {
  C,
  calcAngebotspos, eur, today, inDays,
  ladeKunden, speichereKunden,
  DEFAULT_STUNDENSAETZE, KOSTENSTELLEN_LABELS,
  type Kunde, type KundeDB,
  type Angebotsposition, type MaterialPosten, type ArbeitsPosten, type KostenstelleId,
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
  <img src="/logo.png" alt="FS Crafted" style={{ height: size, width: 'auto' }} />
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
const defaultAngebotspos = (id: number): Angebotsposition => ({
  id, titel: 'Neue Position', beschreibung: '', material: [], arbeitszeit: [],
})

/* ── Haupt-Komponente ─────────────────────────────── */
export default function CraftFlow() {
  const [screen, setScreen] = useState<'start' | 'app' | 'pdf'>('start')
  const [kunden, setKunden] = useState<KundeDB[]>(ladeKunden)
  const [kunde, setKunde] = useState<Kunde>({ name: '', zusatz: '', strasse: '', ort: '', projekt: '' })

  const [tab, setTab] = useState('kunde')
  const [pos, setPos] = useState<Angebotsposition[]>([
    {
      id: 1, titel: 'Einbauschrank Korpus', beschreibung: 'Maße und Material nach Absprache.',
      material: [
        { id: 10, bezeichnung: 'Spanplatte beschichtet 18mm', menge: 10, einheit: 'm²', ekPreis: 20, aufschlag: 0.3 },
      ],
      arbeitszeit: [
        { id: 11, kostenstelle: '03_06_Zusammenbau', minuten: 480, vkStunde: 65 },
        { id: 12, kostenstelle: '05_01_Montage', minuten: 60, vkStunde: 65 },
      ],
    },
    {
      id: 2, titel: 'Lieferung & Montage', beschreibung: 'Fachgerechte Montage inkl. An-/Abfahrt.',
      material: [],
      arbeitszeit: [
        { id: 21, kostenstelle: '05_01_Montage', minuten: 300, vkStunde: 65 },
        { id: 22, kostenstelle: '06_01_Lieferung', minuten: 120, vkStunde: 65 },
      ],
    },
  ])
  const [docNr, setDocNr] = useState('AB-264')
  const [docTyp, setDocTyp] = useState('Auftragsbestätigung')
  const [anschr, setAnschr] = useState('herzlichen Dank für Ihren Auftrag, den wir hiermit gerne bestätigen:')
  const [widerruf, setWiderruf] = useState(true)
  const [pdfHTML, setPdfHTML] = useState('')

  // Start Screen State
  const [startText, setStartText] = useState('')
  const [startBild, setStartBild] = useState<string | null>(null)
  const [startBildB64, setStartBildB64] = useState<string | null>(null)
  const [startStatus, setStartStatus] = useState<'idle' | 'loading' | 'error' | 'fragen'>('idle')
  const [startMsg, setStartMsg] = useState('')

  // Mikrofon State
  const [micStatus, setMicStatus] = useState<'idle' | 'recording' | 'transcribing'>('idle')
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const noSleepRef = useRef<NoSleep | null>(null)

  const startFileRef = useRef<HTMLInputElement>(null)

  const updK = (f: keyof Kunde, v: string) => setKunde(prev => ({ ...prev, [f]: v }))
  const updPosF = (id: number, f: 'titel' | 'beschreibung', v: string) =>
    setPos(prev => prev.map(p => p.id === id ? { ...p, [f]: v } as Angebotsposition : p))
  const addPos = () => setPos(prev => [...prev, defaultAngebotspos(Date.now())])
  const delPos = (id: number) => setPos(prev => prev.filter(p => p.id !== id))

  const updMatRow = (posId: number, rowId: number, f: keyof MaterialPosten, v: unknown) =>
    setPos(prev => prev.map(p => p.id === posId
      ? { ...p, material: p.material.map(m => m.id === rowId ? { ...m, [f]: v } as MaterialPosten : m) }
      : p))
  const addMatRow = (posId: number) =>
    setPos(prev => prev.map(p => p.id === posId
      ? { ...p, material: [...p.material, { id: Date.now(), bezeichnung: '', menge: 1, einheit: 'Stk', ekPreis: 0, aufschlag: 0.3 }] }
      : p))
  const delMatRow = (posId: number, rowId: number) =>
    setPos(prev => prev.map(p => p.id === posId
      ? { ...p, material: p.material.filter(m => m.id !== rowId) }
      : p))

  const updArbRow = (posId: number, rowId: number, f: keyof ArbeitsPosten, v: unknown) =>
    setPos(prev => prev.map(p => p.id === posId
      ? { ...p, arbeitszeit: p.arbeitszeit.map(a => a.id === rowId ? { ...a, [f]: v } as ArbeitsPosten : a) }
      : p))
  const addArbRow = (posId: number) =>
    setPos(prev => prev.map(p => p.id === posId
      ? { ...p, arbeitszeit: [...p.arbeitszeit, { id: Date.now(), kostenstelle: '03_06_Zusammenbau' as KostenstelleId, minuten: 60, vkStunde: DEFAULT_STUNDENSAETZE['03_06_Zusammenbau'] }] }
      : p))
  const delArbRow = (posId: number, rowId: number) =>
    setPos(prev => prev.map(p => p.id === posId
      ? { ...p, arbeitszeit: p.arbeitszeit.filter(a => a.id !== rowId) }
      : p))

  const totals = pos.reduce((a, p) => ({ net: a.net + calcAngebotspos(p) }), { net: 0 })
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
        noSleepRef.current?.disable()
        noSleepRef.current = null
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
      // Screen-on: Wake Lock API (modern) + iOS Safari Video-Fallback (via NoSleep.js)
      try {
        if (!noSleepRef.current) noSleepRef.current = new NoSleep()
        await noSleepRef.current.enable()
      } catch { /* ignorieren */ }
    } catch {
      alert('Mikrofon nicht verfügbar. Bitte Zugriff erlauben.')
    }
  }, [])


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

      // KI fragt nach fehlenden Pflichtangaben
      if (data.fragen?.length > 0) {
        setStartStatus('fragen')
        setStartMsg((data.fragen as string[]).join('\n'))
        return
      }

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
        type AIMatRow = { bezeichnung?: string; menge?: number; einheit?: string; ekPreis?: number; aufschlag?: number }
        type AIArbRow = { kostenstelle?: string; minuten?: number; vkStunde?: number }
        setPos(data.positionen.map((p: Record<string, unknown>, i: number) => ({
          id: Date.now() + i,
          titel: (p.titel as string) || 'Position',
          beschreibung: (p.beschreibung as string) || '',
          material: ((p.material as AIMatRow[]) || []).map((m, mi) => ({
            id: Date.now() + i * 100 + mi,
            bezeichnung: m.bezeichnung || '',
            menge: m.menge || 1,
            einheit: m.einheit || 'Stk',
            ekPreis: m.ekPreis || 0,
            aufschlag: m.aufschlag ?? 0.3,
          })),
          arbeitszeit: ((p.arbeitszeit as AIArbRow[]) || []).map((a, ai) => ({
            id: Date.now() + i * 100 + 50 + ai,
            kostenstelle: (a.kostenstelle as KostenstelleId) || '03_06_Zusammenbau',
            minuten: a.minuten || 60,
            vkStunde: a.vkStunde || DEFAULT_STUNDENSAETZE['03_06_Zusammenbau'],
          })),
        })))
      }

      if (data.anschreiben) setAnschr(data.anschreiben)

      // Dokumenttyp aus Diktat-Text erkennen
      if (startText) {
        const t = startText.toLowerCase()
        if (t.includes('rechnung')) {
          setDocTyp('Rechnung')
          setDocNr(prev => 'RE-' + prev.replace(/^[A-Z]+-/, ''))
        } else if (t.includes('angebot')) {
          setDocTyp('Angebot')
          setDocNr(prev => 'AN-' + prev.replace(/^[A-Z]+-/, ''))
        }
        // 'auftragsbestätigung' bleibt als Default
      }

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
          <div style={{ textAlign: 'right' }}>
            <div style={{ color: C.textMid, fontSize: 12 }}>{today()}</div>
            <div style={{ color: C.textMid, fontSize: 9 }}>v{process.env.NEXT_PUBLIC_VERSION}</div>
          </div>
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

          {startStatus === 'fragen' && startMsg && (
            <div style={{ marginTop: 14, background: '#0d1520', border: `1px solid ${C.copper}55`, borderRadius: 8, padding: '14px 16px', fontSize: 13, color: C.white }}>
              <div style={{ color: C.copper, fontWeight: 700, marginBottom: 10, fontSize: 12, letterSpacing: 1 }}>
                FEHLENDE ANGABEN – bitte im Text ergänzen:
              </div>
              {startMsg.split('\n').map((q, i) => (
                <div key={i} style={{ marginBottom: 6, lineHeight: 1.5 }}>• {q}</div>
              ))}
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
          <div style={{ color: C.textMid, fontSize: 9 }}>v{process.env.NEXT_PUBLIC_VERSION}</div>
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
            {/* Gesamtübersicht oben */}
            <div style={{ background: C.darkbg, borderRadius: 4, border: `1px solid ${C.copper}44`, overflow: 'hidden', marginBottom: 14 }}>
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

            {pos.map(p => {
              const gesamt = calcAngebotspos(p)
              const matTotal = p.material.reduce((s, m) => s + m.menge * m.ekPreis * (1 + m.aufschlag), 0)
              const arbTotal = p.arbeitszeit.reduce((s, a) => s + (a.minuten / 60) * a.vkStunde, 0)

              const cellInput: React.CSSProperties = {
                width: '100%', padding: '4px 6px', background: C.gray2,
                border: `1px solid ${C.border}`, borderRadius: 2,
                fontSize: 11, color: C.white, fontFamily: 'Helvetica Neue,sans-serif',
                outline: 'none', boxSizing: 'border-box',
              }
              const thStyle: React.CSSProperties = {
                fontSize: 8, letterSpacing: 1.5, textTransform: 'uppercase',
                color: C.textMid, padding: '4px 4px 6px', textAlign: 'left',
                whiteSpace: 'nowrap', fontWeight: 600,
              }
              const tdStyle: React.CSSProperties = { padding: '2px 3px', verticalAlign: 'middle' }

              return (
                <Card key={p.id} accent={C.copper}>
                  <div style={{ padding: '12px 14px' }}>

                    {/* Kopfzeile */}
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
                      <input
                        value={p.titel}
                        onChange={e => updPosF(p.id, 'titel', e.target.value)}
                        style={{ flex: 1, background: 'transparent', border: 'none', fontSize: 14, fontWeight: 700, color: C.white, fontFamily: 'Helvetica Neue,sans-serif', outline: 'none', minWidth: 0 }}
                      />
                      <div style={{ fontWeight: 800, fontSize: 14, color: C.copper, whiteSpace: 'nowrap' }}>{eur(gesamt)}</div>
                      <button onClick={() => delPos(p.id)} style={{ background: 'transparent', color: C.textMid, border: `1px solid ${C.border}`, borderRadius: 3, padding: '3px 8px', cursor: 'pointer', fontSize: 11 }}>✕</button>
                    </div>

                    {/* Kundentext */}
                    <div style={{ marginBottom: 12 }}>
                      <Lbl>Kundentext (sichtbar im Angebot)</Lbl>
                      <textarea
                        value={p.beschreibung}
                        onChange={e => updPosF(p.id, 'beschreibung', e.target.value)}
                        rows={2}
                        style={{ width: '100%', background: C.gray2, border: `1px solid ${C.border}`, borderRadius: 3, padding: '8px 10px', fontSize: 12, lineHeight: 1.6, color: C.white, fontFamily: 'Helvetica Neue,sans-serif', resize: 'vertical', boxSizing: 'border-box', outline: 'none' }}
                      />
                    </div>

                    <HR my={8} />

                    <div style={{ fontSize: 8, letterSpacing: 2, textTransform: 'uppercase', color: C.textMid, marginBottom: 10 }}>
                      Interne Kalkulation – nicht sichtbar für Kunden
                    </div>

                    {/* MATERIAL */}
                    <div style={{ marginBottom: 14 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                        <Lbl>Material</Lbl>
                        {matTotal > 0 && <div style={{ fontSize: 10, color: C.textMid }}>{eur(matTotal)}</div>}
                      </div>
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 480 }}>
                          <thead>
                            <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                              <th style={{ ...thStyle, width: '35%' }}>Bezeichnung</th>
                              <th style={{ ...thStyle, width: '9%' }}>Menge</th>
                              <th style={{ ...thStyle, width: '9%' }}>Einheit</th>
                              <th style={{ ...thStyle, width: '11%' }}>EK €</th>
                              <th style={{ ...thStyle, width: '10%' }}>Aufschl.%</th>
                              <th style={{ ...thStyle, width: '16%', textAlign: 'right' }}>VK gesamt</th>
                              <th style={{ ...thStyle, width: '10%' }}></th>
                            </tr>
                          </thead>
                          <tbody>
                            {p.material.map(m => (
                              <tr key={m.id} style={{ borderBottom: `1px solid ${C.border}22` }}>
                                <td style={tdStyle}>
                                  <input value={m.bezeichnung} onChange={e => updMatRow(p.id, m.id, 'bezeichnung', e.target.value)} style={cellInput} />
                                </td>
                                <td style={tdStyle}>
                                  <input type="number" step="0.1" value={m.menge} onChange={e => updMatRow(p.id, m.id, 'menge', parseFloat(e.target.value) || 0)} style={{ ...cellInput, minWidth: 48 }} />
                                </td>
                                <td style={tdStyle}>
                                  <input value={m.einheit} onChange={e => updMatRow(p.id, m.id, 'einheit', e.target.value)} style={{ ...cellInput, minWidth: 38 }} />
                                </td>
                                <td style={tdStyle}>
                                  <input type="number" step="0.01" value={m.ekPreis} onChange={e => updMatRow(p.id, m.id, 'ekPreis', parseFloat(e.target.value) || 0)} style={{ ...cellInput, minWidth: 52 }} />
                                </td>
                                <td style={tdStyle}>
                                  <input type="number" step="1" value={Math.round(m.aufschlag * 100)} onChange={e => updMatRow(p.id, m.id, 'aufschlag', (parseFloat(e.target.value) || 0) / 100)} style={{ ...cellInput, minWidth: 44 }} />
                                </td>
                                <td style={{ ...tdStyle, textAlign: 'right', fontSize: 11, fontWeight: 600, color: C.white, whiteSpace: 'nowrap' }}>
                                  {eur(m.menge * m.ekPreis * (1 + m.aufschlag))}
                                </td>
                                <td style={tdStyle}>
                                  <button onClick={() => delMatRow(p.id, m.id)} style={{ background: 'transparent', color: C.textMid, border: `1px solid ${C.border}`, borderRadius: 2, padding: '3px 7px', cursor: 'pointer', fontSize: 10 }}>×</button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <button onClick={() => addMatRow(p.id)} style={{ marginTop: 6, background: 'transparent', color: C.textMid, border: `1px dashed ${C.border}`, borderRadius: 3, padding: '5px 12px', cursor: 'pointer', fontSize: 11, fontFamily: 'Helvetica Neue,sans-serif' }}>
                        + Materialzeile
                      </button>
                    </div>

                    {/* ARBEITSZEIT */}
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                        <Lbl>Arbeitszeit</Lbl>
                        {arbTotal > 0 && <div style={{ fontSize: 10, color: C.textMid }}>{eur(arbTotal)}</div>}
                      </div>
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 380 }}>
                          <thead>
                            <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                              <th style={{ ...thStyle, width: '42%' }}>Kostenstelle</th>
                              <th style={{ ...thStyle, width: '18%' }}>Minuten</th>
                              <th style={{ ...thStyle, width: '15%' }}>€/h</th>
                              <th style={{ ...thStyle, width: '16%', textAlign: 'right' }}>Kosten</th>
                              <th style={{ ...thStyle, width: '9%' }}></th>
                            </tr>
                          </thead>
                          <tbody>
                            {p.arbeitszeit.map(a => (
                              <tr key={a.id} style={{ borderBottom: `1px solid ${C.border}22` }}>
                                <td style={tdStyle}>
                                  <select
                                    value={a.kostenstelle}
                                    onChange={e => updArbRow(p.id, a.id, 'kostenstelle', e.target.value as KostenstelleId)}
                                    style={{ ...cellInput, minWidth: 148 }}
                                  >
                                    {(Object.keys(DEFAULT_STUNDENSAETZE) as KostenstelleId[]).map(ks => (
                                      <option key={ks} value={ks}>{KOSTENSTELLEN_LABELS[ks]}</option>
                                    ))}
                                  </select>
                                </td>
                                <td style={tdStyle}>
                                  <input type="number" step="5" value={a.minuten} onChange={e => updArbRow(p.id, a.id, 'minuten', parseInt(e.target.value) || 0)} style={{ ...cellInput, minWidth: 52 }} />
                                </td>
                                <td style={tdStyle}>
                                  <input type="number" step="1" value={a.vkStunde} onChange={e => updArbRow(p.id, a.id, 'vkStunde', parseFloat(e.target.value) || 0)} style={{ ...cellInput, minWidth: 48 }} />
                                </td>
                                <td style={{ ...tdStyle, textAlign: 'right', fontSize: 11, fontWeight: 600, color: C.white, whiteSpace: 'nowrap' }}>
                                  {eur((a.minuten / 60) * a.vkStunde)}
                                </td>
                                <td style={tdStyle}>
                                  <button onClick={() => delArbRow(p.id, a.id)} style={{ background: 'transparent', color: C.textMid, border: `1px solid ${C.border}`, borderRadius: 2, padding: '3px 7px', cursor: 'pointer', fontSize: 10 }}>×</button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <button onClick={() => addArbRow(p.id)} style={{ marginTop: 6, background: 'transparent', color: C.textMid, border: `1px dashed ${C.border}`, borderRadius: 3, padding: '5px 12px', cursor: 'pointer', fontSize: 11, fontFamily: 'Helvetica Neue,sans-serif' }}>
                        + Arbeitszeitzeile
                      </button>
                    </div>

                    <HR my={8} />

                    {/* Positionsgesamt */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'baseline', gap: 12 }}>
                      <div style={{ fontSize: 9, color: C.textMid, letterSpacing: 2, textTransform: 'uppercase' }}>Positionsgesamt</div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: C.copper }}>{eur(gesamt)}</div>
                    </div>

                  </div>
                </Card>
              )
            })}

            <button onClick={addPos} style={{ width: '100%', background: 'transparent', color: C.textMid, border: `1px dashed ${C.border}`, borderRadius: 4, padding: '11px 0', cursor: 'pointer', fontSize: 12, fontFamily: 'Helvetica Neue,sans-serif', marginBottom: 12 }}>
              + Position hinzufügen
            </button>

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
                  const g = calcAngebotspos(p)
                  return (
                    <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: i < pos.length - 1 ? `1px solid ${C.border}` : 'none', gap: 8, alignItems: 'flex-start' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, lineHeight: 1.2 }}>{p.titel}</div>
                      </div>
                      <div style={{ fontWeight: 800, fontSize: 12, color: C.copper, flexShrink: 0 }}>{eur(g)}</div>
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
              setPdfHTML(buildPDF(pos, kunde, docNr, docTyp, anschr, widerruf))
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
