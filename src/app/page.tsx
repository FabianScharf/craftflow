'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import NoSleep from 'nosleep.js'
import { createClient } from '@/utils/supabase/client'
import {
  C,
  calcAngebotspos, eur, today, inDays,
  ladeKunden, speichereKunden,
  DEFAULT_STUNDENSAETZE, KOSTENSTELLEN_LABELS,
  type Kunde, type KundeDB,
  type Angebotsposition, type MaterialPosten, type ArbeitsPosten, type KostenstelleId,
} from '@/lib/types'
import { buildPDF } from '@/lib/pdf'

/* ── Lieferantenanfrage-Typen ─────────────────────── */
type InquiryDraft = { supplierName: string; email: string; draftId: string | null; materialCount: number }
type InquirySuggestion = { category: string; mats: string[]; aiName: string; aiEmail: string }
type InquiryResult = { drafts: InquiryDraft[]; suggestions: InquirySuggestion[]; uncategorized: string[] }

type OptimChatMsg = { role: 'user' | 'assistant'; content: string }
type OfferVersion = { id: string; version_number: number; created_at: string; description: string | null }

/* ── Upload-Typen ─────────────────────────────────── */
type UploadedFile = {
  id: number
  name: string
  type: 'image' | 'pdf'
  previewUrl?: string
  b64?: string
}

/* ── PDF-Seiten → JPEG (client-seitig, browser canvas) ── */
async function renderPdfPages(
  file: File,
  maxPages = 2
): Promise<Array<{ b64: string; name: string }>> {
  const pdfjsLib = await import('pdfjs-dist')
  if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.js`
  }
  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise
  const total = Math.min(pdf.numPages, maxPages)
  const results: Array<{ b64: string; name: string }> = []
  for (let i = 1; i <= total; i++) {
    const page = await pdf.getPage(i)
    const baseVp = page.getViewport({ scale: 1 })
    const scale = Math.min(2.0, 1500 / baseVp.width)
    const viewport = page.getViewport({ scale })
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(viewport.width)
    canvas.height = Math.round(viewport.height)
    await page.render({ canvasContext: canvas.getContext('2d')!, canvas, viewport }).promise
    const b64 = canvas.toDataURL('image/jpeg', 0.5).split(',')[1]
    const label = pdf.numPages === 1 ? file.name : `${file.name} – S.${i}/${pdf.numPages}`
    results.push({ b64, name: label })
  }
  return results
}

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
  const [userEmail, setUserEmail] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => setUserEmail(data.user?.email ?? null))
  }, [])

  async function logout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  // ── Projektverwaltung ───────────────────────────────
  type ProjectMeta = { id: string; title: string; status: string; updated_at: string }
  const [projects, setProjects] = useState<ProjectMeta[]>([])
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  useEffect(() => {
    fetch('/api/projects').then(r => r.json()).then(d => { if (Array.isArray(d)) setProjects(d) })
  }, [])

  async function saveProject() {
    setSaveStatus('saving')
    const title = [kunde.name.trim(), kunde.projekt.trim()].filter(Boolean).join(' – ') || 'Ohne Titel'
    const payload = { kunde, pos, docNr, docTyp, anschr, widerruf }
    try {
      let res: Response
      if (currentProjectId) {
        res = await fetch(`/api/projects/${currentProjectId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, data: payload }) })
      } else {
        res = await fetch('/api/projects', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, data: payload }) })
      }
      const row = await res.json()
      if (!res.ok) throw new Error(row.error)
      if (!currentProjectId) setCurrentProjectId(row.id)
      setProjects(prev => {
        const exists = prev.find(p => p.id === row.id)
        return exists ? prev.map(p => p.id === row.id ? row : p) : [row, ...prev]
      })
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 3000)
    } catch {
      setSaveStatus('error')
      setTimeout(() => setSaveStatus('idle'), 3000)
    }
  }

  async function loadProject(id: string) {
    const res = await fetch(`/api/projects/${id}`)
    if (!res.ok) return
    const row = await res.json()
    const d = row.data
    if (d.kunde) setKunde(d.kunde)
    if (d.pos)   setPos(d.pos)
    if (d.docNr) setDocNr(d.docNr)
    if (d.docTyp) setDocTyp(d.docTyp)
    if (d.anschr) setAnschr(d.anschr)
    if (typeof d.widerruf === 'boolean') setWiderruf(d.widerruf)
    setCurrentProjectId(id)
    setScreen('app')
    setTab('kalkulation')
  }

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

  // Lieferantenanfrage
  const [selectedMats, setSelectedMats] = useState<Record<number, boolean>>({})
  const [inquiryStatus, setInquiryStatus] = useState<Record<number, 'idle' | 'loading' | 'done' | 'error'>>({})
  const [inquiryResult, setInquiryResult] = useState<Record<number, InquiryResult>>({})
  const [savedSuggestions, setSavedSuggestions] = useState<Record<string, boolean>>({})

  const isMatSelected = (matId: number) => selectedMats[matId] !== false
  const toggleMat = (matId: number) => setSelectedMats(prev => ({
    ...prev, [matId]: prev[matId] !== false ? false : true,
  }))

  // Start Screen State
  const [startText, setStartText] = useState('')
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  const [uploadingCount, setUploadingCount] = useState(0)
  const [startStatus, setStartStatus] = useState<'idle' | 'loading' | 'error' | 'fragen'>('idle')
  const [startMsg, setStartMsg] = useState('')
  const [fragenInput, setFragenInput] = useState('')
  const [fragenMicStatus, setFragenMicStatus] = useState<'idle' | 'recording' | 'transcribing'>('idle')
  const fragenMediaRecorderRef = useRef<MediaRecorder | null>(null)
  const fragenAudioChunksRef = useRef<Blob[]>([])
  const [progressIdx, setProgressIdx] = useState(0)
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [saveCustomerStatus, setSaveCustomerStatus] = useState<'idle' | 'saving' | 'saved' | 'duplicate' | 'error'>('idle')
  const [saveCustomerMsg, setSaveCustomerMsg] = useState('')

  // Mikrofon State
  const [micStatus, setMicStatus] = useState<'idle' | 'recording' | 'transcribing'>('idle')
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const noSleepRef = useRef<NoSleep | null>(null)

  // ── Optimierungs-Panel ──────────────────────────────
  const [optimPanelOpen, setOptimPanelOpen] = useState(false)
  const [optimMessages, setOptimMessages] = useState<OptimChatMsg[]>([])
  const [optimInput, setOptimInput] = useState('')
  const [optimLoading, setOptimLoading] = useState(false)
  const [optimMicStatus, setOptimMicStatus] = useState<'idle' | 'recording' | 'transcribing'>('idle')
  const [offerId, setOfferId] = useState<string>(() => crypto.randomUUID())
  const [versions, setVersions] = useState<OfferVersion[]>([])
  const [versionsOpen, setVersionsOpen] = useState(false)
  const optimMediaRecorderRef = useRef<MediaRecorder | null>(null)
  const optimAudioChunksRef = useRef<Blob[]>([])
  const optimChatRef = useRef<HTMLDivElement>(null)

  // ── Zentrale Materialanfrage + Export ───────────────
  const [allInquiryStatus, setAllInquiryStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [allInquiryResult, setAllInquiryResult] = useState<InquiryResult | null>(null)
  const [copiedFeedback, setCopiedFeedback] = useState(false)

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
    const id = Date.now() + Math.round(Math.random() * 1000)
    const previewUrl = URL.createObjectURL(file)
    setUploadedFiles(prev => [...prev, { id, name: file.name, type: 'image', previewUrl }])
    try {
      const b64 = await compressImage(file)
      setUploadedFiles(prev => prev.map(f => f.id === id ? { ...f, b64 } : f))
    } catch {
      const reader = new FileReader()
      reader.onload = ev => {
        const b64 = (ev.target?.result as string).split(',')[1]
        setUploadedFiles(prev => prev.map(f => f.id === id ? { ...f, b64 } : f))
      }
      reader.readAsDataURL(file)
    }
  }, [compressImage])

  const handlePdfUpload = useCallback(async (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      setStartStatus('error')
      setStartMsg('PDF zu groß. Maximum: 10 MB.')
      return
    }
    const pdfId = Date.now() + Math.round(Math.random() * 1000)
    setUploadedFiles(prev => [...prev, { id: pdfId, name: file.name, type: 'pdf' }])
    setUploadingCount(prev => prev + 1)
    setStartStatus('idle')

    // Text-Extraktion (Server) und Seiten-Rendering (Browser) parallel
    const [textRes, pagesRes] = await Promise.allSettled([
      (async () => {
        const fd = new FormData()
        fd.append('pdf', file)
        const r = await fetch('/api/parse-pdf', { method: 'POST', body: fd })
        return r.json()
      })(),
      renderPdfPages(file),
    ])

    // Text in Textarea einfügen (wenn vorhanden)
    if (textRes.status === 'fulfilled' && textRes.value?.text) {
      setStartText(prev => prev ? prev + '\n\n' + textRes.value.text : textRes.value.text)
    }

    // PDF-Platzhalter durch Seiten-Thumbnails ersetzen
    if (pagesRes.status === 'fulfilled' && pagesRes.value.length > 0) {
      setUploadedFiles(prev => prev.filter(f => f.id !== pdfId))
      for (const { b64, name } of pagesRes.value) {
        const imgId = Date.now() + Math.round(Math.random() * 1000)
        setUploadedFiles(prev => [
          ...prev,
          { id: imgId, name, type: 'image', previewUrl: `data:image/jpeg;base64,${b64}`, b64 },
        ])
      }
    } else if (pagesRes.status === 'rejected') {
      // Rendering fehlgeschlagen — PDF-Platzhalter bleibt, Text-Fallback greift
      console.error('[renderPdfPages]', pagesRes.reason)
      // Wenn auch Text fehlgeschlagen: Fehlermeldung anzeigen
      if (textRes.status === 'rejected' || textRes.value?.error) {
        setUploadedFiles(prev => prev.filter(f => f.id !== pdfId))
        setStartStatus('error')
        setStartMsg('PDF konnte nicht verarbeitet werden.')
      }
    }

    setUploadingCount(prev => prev - 1)
  }, [])

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

  useEffect(() => {
    if (optimChatRef.current) {
      optimChatRef.current.scrollTop = optimChatRef.current.scrollHeight
    }
  }, [optimMessages])

  const resetAll = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop()
    if (optimMediaRecorderRef.current?.state === 'recording') optimMediaRecorderRef.current.stop()
    setStartText('')
    setUploadedFiles([])
    setUploadingCount(0)
    setStartStatus('idle')
    setStartMsg('')
    setMicStatus('idle')
    setKunde({ name: '', zusatz: '', strasse: '', ort: '', projekt: '' })
    setPos([defaultAngebotspos(Date.now())])
    setDocNr('AB-264')
    setDocTyp('Auftragsbestätigung')
    setAnschr('herzlichen Dank für Ihren Auftrag, den wir hiermit gerne bestätigen:')
    setWiderruf(true)
    setSaveCustomerStatus('idle')
    setSaveCustomerMsg('')
    setSelectedMats({})
    setInquiryStatus({})
    setInquiryResult({})
    setSavedSuggestions({})
    setOptimPanelOpen(false)
    setOptimMessages([])
    setOptimInput('')
    setOptimLoading(false)
    setCurrentProjectId(null)
    setSaveStatus('idle')
    setOptimMicStatus('idle')
    setOfferId(crypto.randomUUID())
    setVersions([])
    setVersionsOpen(false)
    setAllInquiryStatus('idle')
    setAllInquiryResult(null)
    setCopiedFeedback(false)
    setScreen('start')
  }, [])

  const saveCustomerToDb = useCallback(async () => {
    setSaveCustomerStatus('saving')
    setSaveCustomerMsg('')
    try {
      const ortParts = kunde.ort.trim().split(/\s+/)
      const zip = /^\d{4,5}$/.test(ortParts[0] ?? '') ? ortParts[0] : ''
      const city = zip ? ortParts.slice(1).join(' ') : kunde.ort
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: kunde.name, street: kunde.strasse, zip, city }),
      })
      const json = await res.json()
      if (json.duplicate) {
        setSaveCustomerStatus('duplicate')
        setSaveCustomerMsg('Bereits vorhanden (gleicher Name + PLZ).')
      } else if (!res.ok) {
        setSaveCustomerStatus('error')
        setSaveCustomerMsg(json.error || 'Fehler beim Speichern.')
      } else {
        setSaveCustomerStatus('saved')
      }
    } catch {
      setSaveCustomerStatus('error')
      setSaveCustomerMsg('Verbindungsfehler.')
    }
  }, [kunde])

  // ── KI Analyse ─────────────────────────────────────
  const callAI = useCallback(async (text: string, imageB64s: string[]) => {
    const res = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, imageBase64: imageB64s }),
    })
    const json = await res.json()
    if (!res.ok || !json.success) throw new Error(json.error || `API Fehler: ${res.status}`)
    return json.data
  }, [])

  const PROGRESS_MSGS = [
    'Analysiere Projektbeschreibung…',
    'Berechne Materialmengen…',
    'Kalkuliere Arbeitszeiten…',
    'Erstelle Angebot…',
  ]

  const startAnalyse = useCallback(async (overrideText?: string) => {
    const textToUse = overrideText ?? startText
    const imageB64s = uploadedFiles.filter(f => f.type === 'image' && f.b64).map(f => f.b64!)
    if (!textToUse.trim() && imageB64s.length === 0) return
    setStartStatus('loading')
    setStartMsg('')
    setProgressIdx(0)
    if (progressTimerRef.current) clearInterval(progressTimerRef.current)
    progressTimerRef.current = setInterval(() => setProgressIdx(i => i + 1), 1500)
    try {
      const data = await callAI(textToUse, imageB64s)

      // KI hat Rückfragen — trotzdem Kalkulation verarbeiten, Chat-Fenster zeigen
      if (data.fragen?.length > 0) {
        setStartStatus('fragen')
        setStartMsg((data.fragen as string[]).join('\n'))
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

      if (textToUse) {
        const t = textToUse.toLowerCase()
        if (t.includes('rechnung')) {
          setDocTyp('Rechnung')
          setDocNr(prev => 'RE-' + prev.replace(/^[A-Z]+-/, ''))
        } else if (t.includes('angebot')) {
          setDocTyp('Angebot')
          setDocNr(prev => 'AN-' + prev.replace(/^[A-Z]+-/, ''))
        }
      }

      // Kein fragen → direkt zum App-Screen
      if (!data.fragen?.length) {
        setStartStatus('idle')
        setScreen('app')
        setTab('kunde')
      }
    } catch (e: unknown) {
      setStartStatus('error')
      setStartMsg(`Fehler: ${e instanceof Error ? e.message : 'Unbekannt'}`)
    } finally {
      if (progressTimerRef.current) { clearInterval(progressTimerRef.current); progressTimerRef.current = null }
    }
  }, [startText, uploadedFiles, callAI])

  async function startFragenMic() {
    if (fragenMicStatus !== 'idle') { fragenMediaRecorderRef.current?.stop(); return }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      setFragenMicStatus('recording')
      const recorder = new MediaRecorder(stream)
      fragenAudioChunksRef.current = []
      fragenMediaRecorderRef.current = recorder
      recorder.ondataavailable = e => { if (e.data.size > 0) fragenAudioChunksRef.current.push(e.data) }
      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        setFragenMicStatus('transcribing')
        try {
          const blob = new Blob(fragenAudioChunksRef.current, { type: 'audio/webm' })
          const form = new FormData()
          form.append('audio', blob, 'fragen.webm')
          const res = await fetch('/api/transcribe', { method: 'POST', body: form })
          const json = await res.json()
          if (json.text) setFragenInput(prev => prev ? prev + ' ' + json.text : json.text)
        } catch {}
        setFragenMicStatus('idle')
      }
      recorder.start()
    } catch { setFragenMicStatus('idle') }
  }

  function submitFragenAnswer() {
    if (!fragenInput.trim()) return
    const combined = startText.trim()
      ? startText + '\n\nErgänzende Informationen: ' + fragenInput.trim()
      : fragenInput.trim()
    setFragenInput('')
    startAnalyse(combined)
  }

  const startInquiry = useCallback(async (posId: number, positionTitel: string, mats: MaterialPosten[]) => {
    const selected = mats.filter(m => selectedMats[m.id] !== false)
    if (!selected.length) return
    setInquiryStatus(prev => ({ ...prev, [posId]: 'loading' }))
    try {
      const res = await fetch('/api/suppliers/inquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          positionTitel,
          materials: selected.map(m => ({ id: m.id, bezeichnung: m.bezeichnung, menge: m.menge, einheit: m.einheit })),
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setInquiryResult(prev => ({ ...prev, [posId]: json as InquiryResult }))
      setInquiryStatus(prev => ({ ...prev, [posId]: 'done' }))
    } catch {
      setInquiryStatus(prev => ({ ...prev, [posId]: 'error' }))
    }
  }, [selectedMats])

  const saveSuggestion = useCallback(async (category: string, name: string, email: string) => {
    await fetch('/api/suppliers/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ company_name: name, email, category_name: category }),
    })
    setSavedSuggestions(prev => ({ ...prev, [category]: true }))
  }, [])

  // ── Optimierung-Panel: Mic ──────────────────────────
  const optimStartRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4'
      const mr = new MediaRecorder(stream, { mimeType })
      optimAudioChunksRef.current = []
      mr.ondataavailable = e => { if (e.data.size > 0) optimAudioChunksRef.current.push(e.data) }
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        setOptimMicStatus('transcribing')
        try {
          const ext = mimeType.includes('webm') ? 'webm' : 'mp4'
          const blob = new Blob(optimAudioChunksRef.current, { type: mimeType })
          const fd = new FormData()
          fd.append('audio', blob, `audio.${ext}`)
          const res = await fetch('/api/transcribe', { method: 'POST', body: fd })
          const json = await res.json()
          if (json.success && json.text) setOptimInput(prev => prev ? prev + ' ' + json.text : json.text)
        } catch (e) { console.error('[optim-mic]', e) }
        setOptimMicStatus('idle')
      }
      mr.start()
      optimMediaRecorderRef.current = mr
      setOptimMicStatus('recording')
    } catch {
      alert('Mikrofon nicht verfügbar. Bitte Zugriff erlauben.')
    }
  }, [])

  const optimStopRecording = useCallback(() => {
    optimMediaRecorderRef.current?.stop()
    setOptimMicStatus('transcribing')
  }, [])

  const optimToggleRecording = useCallback(() => {
    if (optimMicStatus === 'recording') optimStopRecording()
    else if (optimMicStatus === 'idle') optimStartRecording()
  }, [optimMicStatus, optimStartRecording, optimStopRecording])

  // ── Optimierung-Panel: Chat + Versionen ─────────────
  const openOptimPanel = useCallback(async () => {
    setOptimPanelOpen(true)
    try {
      const vRes = await fetch(`/api/offer-versions?offerId=${offerId}`)
      const vJson = await vRes.json()
      if (vJson.versions) setVersions(vJson.versions)
    } catch { /* ignorieren */ }
    if (optimMessages.length > 0) return
    setOptimLoading(true)
    try {
      const res = await fetch('/api/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          offerData: { positionen: pos, kunde },
          chatHistory: [],
          message: 'Analysiere mein Angebot und liste auf, was noch fehlt oder unklar ist (Holzart, Maße, Oberfläche, Montageort etc.). Sei präzise und konkret.',
        }),
      })
      const json = await res.json()
      if (json.message) setOptimMessages([{ role: 'assistant', content: json.message }])
    } catch (e) { console.error('[openOptimPanel]', e) }
    setOptimLoading(false)
  }, [offerId, optimMessages.length, pos, kunde])

  const sendOptimMessage = useCallback(async () => {
    const msg = optimInput.trim()
    if (!msg || optimLoading) return
    setOptimInput('')
    const userMsg: OptimChatMsg = { role: 'user', content: msg }
    setOptimMessages(prev => [...prev, userMsg])
    setOptimLoading(true)
    try {
      const res = await fetch('/api/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          offerData: { positionen: pos, kunde },
          chatHistory: optimMessages,
          message: msg,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Unbekannter Fehler')
      setOptimMessages(prev => [...prev, { role: 'assistant', content: json.message ?? '' }])
      if (json.updatedOffer) {
        await fetch('/api/offer-versions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ offerId, description: msg.slice(0, 60), data: { positionen: pos, kunde } }),
        })
        if (json.updatedOffer.positionen) setPos(json.updatedOffer.positionen)
        if (json.updatedOffer.kunde) setKunde(json.updatedOffer.kunde)
        const vRes = await fetch(`/api/offer-versions?offerId=${offerId}`)
        const vJson = await vRes.json()
        if (vJson.versions) setVersions(vJson.versions)
      }
    } catch (e: unknown) {
      setOptimMessages(prev => [...prev, { role: 'assistant', content: `Fehler: ${e instanceof Error ? e.message : 'Unbekannt'}` }])
    }
    setOptimLoading(false)
  }, [optimInput, optimLoading, optimMessages, pos, kunde, offerId])

  const restoreVersion = useCallback(async (versionId: string) => {
    try {
      const res = await fetch(`/api/offer-versions?versionId=${versionId}`)
      const json = await res.json()
      if (json.data?.positionen) setPos(json.data.positionen)
      if (json.data?.kunde) setKunde(json.data.kunde)
    } catch (e) { console.error('[restoreVersion]', e) }
  }, [])

  // ── Feature 3: Zentrale Materialanfrage ─────────────
  const startAllInquiry = useCallback(async () => {
    const allMats = pos.flatMap(p =>
      p.material.filter(m => selectedMats[m.id] !== false && m.bezeichnung)
        .map(m => ({ id: m.id, bezeichnung: m.bezeichnung, menge: m.menge, einheit: m.einheit }))
    )
    if (!allMats.length) return
    setAllInquiryStatus('loading')
    try {
      const res = await fetch('/api/suppliers/inquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ positionTitel: 'Gesamtanfrage', materials: allMats }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setAllInquiryResult(json as InquiryResult)
      setAllInquiryStatus('done')
    } catch {
      setAllInquiryStatus('error')
    }
  }, [pos, selectedMats])

  // ── Feature 4: Export ────────────────────────────────
  const exportJSON = useCallback(() => {
    const data = { positionen: pos, kunde, docNr, docTyp, exportedAt: new Date().toISOString() }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const lastName = kunde.name.trim().split(/\s+/).pop() || 'Angebot'
    a.href = url
    a.download = `offer_${lastName}_${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [pos, kunde, docNr, docTyp])

  const copyToClipboard = useCallback(async () => {
    const date = today()
    const lines: string[] = [
      `ANGEBOT – ${kunde.name || 'Unbekannt'} – ${date}`,
      '='.repeat(48),
      '',
    ]
    pos.forEach((p, i) => {
      const gesamt = calcAngebotspos(p)
      lines.push(`Position ${i + 1}: ${p.titel}`)
      if (p.material.length > 0) {
        lines.push('Material: ' + p.material.map(m => `${m.bezeichnung} (${m.menge} ${m.einheit})`).join(', '))
      }
      if (p.arbeitszeit.length > 0) {
        const totalMin = p.arbeitszeit.reduce((s, a) => s + a.minuten, 0)
        lines.push(`Arbeitszeit: ${(totalMin / 60).toFixed(1)} h`)
      }
      lines.push(`Gesamtpreis: ${eur(gesamt)}`)
      lines.push('')
    })
    lines.push('='.repeat(48))
    lines.push(`GESAMTSUMME NETTO: ${eur(totals.net)}`)
    await navigator.clipboard.writeText(lines.join('\n'))
    setCopiedFeedback(true)
    setTimeout(() => setCopiedFeedback(false), 2000)
  }, [pos, kunde, totals])

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
    const canGenerate = !!(startText.trim() || uploadedFiles.some(f => f.type === 'image' && f.b64))
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
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
            <button
              onClick={resetAll}
              style={{ background: C.copper, color: C.black, border: 'none', borderRadius: 6, padding: '10px 18px', cursor: 'pointer', fontSize: 14, fontFamily: 'Helvetica Neue,sans-serif', fontWeight: 800, letterSpacing: 0.5 }}
            >
              + Neues Projekt
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ color: C.textMid, fontSize: 9 }}>v{process.env.NEXT_PUBLIC_VERSION}</div>
              <button onClick={() => window.location.href = '/settings'} style={{ background: 'transparent', color: C.textMid, border: `1px solid ${C.border}`, borderRadius: 3, padding: '8px 14px', cursor: 'pointer', fontSize: 12, fontFamily: 'Helvetica Neue,sans-serif' }}>
                ⚙ Einstellungen
              </button>
              {userEmail && (
                <button onClick={logout} style={{ background: 'transparent', color: C.copper, border: `1px solid ${C.copper}`, borderRadius: 3, padding: '8px 16px', cursor: 'pointer', fontSize: 14, fontFamily: 'Helvetica Neue,sans-serif', fontWeight: 600, letterSpacing: 0.5 }}>
                  Abmelden
                </button>
              )}
            </div>
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

          {/* Foto / PDF-Button */}
          <div style={{ marginBottom: 14 }}>
            <input
              ref={startFileRef}
              type="file" accept="image/*,.pdf"
              multiple
              onChange={e => {
                const files = Array.from(e.target.files ?? [])
                e.target.value = ''
                for (const f of files) {
                  const isPdf = f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')
                  if (isPdf) handlePdfUpload(f)
                  else loadBild(f)
                }
              }}
              style={{ display: 'none' }}
            />
            <button
              onClick={() => startFileRef.current?.click()}
              disabled={uploadingCount > 0}
              style={{
                width: '100%', padding: '16px',
                background: uploadedFiles.length > 0 ? `${C.copper}18` : C.gray1,
                border: `2px dashed ${uploadedFiles.length > 0 ? C.copper : C.border}`,
                borderRadius: 10, cursor: uploadingCount > 0 ? 'wait' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              }}
            >
              <span style={{ fontSize: 28 }}>
                {uploadingCount > 0 ? '⟳' : uploadedFiles.length > 0 ? '✓' : '📷'}
              </span>
              <span style={{ color: uploadedFiles.length > 0 ? C.copper : C.textMid, fontSize: 13, fontFamily: 'Helvetica Neue,sans-serif' }}>
                {uploadingCount > 0
                  ? 'Wird verarbeitet…'
                  : uploadedFiles.length > 0
                  ? `${uploadedFiles.length} Datei${uploadedFiles.length > 1 ? 'en' : ''} – weitere hinzufügen`
                  : 'Fotos oder PDFs hochladen (mehrere möglich)'}
              </span>
            </button>
            {uploadedFiles.length > 0 && (
              <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {uploadedFiles.map(f => (
                  <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: C.gray1, borderRadius: 6, border: `1px solid ${C.border}` }}>
                    {f.type === 'image' && f.previewUrl
                      ? <img src={f.previewUrl} alt="" style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 4, border: `1px solid ${C.copper}`, flexShrink: 0 }} />
                      : <span style={{ fontSize: 22, flexShrink: 0 }}>{f.type === 'pdf' ? '📄' : '🖼️'}</span>
                    }
                    <span style={{ flex: 1, fontSize: 11, color: C.textMid, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                    <button
                      onClick={() => {
                        if (f.previewUrl) URL.revokeObjectURL(f.previewUrl)
                        setUploadedFiles(prev => prev.filter(u => u.id !== f.id))
                      }}
                      style={{ background: 'transparent', color: C.textMid, border: `1px solid ${C.border}`, borderRadius: 4, padding: '3px 10px', cursor: 'pointer', fontSize: 11, fontFamily: 'Helvetica Neue,sans-serif', flexShrink: 0 }}
                    >×</button>
                  </div>
                ))}
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
            onClick={() => startAnalyse()}
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

          {/* Fortschritts-Indikator während Loading */}
          {loading && (
            <div style={{ marginTop: 10, textAlign: 'center', color: C.copper, fontSize: 12, fontFamily: 'Helvetica Neue,sans-serif', letterSpacing: 0.5, opacity: 0.8 }}>
              {PROGRESS_MSGS[progressIdx % PROGRESS_MSGS.length]}
            </div>
          )}

          {startStatus === 'error' && startMsg && (
            <div style={{ marginTop: 14, background: '#1a0d0d', border: '1px solid #4a2a2a', borderRadius: 8, padding: '14px 16px', fontSize: 13, color: '#ff9999' }}>
              {startMsg}
            </div>
          )}

          {/* KI-Chat-Fenster bei Rückfragen */}
          {startStatus === 'fragen' && (
            <div style={{ marginTop: 14, background: '#0d1520', border: `1px solid ${C.copper}55`, borderRadius: 10, padding: '16px' }}>
              <div style={{ color: C.copper, fontWeight: 700, fontSize: 11, letterSpacing: 1, marginBottom: 10 }}>
                KI BRAUCHT NOCH INFORMATIONEN
              </div>
              <div style={{ color: C.white, fontSize: 13, marginBottom: 14, lineHeight: 1.7 }}>
                Ich habe eine erste Kalkulation erstellt — für eine genauere Berechnung wäre hilfreich zu wissen:
              </div>
              <div style={{ marginBottom: 14 }}>
                {startMsg.split('\n').map((q, i) => (
                  <div key={i} style={{ color: 'rgba(240,237,232,0.7)', fontSize: 13, marginBottom: 5, paddingLeft: 10, borderLeft: `2px solid ${C.copper}66`, lineHeight: 1.5 }}>
                    {q}
                  </div>
                ))}
              </div>
              <textarea
                value={fragenInput}
                onChange={e => setFragenInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitFragenAnswer() } }}
                placeholder="Deine Antwort (Enter zum Absenden)…"
                rows={3}
                style={{ width: '100%', background: C.gray1, border: `1px solid ${C.border}`, borderRadius: 8, padding: '11px 13px', fontSize: 13, color: C.white, fontFamily: 'Helvetica Neue,sans-serif', resize: 'none', boxSizing: 'border-box', outline: 'none', marginBottom: 8 }}
              />
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={startFragenMic}
                  style={{ background: fragenMicStatus === 'recording' ? '#5a1a1a' : fragenMicStatus === 'transcribing' ? C.gray2 : C.gray1, border: `1px solid ${fragenMicStatus === 'recording' ? '#ff6666' : C.border}`, borderRadius: 8, padding: '10px 14px', cursor: 'pointer', fontSize: 16, color: fragenMicStatus === 'recording' ? '#ff6666' : C.textMid, flexShrink: 0 }}
                >
                  {fragenMicStatus === 'recording' ? '⏹' : fragenMicStatus === 'transcribing' ? '⟳' : '🎙️'}
                </button>
                <button
                  onClick={submitFragenAnswer}
                  disabled={!fragenInput.trim()}
                  style={{ flex: 1, background: fragenInput.trim() ? C.copper : C.gray2, color: fragenInput.trim() ? C.black : C.textMid, border: 'none', borderRadius: 8, padding: '10px', cursor: fragenInput.trim() ? 'pointer' : 'not-allowed', fontSize: 13, fontFamily: 'Helvetica Neue,sans-serif', fontWeight: 700 }}
                >
                  Kalkulation verfeinern
                </button>
                <button
                  onClick={() => { setScreen('app'); setTab('kalkulation') }}
                  style={{ background: 'transparent', color: C.textMid, border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 12px', cursor: 'pointer', fontSize: 12, fontFamily: 'Helvetica Neue,sans-serif', flexShrink: 0 }}
                >
                  Trotzdem weiter →
                </button>
              </div>
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

        {/* ── Meine Projekte ── */}
        <div style={{ padding: '0 16px 48px', maxWidth: 500, margin: '0 auto' }}>
          <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 28, marginBottom: 14 }}>
            <div style={{ color: C.textMid, fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 12 }}>
              Meine Projekte
            </div>
            {projects.length === 0 ? (
              <div style={{ color: C.textMid, fontSize: 12, fontStyle: 'italic', padding: '8px 0' }}>
                Noch keine Projekte gespeichert. Erstelle eine Kalkulation und tippe auf „Projekt speichern".
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {projects.map(p => (
                  <div key={p.id} style={{ background: C.darkbg, border: `1px solid ${C.border}`, borderRadius: 8, padding: '11px 14px', fontFamily: 'Helvetica Neue,sans-serif' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }} onClick={() => loadProject(p.id)} role="button" style2={{ cursor: 'pointer' }}>
                      <button onClick={() => loadProject(p.id)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left', flex: 1 }}>
                        <div style={{ color: C.white, fontSize: 13, fontWeight: 600, marginBottom: 2 }}>{p.title}</div>
                        <div style={{ color: C.textMid, fontSize: 10 }}>
                          {new Date(p.updated_at).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                        </div>
                      </button>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {(['gewonnen', 'verhandelt', 'verloren'] as const).map(s => {
                        const colors: Record<string, { bg: string; border: string; color: string }> = {
                          gewonnen:  { bg: p.status === 'gewonnen'  ? '#1a3a1a' : 'transparent', border: '#3a6a3a', color: '#90EE90' },
                          verhandelt:{ bg: p.status === 'verhandelt' ? '#0d1520' : 'transparent', border: C.copper + '66', color: C.copper },
                          verloren:  { bg: p.status === 'verloren'  ? '#2a0d0d' : 'transparent', border: '#6a2a2a', color: '#ff9999' },
                        };
                        const c = colors[s];
                        return (
                          <button key={s} onClick={async (e) => {
                            e.stopPropagation();
                            const newStatus = p.status === s ? 'offen' : s;
                            await fetch('/api/tracking', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'status_set', projectId: p.id, data: { status: newStatus } }) });
                            setProjects(prev => prev.map(x => x.id === p.id ? { ...x, status: newStatus } : x));
                          }} style={{ padding: '4px 10px', borderRadius: 20, fontSize: 11, border: `1px solid ${c.border}`, background: p.status === s ? c.bg : 'transparent', color: c.color, cursor: 'pointer', fontFamily: 'Helvetica Neue,sans-serif', fontWeight: p.status === s ? 700 : 400 }}>
                            {s === 'gewonnen' ? '✓ Gewonnen' : s === 'verhandelt' ? '↔ Verhandelt' : '✕ Verloren'}
                          </button>
                        );
                      })}
                      {p.status === 'offen' && <span style={{ fontSize: 10, color: C.textMid, alignSelf: 'center', marginLeft: 4 }}>offen</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
    )
  }

  /* ══════════════════════════════════════════════════
     SCREEN: APP (3 Tabs)
  ══════════════════════════════════════════════════ */
  const TABS = [
    { id: 'kunde',        label: '👤 Kunde' },
    { id: 'kalkulation',  label: '🔢 Kalkulation' },
    { id: 'angebot',      label: '📄 Angebot' },
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ color: C.white, fontSize: 11, fontWeight: 600, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {kunde.name || '–'}
            </div>
            <div style={{ color: C.textMid, fontSize: 9 }}>{docNr} · {today()}</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
            <button
              onClick={() => setScreen('start')}
              style={{ background: C.gray1, color: C.copper, border: `1px solid ${C.copper}`, borderRadius: 6, padding: '10px 14px', cursor: 'pointer', fontSize: 13, fontFamily: 'Helvetica Neue,sans-serif', fontWeight: 700, whiteSpace: 'nowrap' }}
            >
              ← Zurück
            </button>
            {userEmail && (
              <button onClick={logout} style={{ background: 'transparent', color: C.textMid, border: 'none', cursor: 'pointer', fontSize: 9, fontFamily: 'Helvetica Neue,sans-serif', padding: 0, letterSpacing: 0.5 }}>
                Abmelden
              </button>
            )}
          </div>
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

      <div style={{ padding: tab === 'kalkulation' ? 0 : 14, maxWidth: (tab === 'kalkulation' && optimPanelOpen) ? 'none' : 760, margin: (tab === 'kalkulation' && optimPanelOpen) ? '0' : '0 auto', boxSizing: 'border-box' }}>

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
              <div style={{ marginBottom: 12 }}>
                <button
                  onClick={saveCustomerToDb}
                  disabled={saveCustomerStatus === 'saving' || saveCustomerStatus === 'saved'}
                  style={{
                    width: '100%',
                    background: saveCustomerStatus === 'saved' ? '#1a3a1a' : 'transparent',
                    color: saveCustomerStatus === 'saved' ? '#90EE90' : saveCustomerStatus === 'saving' ? C.textMid : C.copper,
                    border: `1px solid ${saveCustomerStatus === 'saved' ? '#3a6a3a' : saveCustomerStatus === 'duplicate' || saveCustomerStatus === 'error' ? '#8b2222' : C.copper}`,
                    borderRadius: 4, padding: '11px 0',
                    cursor: saveCustomerStatus === 'saving' || saveCustomerStatus === 'saved' ? 'default' : 'pointer',
                    fontSize: 12, fontFamily: 'Helvetica Neue,sans-serif',
                  }}
                >
                  {saveCustomerStatus === 'saving' && '⟳ Wird gespeichert…'}
                  {saveCustomerStatus === 'saved' && '✓ In Kundendatenbank gespeichert'}
                  {(saveCustomerStatus === 'idle' || saveCustomerStatus === 'duplicate' || saveCustomerStatus === 'error') && '+ In Kundendatenbank speichern'}
                </button>
                {(saveCustomerStatus === 'duplicate' || saveCustomerStatus === 'error') && (
                  <div style={{ marginTop: 6, fontSize: 11, color: '#ff9999', padding: '6px 10px', background: '#1a0d0d', borderRadius: 3, border: '1px solid #4a2020' }}>
                    {saveCustomerStatus === 'duplicate' ? '⚠ Bereits vorhanden (gleicher Name + PLZ).' : `✕ ${saveCustomerMsg}`}
                  </div>
                )}
              </div>
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
          <>
            <style>{`
              .cf-optim-panel {
                width: 300px; min-width: 300px;
                border-left: 1px solid #2E2E2E;
                display: flex; flex-direction: column;
                flex-shrink: 0; overflow: hidden;
                background: #141414;
              }
              @media (max-width: 640px) {
                .cf-optim-panel {
                  position: fixed; bottom: 0; left: 0; right: 0;
                  width: 100% !important; min-width: 0; height: 65vh;
                  border-left: none; border-top: 2px solid #C8885A; z-index: 100;
                }
              }
            `}</style>
            <div style={{ display: 'flex', minHeight: 'calc(100vh - 116px)', alignItems: 'flex-start' }}>

            {/* ── LEFT: Kalkulation Content ── */}
            <div style={{ flex: 1, padding: 14, minWidth: 0, overflowY: 'auto', maxHeight: 'calc(100vh - 116px)' }}>

            {/* Feature 3+4: Top action buttons */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
              <button
                onClick={startAllInquiry}
                disabled={allInquiryStatus === 'loading'}
                style={{
                  flex: 1, minWidth: 160,
                  background: allInquiryStatus === 'done' ? '#1a3a1a' : 'transparent',
                  color: allInquiryStatus === 'done' ? '#90EE90' : allInquiryStatus === 'loading' ? C.textMid : C.copper,
                  border: `1px solid ${allInquiryStatus === 'done' ? '#3a6a3a' : allInquiryStatus === 'error' ? '#8b2222' : C.copper}`,
                  borderRadius: 3, padding: '8px 12px',
                  cursor: allInquiryStatus === 'loading' ? 'wait' : 'pointer',
                  fontSize: 11, fontFamily: 'Helvetica Neue,sans-serif', fontWeight: 700,
                }}
              >
                {allInquiryStatus === 'loading' ? '⟳ Anfragen werden erstellt…' : allInquiryStatus === 'done' ? '✓ Drafts erstellt' : '✉ Alle Materialien anfragen'}
              </button>
              <button onClick={exportJSON} style={{ background: 'transparent', color: C.textMid, border: `1px solid ${C.border}`, borderRadius: 3, padding: '8px 12px', cursor: 'pointer', fontSize: 11, fontFamily: 'Helvetica Neue,sans-serif' }}>
                ↓ JSON
              </button>
              <button onClick={copyToClipboard} style={{ background: copiedFeedback ? '#1a3a1a' : 'transparent', color: copiedFeedback ? '#90EE90' : C.textMid, border: `1px solid ${copiedFeedback ? '#3a6a3a' : C.border}`, borderRadius: 3, padding: '8px 12px', cursor: 'pointer', fontSize: 11, fontFamily: 'Helvetica Neue,sans-serif' }}>
                {copiedFeedback ? '✓ Kopiert' : '⎘ Kopieren'}
              </button>
            </div>

            {allInquiryStatus === 'done' && allInquiryResult && (
              <div style={{ background: C.black, border: `1px solid ${C.border}`, borderRadius: 4, padding: '10px 12px', marginBottom: 14 }}>
                {allInquiryResult.drafts.map((d, i) => (
                  <div key={i} style={{ fontSize: 12, color: '#90EE90', marginBottom: 4 }}>
                    ✓ Draft an <strong>{d.supplierName}</strong> ({d.materialCount} Artikel)
                    <a href="https://mail.google.com/mail/#drafts" target="_blank" rel="noreferrer" style={{ color: C.copper, textDecoration: 'none', fontSize: 11, marginLeft: 8 }}>In Gmail →</a>
                  </div>
                ))}
                {allInquiryResult.uncategorized?.length > 0 && (
                  <div style={{ fontSize: 11, color: C.textMid, marginTop: 4 }}>Nicht kategorisiert: {allInquiryResult.uncategorized.join(', ')}</div>
                )}
                {allInquiryResult.drafts.length === 0 && (
                  <div style={{ fontSize: 12, color: C.textMid }}>Keine bekannten Lieferanten – KI-Vorschläge in den Positionen prüfen.</div>
                )}
                <button onClick={() => { setAllInquiryStatus('idle'); setAllInquiryResult(null) }} style={{ marginTop: 8, background: 'transparent', color: C.textMid, border: 'none', cursor: 'pointer', fontSize: 11, fontFamily: 'Helvetica Neue,sans-serif', textDecoration: 'underline', padding: 0 }}>
                  Schließen
                </button>
              </div>
            )}
            {allInquiryStatus === 'error' && (
              <div style={{ background: '#1a0d0d', border: '1px solid #4a2a2a', borderRadius: 4, padding: '8px 12px', marginBottom: 14, fontSize: 12, color: '#ff9999' }}>
                Fehler beim Erstellen der Anfragen.
              </div>
            )}

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
                              <th style={{ ...thStyle, width: '4%' }}></th>
                              <th style={{ ...thStyle, width: '32%' }}>Bezeichnung</th>
                              <th style={{ ...thStyle, width: '9%' }}>Menge</th>
                              <th style={{ ...thStyle, width: '8%' }}>Einheit</th>
                              <th style={{ ...thStyle, width: '10%' }}>EK €</th>
                              <th style={{ ...thStyle, width: '10%' }}>Aufschl.%</th>
                              <th style={{ ...thStyle, width: '15%', textAlign: 'right' }}>VK gesamt</th>
                              <th style={{ ...thStyle, width: '12%' }}></th>
                            </tr>
                          </thead>
                          <tbody>
                            {p.material.map(m => (
                              <tr key={m.id} style={{ borderBottom: `1px solid ${C.border}22` }}>
                                <td style={{ ...tdStyle, textAlign: 'center' }}>
                                  <div
                                    onClick={() => toggleMat(m.id)}
                                    style={{
                                      width: 14, height: 14, margin: '0 auto',
                                      border: `2px solid ${isMatSelected(m.id) ? C.copper : C.border}`,
                                      borderRadius: 2, cursor: 'pointer',
                                      background: isMatSelected(m.id) ? C.copper : 'transparent',
                                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                                      fontSize: 9, color: C.black, fontWeight: 800, flexShrink: 0,
                                    }}
                                  >{isMatSelected(m.id) ? '✓' : ''}</div>
                                </td>
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

                      {p.material.length > 0 && (() => {
                        const selCount = p.material.filter(m => isMatSelected(m.id)).length
                        const ist = inquiryStatus[p.id]
                        const res = inquiryResult[p.id]
                        return (
                          <div style={{ marginTop: 10 }}>
                            {ist !== 'loading' && ist !== 'done' && (
                              <button
                                onClick={() => startInquiry(p.id, p.titel, p.material)}
                                disabled={selCount === 0}
                                style={{
                                  background: selCount === 0 ? C.gray2 : 'transparent',
                                  color: selCount === 0 ? C.textMid : C.copper,
                                  border: `1px solid ${selCount === 0 ? C.border : C.copper}`,
                                  borderRadius: 3, padding: '6px 14px', cursor: selCount === 0 ? 'not-allowed' : 'pointer',
                                  fontSize: 11, fontFamily: 'Helvetica Neue,sans-serif', fontWeight: 700,
                                }}
                              >
                                ✉ Ausgewählte Preise anfragen ({selCount}/{p.material.length})
                              </button>
                            )}
                            {ist === 'loading' && (
                              <div style={{ fontSize: 12, color: C.textMid, padding: '6px 0' }}>
                                ⟳ Analysiere Materialien und suche Lieferanten…
                              </div>
                            )}
                            {ist === 'error' && (
                              <div style={{ fontSize: 12, color: '#ff9999', padding: '6px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
                                Fehler beim Erstellen der Drafts.
                                <button onClick={() => startInquiry(p.id, p.titel, p.material)} style={{ background: 'transparent', color: C.copper, border: 'none', cursor: 'pointer', fontSize: 11, textDecoration: 'underline', fontFamily: 'Helvetica Neue,sans-serif', padding: 0 }}>
                                  Erneut versuchen
                                </button>
                              </div>
                            )}
                            {ist === 'done' && res && (
                              <div style={{ marginTop: 4, background: C.black, border: `1px solid ${C.border}`, borderRadius: 4, padding: '10px 12px' }}>
                                {res.drafts.map((d, i) => (
                                  <div key={i} style={{ fontSize: 12, color: '#90EE90', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                    ✓ Draft an <strong>{d.supplierName}</strong> ({d.materialCount} Artikel)
                                    <a href="https://mail.google.com/mail/#drafts" target="_blank" rel="noreferrer"
                                      style={{ color: C.copper, textDecoration: 'none', fontSize: 11 }}>
                                      In Gmail öffnen →
                                    </a>
                                  </div>
                                ))}
                                {res.suggestions?.map((s, i) => (
                                  <div key={i} style={{ marginTop: 8, background: '#0d1520', border: `1px solid ${C.copper}44`, borderRadius: 3, padding: '8px 10px' }}>
                                    <div style={{ color: C.copper, fontWeight: 700, fontSize: 11, marginBottom: 3 }}>
                                      KI-Vorschlag für „{s.category}":
                                    </div>
                                    <div style={{ color: C.white, fontSize: 12 }}>{s.aiName}{s.aiEmail && ` · ${s.aiEmail}`}</div>
                                    <div style={{ color: C.textMid, fontSize: 11, marginTop: 2, marginBottom: 6 }}>{s.mats.join(', ')}</div>
                                    {savedSuggestions[s.category] ? (
                                      <div style={{ color: '#90EE90', fontSize: 11 }}>✓ In Datenbank gespeichert</div>
                                    ) : (
                                      <div style={{ display: 'flex', gap: 8 }}>
                                        <button onClick={() => saveSuggestion(s.category, s.aiName, s.aiEmail)}
                                          style={{ background: C.copper, color: C.black, border: 'none', borderRadius: 3, padding: '4px 10px', cursor: 'pointer', fontSize: 11, fontFamily: 'Helvetica Neue,sans-serif', fontWeight: 700 }}>
                                          Ja, aufnehmen
                                        </button>
                                        <button onClick={() => setSavedSuggestions(prev => ({ ...prev, [s.category]: true }))}
                                          style={{ background: 'transparent', color: C.textMid, border: `1px solid ${C.border}`, borderRadius: 3, padding: '4px 10px', cursor: 'pointer', fontSize: 11, fontFamily: 'Helvetica Neue,sans-serif' }}>
                                          Nein
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                ))}
                                {res.uncategorized?.length > 0 && (
                                  <div style={{ marginTop: 8, fontSize: 11, color: C.textMid }}>
                                    Nicht kategorisiert: {res.uncategorized.join(', ')}
                                  </div>
                                )}
                                <button onClick={() => setInquiryStatus(prev => ({ ...prev, [p.id]: 'idle' }))}
                                  style={{ marginTop: 8, background: 'transparent', color: C.textMid, border: 'none', cursor: 'pointer', fontSize: 11, fontFamily: 'Helvetica Neue,sans-serif', textDecoration: 'underline', padding: 0 }}>
                                  Schließen
                                </button>
                              </div>
                            )}
                          </div>
                        )
                      })()}
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
            </div>{/* end left column */}

            {/* ── RIGHT: Panel toggle or Panel ── */}
            {!optimPanelOpen ? (
              <button
                onClick={openOptimPanel}
                style={{
                  background: C.darkbg, color: C.copper,
                  border: 'none', borderLeft: `2px solid ${C.copper}44`,
                  padding: '24px 9px', cursor: 'pointer',
                  fontSize: 10, fontFamily: 'Helvetica Neue,sans-serif',
                  letterSpacing: 2, writingMode: 'vertical-rl',
                  flexShrink: 0, alignSelf: 'flex-start',
                  position: 'sticky', top: 0, fontWeight: 700,
                }}
              >
                Optimierung ›
              </button>
            ) : (
              <div className="cf-optim-panel">
                {/* Header */}
                <div style={{ padding: '12px 14px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                  <span style={{ color: C.copper, fontWeight: 700, fontSize: 13, letterSpacing: 1 }}>OPTIMIERUNG</span>
                  <button onClick={() => setOptimPanelOpen(false)} style={{ background: 'transparent', color: C.textMid, border: `1px solid ${C.border}`, borderRadius: 3, padding: '3px 9px', cursor: 'pointer', fontSize: 12, fontFamily: 'Helvetica Neue,sans-serif' }}>×</button>
                </div>

                {/* Chat */}
                <div ref={optimChatRef} style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {optimMessages.length === 0 && !optimLoading && (
                    <div style={{ color: C.textMid, fontSize: 12, lineHeight: 1.6 }}>
                      KI analysiert gleich das Angebot…
                    </div>
                  )}
                  {optimMessages.map((msg, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                      <div style={{
                        maxWidth: '88%', padding: '8px 12px', borderRadius: 8,
                        fontSize: 12, lineHeight: 1.55,
                        background: msg.role === 'user' ? C.copper : C.gray1,
                        color: msg.role === 'user' ? C.black : C.white,
                        whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                      }}>
                        {msg.content}
                      </div>
                    </div>
                  ))}
                  {optimLoading && (
                    <div style={{ color: C.textMid, fontSize: 12 }}>⟳ KI denkt…</div>
                  )}
                </div>

                {/* Versionshistorie */}
                {versions.length > 0 && (
                  <div style={{ borderTop: `1px solid ${C.border}`, padding: '8px 14px', flexShrink: 0 }}>
                    <button onClick={() => setVersionsOpen(v => !v)} style={{ background: 'transparent', color: C.textMid, border: 'none', cursor: 'pointer', fontSize: 11, fontFamily: 'Helvetica Neue,sans-serif', padding: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>Versionen ({versions.length})</span>
                      <span>{versionsOpen ? '▲' : '▼'}</span>
                    </button>
                    {versionsOpen && (
                      <div style={{ marginTop: 8, maxHeight: 180, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {versions.map(v => (
                          <div key={v.id} style={{ padding: '6px 8px', background: C.black, borderRadius: 3, border: `1px solid ${C.border}` }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 4 }}>
                              <span style={{ fontSize: 10, color: C.textMid }}>
                                V{v.version_number} · {new Date(v.created_at).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                              </span>
                              <button onClick={() => restoreVersion(v.id)} style={{ background: 'transparent', color: C.copper, border: `1px solid ${C.copper}55`, borderRadius: 2, padding: '2px 7px', cursor: 'pointer', fontSize: 10, fontFamily: 'Helvetica Neue,sans-serif' }}>
                                Wiederherstellen
                              </button>
                            </div>
                            {v.description && (
                              <div style={{ fontSize: 10, color: C.white, marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.description}</div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Eingabebereich */}
                <div style={{ padding: '10px 14px', borderTop: `1px solid ${C.border}`, flexShrink: 0 }}>
                  <textarea
                    value={optimInput}
                    onChange={e => setOptimInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendOptimMessage() } }}
                    placeholder="Nachricht… (Enter = Senden)"
                    rows={2}
                    disabled={optimLoading}
                    style={{ width: '100%', background: C.gray2, border: `1px solid ${C.border}`, borderRadius: 4, padding: '8px 10px', fontSize: 12, lineHeight: 1.5, color: C.white, fontFamily: 'Helvetica Neue,sans-serif', resize: 'none', boxSizing: 'border-box', outline: 'none' }}
                  />
                  <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                    <button
                      onClick={optimToggleRecording}
                      disabled={optimMicStatus === 'transcribing' || optimLoading}
                      style={{ background: optimMicStatus === 'recording' ? '#cc2222' : C.gray2, color: optimMicStatus === 'recording' ? '#fff' : C.textMid, border: `1px solid ${optimMicStatus === 'recording' ? '#cc2222' : C.border}`, borderRadius: 3, padding: '6px 10px', cursor: 'pointer', fontSize: 13, flexShrink: 0 }}
                    >
                      {optimMicStatus === 'transcribing' ? '⟳' : '🎤'}
                    </button>
                    <button
                      onClick={sendOptimMessage}
                      disabled={!optimInput.trim() || optimLoading}
                      style={{ flex: 1, background: (!optimInput.trim() || optimLoading) ? C.gray2 : C.copper, color: (!optimInput.trim() || optimLoading) ? C.textMid : C.black, border: 'none', borderRadius: 3, padding: '6px 12px', cursor: (!optimInput.trim() || optimLoading) ? 'not-allowed' : 'pointer', fontSize: 12, fontFamily: 'Helvetica Neue,sans-serif', fontWeight: 700 }}
                    >
                      Senden
                    </button>
                  </div>
                </div>
              </div>
            )}

            </div>{/* end flex row */}
          </>
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

            <button
              onClick={saveProject}
              disabled={saveStatus === 'saving'}
              style={{ width: '100%', background: saveStatus === 'saved' ? '#1a3a1a' : C.darkbg, color: saveStatus === 'saved' ? '#5ABE6A' : saveStatus === 'error' ? '#E05A5A' : C.textMid, border: `1px solid ${saveStatus === 'saved' ? '#3a6a3a' : saveStatus === 'error' ? '#6a3a3a' : C.border}`, padding: '12px 0', borderRadius: 3, fontSize: 13, fontFamily: 'Helvetica Neue,sans-serif', fontWeight: 700, letterSpacing: 1, cursor: saveStatus === 'saving' ? 'not-allowed' : 'pointer', marginBottom: 8 }}
            >
              {saveStatus === 'saving' ? '…' : saveStatus === 'saved' ? '✓ Gespeichert' : saveStatus === 'error' ? '✗ Fehler beim Speichern' : currentProjectId ? '💾 Projekt aktualisieren' : '💾 Projekt speichern'}
            </button>

            <button onClick={() => {
              setPdfHTML(buildPDF(pos, kunde, docNr, docTyp, anschr, widerruf))
              setScreen('pdf')
              if (currentProjectId) {
                fetch('/api/tracking', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'pdf_export', projectId: currentProjectId, data: { preis_netto: totals.net } }) })
              }
            }} style={{ width: '100%', background: C.copper, color: C.black, border: 'none', padding: '14px 0', borderRadius: 3, fontSize: 13, fontFamily: 'Helvetica Neue,sans-serif', fontWeight: 800, letterSpacing: 2, cursor: 'pointer' }}>
              ▶ DOKUMENT ALS PDF ANZEIGEN
            </button>
          </div>
        )}


      </div>
    </div>
  )
}
