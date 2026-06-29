'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { usePlan } from '@/hooks/usePlan'
import NoSleep from 'nosleep.js'
import { createClient } from '@/utils/supabase/client'
import {
  C,
  calcAngebotspos, eur, today, inDays,
  ladeKunden, speichereKunden,
  DEFAULT_STUNDENSAETZE, KOSTENSTELLEN_LABELS, KOSTENSTELLEN_GRUPPEN, KOSTENSTELLEN_GRUPPEN_ORDER,
  type Kunde, type KundeDB,
  type Angebotsposition, type MaterialPosten, type ArbeitsPosten, type KostenstelleId,
  type DbKostenstelle,
} from '@/lib/types'
import { buildPDF } from '@/lib/pdf'

/* ── Lieferantenanfrage-Typen ─────────────────────── */
type InquiryCandidate = { supplierId: string; supplierName: string; email: string; phone: string | null; ist_favorit: boolean; subject: string; body: string }
type InquiryGroup = { gruppe: string; materialien: string[]; candidates: InquiryCandidate[] }
type InquiryMissingGroup = { gruppe: string; mats: string[] }
type SuggestedSupplier = { name: string; website: string | null; email: string | null; phone: string | null; gruppe: string; materialien: string[] }
type InquiryResult = { groups: InquiryGroup[]; missingGroups: InquiryMissingGroup[]; uncategorized: string[]; suggestedSuppliers?: SuggestedSupplier[] }

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
  maxPages = 10
): Promise<Array<{ b64: string; name: string }>> {
  const pdfjsLib = await import('pdfjs-dist')
  // Lokale Worker-Datei statt externem CDN (verhindert Ausfälle bei Netzwerkproblemen)
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'
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
const LogoMark = ({ size = 36, userLogoUrl }: { size?: number; userLogoUrl?: string | null }) =>
  userLogoUrl
    ? <img src={userLogoUrl} alt="Logo" style={{ height: size, width: 'auto', maxWidth: size * 4, objectFit: 'contain' }} />
    : (
      <svg width={size} height={size} viewBox="0 0 36 36" fill="none" style={{ flexShrink: 0 }}>
        <rect width="36" height="36" rx="7" fill="var(--c-accent, #C8885A)" />
        <text x="18" y="25" textAnchor="middle" fill="#0D0D0D"
          fontFamily="Helvetica Neue, Helvetica, Arial, sans-serif"
          fontSize="15" fontWeight="800" letterSpacing="0.5">CF</text>
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
const defaultAngebotspos = (id: number): Angebotsposition => ({
  id, titel: 'Neue Position', beschreibung: '', material: [], arbeitszeit: [],
})

/* ── GAEB Parser (client-side) ─────────────────────── */
const GAEB_EXTENSIONS = ['.x81', '.x82', '.x83', '.x84', '.x86', '.d81', '.d82', '.d83', '.d84', '.d86', '.p81', '.p82', '.p83', '.p84', '.p86']

function xmlEscape(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function getTagText(parent: Element, tag: string): string {
  return parent.getElementsByTagName(tag)[0]?.textContent?.trim() ?? ''
}

function parseGaebXML(xmlText: string): { positions: import('@/lib/types').Angebotsposition[]; projektName: string } {
  const doc = new DOMParser().parseFromString(xmlText, 'application/xml')
  const projektName = getTagText(doc.documentElement, 'Name') || getTagText(doc.documentElement, 'LblBoQ') || 'GAEB-Import'
  const positions: import('@/lib/types').Angebotsposition[] = []
  const items = Array.from(doc.getElementsByTagName('Item'))
  items.forEach((item, i) => {
    const shortText = getTagText(item, 'ShortText')
    const detailText = getTagText(item, 'Text')
    const qty = parseFloat(getTagText(item, 'Qty').replace(',', '.')) || 1
    const unit = getTagText(item, 'QU') || 'Psch'
    const up = parseFloat(getTagText(item, 'UP').replace(',', '.')) || 0
    const rno = item.getAttribute('RNoPart') ?? String((i + 1) * 10).padStart(4, '0')
    const titel = shortText || `Position ${rno}`
    const beschreibung = detailText || ''
    positions.push({
      id: Date.now() + i * 3,
      titel,
      beschreibung,
      material: up > 0
        ? [{ id: Date.now() + i * 3 + 1, bezeichnung: titel, menge: qty, einheit: unit, ekPreis: up, aufschlag: 0 }]
        : [],
      arbeitszeit: [],
    })
  })
  return { positions, projektName }
}

function parseGaebText(text: string): { positions: import('@/lib/types').Angebotsposition[]; projektName: string } {
  const lines = text.split(/\r?\n/)
  const positions: import('@/lib/types').Angebotsposition[] = []
  let current: import('@/lib/types').Angebotsposition | null = null
  let ltLines: string[] = []
  let projektName = 'GAEB-Import'
  for (const line of lines) {
    const code = line.substring(0, 2)
    if (code === 'T8') {
      const titleMatch = line.match(/\s{3,}(.+?)\s*$/)
      if (titleMatch) projektName = titleMatch[1].trim()
    } else if (code === 'P0') {
      if (current) { current.beschreibung = ltLines.join('\n'); positions.push(current); ltLines = [] }
      const rest = line.substring(3).trim()
      const parts = rest.split(/\s+/)
      const posNr = parts[0] ?? ''
      const einheit = parts[1] ?? 'Stk'
      const menge = parseFloat((parts[2] ?? '1').replace(',', '.')) || 1
      const kurztext = parts.slice(3).join(' ').trim() || `Position ${posNr}`
      current = {
        id: Date.now() + positions.length * 3,
        titel: kurztext,
        beschreibung: '',
        material: [{ id: Date.now() + positions.length * 3 + 1, bezeichnung: kurztext, menge, einheit, ekPreis: 0, aufschlag: 0 }],
        arbeitszeit: [],
      }
    } else if ((code === 'L1' || code === 'L2') && current) {
      const t = line.substring(2).trim()
      if (t) ltLines.push(t)
    }
  }
  if (current) { current.beschreibung = ltLines.join('\n'); positions.push(current) }
  return { positions, projektName }
}

/* ── Haupt-Komponente ─────────────────────────────── */

export default function CraftFlow() {
  const { canUse: planCanUse, usage, incrementUsage, isInTrial, trialDaysLeft, isBlocked } = usePlan()
  const [pwLoading, setPwLoading] = useState<string | null>(null)
  const [pwError, setPwError] = useState<string | null>(null)
  const [screen, setScreen] = useState<'start' | 'app' | 'pdf' | 'projekte'>('start')
  const [previousScreen, setPreviousScreen] = useState<'start' | 'projekte'>('start')
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [brandAccent, setBrandAccent] = useState(C.copper)
  const [brandPrimary, setBrandPrimary] = useState(C.black)
  const [profilFirmaName, setProfilFirmaName] = useState<string | null>(null)
  const [profilLogoUrl, setProfilLogoUrl] = useState<string | null>(null)
  const [nummernPrefix, setNummernPrefix] = useState('AN')
  const [nummernNaechste, setNummernNaechste] = useState(1)
  const [dokAnrede, setDokAnrede] = useState('')
  const [dokEinleitung, setDokEinleitung] = useState('')
  const [dokNachtext, setDokNachtext] = useState('')
  const [dokWiderruf, setDokWiderruf] = useState('')
  const [dokZahlung, setDokZahlung] = useState('')
  const [isMobile, setIsMobile] = useState(false)
  const [gaebDetected, setGaebDetected] = useState(false)
  const [gaebFileName, setGaebFileName] = useState('')
  const [gaebImporting, setGaebImporting] = useState(false)
  const [gaebPrompt, setGaebPrompt] = useState<string | null>(null)
  const [gaebProjektName, setGaebProjektName] = useState('')
  const [gaebPositionenCount, setGaebPositionenCount] = useState(0)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      setUserEmail(data.user?.email ?? null)
      if (data.user) {
        fetch('/api/settings/kostenstellen')
          .then(r => r.json())
          .then(d => { setUserKs(d.kostenstellen ?? []) })
          .catch(() => {})
        fetch('/api/settings/betriebsprofil')
          .then(r => r.json())
          .then(d => {
            const p = d.profil
            if (!p || p.onboarding_abgeschlossen === false) {
              setShowOnboarding(true)
              if (!p) return
            }
            const name: string = p.firma_name ?? ''
            setProfilFirmaName(name)
            setProfilLogoUrl(p.logo_url ?? null)
            setBrandAccent(p.farbe_akzent || C.copper)
            setBrandPrimary(p.farbe_primaer || C.black)
            setNummernPrefix(p.angebotsnummer_prefix ?? 'AN')
            setNummernNaechste(p.angebotsnummer_naechste ?? 1)
            setDokAnrede(p.anrede_vorlage ?? '')
            setDokEinleitung(p.angebot_einleitung ?? '')
            setDokNachtext(p.angebot_abschluss ?? '')
            setDokWiderruf(p.widerrufsbelehrung_text ?? '')
            setDokZahlung(p.zahlungskonditionen_text ?? '')
          })
          .catch(() => {})
      }
    })
  }, [])

  async function logout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  // ── Projektverwaltung ───────────────────────────────
  type ProjectMeta = { id: string; title: string; status: string; updated_at: string; created_at: string }
  const [projects, setProjects] = useState<ProjectMeta[]>([])
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [statusDropdown, setStatusDropdown] = useState<string | null>(null)
  const [projectFilterStatus, setProjectFilterStatus] = useState<string>('alle')
  const [projectSort, setProjectSort] = useState<'newest' | 'oldest' | 'az'>('newest')

  const updateProjectStatus = useCallback(async (id: string, status: string) => {
    setProjects(prev => prev.map(p => p.id === id ? { ...p, status } : p))
    setStatusDropdown(null)
    await fetch(`/api/projects/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) })
    // Tracking: Status-Änderung + Tage seit Erstellung
    setProjects(current => {
      const proj = current.find(p => p.id === id)
      const tage = proj?.created_at
        ? Math.round((Date.now() - new Date(proj.created_at).getTime()) / 86_400_000)
        : null
      fetch('/api/tracking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'status_change', projectId: id, data: { status, tage_seit_erstellung: tage } }),
      }).catch(() => {})
      return current
    })
  }, [])

  useEffect(() => {
    fetch('/api/projects').then(r => r.json()).then(d => { if (Array.isArray(d)) setProjects(d) })
  }, [])

  useEffect(() => { currentProjectIdRef.current = currentProjectId }, [currentProjectId])

  async function saveProject() {
    setSaveStatus('saving')
    const title = [kunde.name.trim(), kunde.projekt.trim()].filter(Boolean).join(' – ') || 'Ohne Titel'
    const payload = { kunde, pos, docNr, docTyp, anschr, widerruf, angebotsdatum: angebotsdatum || today() }
    try {
      let res: Response
      if (currentProjectId) {
        res = await fetch(`/api/projects/${currentProjectId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, data: payload }) })
      } else {
        res = await fetch('/api/projects', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, data: payload }) })
      }
      const row = await res.json()
      if (!res.ok) throw new Error(row.error)
      const isNew = !currentProjectId
      if (isNew) setCurrentProjectId(row.id)
      setProjects(prev => {
        const exists = prev.find(p => p.id === row.id)
        return exists ? prev.map(p => p.id === row.id ? row : p) : [row, ...prev]
      })
      if (isNew) {
        const next = nummernNaechste + 1
        setNummernNaechste(next)
        fetch('/api/settings/betriebsprofil', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ angebotsnummer_naechste: next }),
        }).catch(() => {})
      }
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 3000)
      // Outcome-Tracking initialisieren
      const savedId = currentProjectId ?? row.id
      const gesamtNetto = pos.reduce((a, p) => a + calcAngebotspos(p), 0)
      const ersteMaterial = pos.flatMap(p => p.material)[0]?.bezeichnung ?? ''
      const massivRe = /massiv|eiche|buche|nuss|fichte|kiefer/i
      const istMassiv = massivRe.test(ersteMaterial)
      fetch('/api/tracking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'outcome_init',
          projectId: savedId,
          data: {
            moebel_typ: pos[0]?.titel ?? '',
            material: ersteMaterial,
            ist_massivholz: istMassiv,
            preis_kalkuliert: gesamtNetto,
            plz: kunde.ort.trim().split(/\s+/)[0] ?? '',
          }
        })
      }).catch(() => {})
    } catch {
      setSaveStatus('error')
      setTimeout(() => setSaveStatus('idle'), 3000)
    }
  }

  async function loadProject(id: string, from: 'start' | 'projekte' = 'projekte') {
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
    if (d.angebotsdatum) setAngebotsdatum(d.angebotsdatum)
    setCurrentProjectId(id)
    setPreviousScreen(from)
    setScreen('app')
    setTab('kalkulation')
  }

  const [kunden, setKunden] = useState<KundeDB[]>(ladeKunden)
  const [kunde, setKunde] = useState<Kunde>({ name: '', zusatz: '', strasse: '', ort: '', projekt: '' })

  const [tab, setTab] = useState('kunde')
  const [pos, setPos] = useState<Angebotsposition[]>([defaultAngebotspos(Date.now())])
  const [docNr, setDocNr] = useState('AN-1')
  const [docTyp, setDocTyp] = useState('Angebot')
  const [angebotsdatum, setAngebotsdatum] = useState('')
  const [anschr, setAnschr] = useState('vielen Dank für Ihre Anfrage. Wir unterbreiten Ihnen gerne folgendes Angebot:')
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

  // Nutzer-Kostenstellen (aus Einstellungen)
  const [userKs, setUserKs] = useState<DbKostenstelle[]>([])

  // Mikrofon State
  const [micStatus, setMicStatus] = useState<'idle' | 'recording' | 'transcribing'>('idle')
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const noSleepRef = useRef<NoSleep | null>(null)
  const wakeLockRef = useRef<WakeLockSentinel | null>(null)
  const [recSeconds, setRecSeconds] = useState(0)
  const recTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  // Ref damit startAnalyse immer den aktuellen currentProjectId sieht (useCallback-Closure-Problem)
  const currentProjectIdRef = useRef<string | null>(null)
  const MAX_REC_SECONDS = 300 // 5 Minuten

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

  // ── Help-Assistent ──────────────────────────────────
  const [helpOpen, setHelpOpen] = useState(false)
  const [helpMessages, setHelpMessages] = useState<OptimChatMsg[]>([])
  const [helpInput, setHelpInput] = useState('')
  const [helpLoading, setHelpLoading] = useState(false)
  const helpChatRef = useRef<HTMLDivElement>(null)

  // ── Zentrale Materialanfrage + Export ───────────────
  const [allInquiryStatus, setAllInquiryStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [allInquiryResult, setAllInquiryResult] = useState<InquiryResult | null>(null)
  const [sendingEmail, setSendingEmail] = useState<string | null>(null) // key = `${to}__${subject}`
  const [sentEmails, setSentEmails] = useState<Set<string>>(new Set())
  // Ausgewählte Kandidaten: { [resultKey]: Set<supplierId> }
  const [selectedCandidates, setSelectedCandidates] = useState<Record<string, Set<string>>>({})
  const [copiedFeedback, setCopiedFeedback] = useState(false)
  const [exportMenuOpen, setExportMenuOpen] = useState(false)

  const startPhotoRef = useRef<HTMLInputElement>(null)
  const startPdfRef = useRef<HTMLInputElement>(null)
  const startGaebRef = useRef<HTMLInputElement>(null)

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
      ? { ...p, arbeitszeit: [...p.arbeitszeit, { id: Date.now(), kostenstelle: 'Produktion', minuten: 60, vkStunde: DEFAULT_STUNDENSAETZE['Produktion'] }] }
      : p))
  const delArbRow = (posId: number, rowId: number) =>
    setPos(prev => prev.map(p => p.id === posId
      ? { ...p, arbeitszeit: p.arbeitszeit.filter(a => a.id !== rowId) }
      : p))

  // ── Kostenstellen-Helfer (built-in + nutzer-spezifisch) ───
  const userKsMap = Object.fromEntries(userKs.map(k => [k.code, k]))
  const getKsLabel = (ks: string): string =>
    userKsMap[ks]?.bezeichnung ?? KOSTENSTELLEN_LABELS[ks as KostenstelleId] ?? ks
  const getKsGruppe = (ks: string): string | null => {
    for (const [g, members] of Object.entries(KOSTENSTELLEN_GRUPPEN)) {
      if ((members as string[]).includes(ks)) return g
    }
    return userKsMap[ks]?.gruppe ?? null
  }
  const customGroupNames = [...new Set(
    userKs.filter(k => k.aktiv && k.gruppe && !(KOSTENSTELLEN_GRUPPEN_ORDER as readonly string[]).includes(k.gruppe))
      .map(k => k.gruppe!)
  )]
  const allGroupsOrder = [...KOSTENSTELLEN_GRUPPEN_ORDER, ...customGroupNames] as string[]
  // All Kostenstellen options for dropdowns
  const allKsOptions = [
    ...(Object.keys(DEFAULT_STUNDENSAETZE) as KostenstelleId[]).map(ks => ({ code: ks, label: KOSTENSTELLEN_LABELS[ks] })),
    ...userKs.filter(k => k.aktiv && !k.ist_standard).map(k => ({ code: k.code, label: k.bezeichnung })),
  ]

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
        const imgId = Date.now() * 1000 + Math.round(Math.random() * 999)
        setUploadedFiles(prev => [
          ...prev,
          { id: imgId, name, type: 'image', previewUrl: `data:image/jpeg;base64,${b64}`, b64 },
        ])
      }
    } else if (pagesRes.status === 'rejected') {
      console.error('[renderPdfPages]', pagesRes.reason)
      // Rendering fehlgeschlagen — nur Fehler zeigen wenn auch kein Text vorhanden
      if (textRes.status === 'rejected' || textRes.value?.error) {
        setUploadedFiles(prev => prev.filter(f => f.id !== pdfId))
        setStartStatus('error')
        setStartMsg('PDF konnte nicht gerendert werden. Bitte als JPG/PNG exportieren und als Foto hochladen.')
      }
      // Wenn Text vorhanden (getippte PDFs): kein Fehler, Text wurde bereits eingefügt
    }

    setUploadingCount(prev => prev - 1)
  }, [])

  // ── KI Analyse ─────────────────────────────────────
  const callAI = useCallback(async (text: string, imageB64s: string[]) => {
    const res = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        imageBase64: imageB64s,
        userKostenstellen: userKs.filter(k => k.aktiv).map(k => ({
          code: k.code, bezeichnung: k.bezeichnung, stundensatz: k.stundensatz, gruppe: k.gruppe,
        })),
      }),
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let json: { success?: boolean; error?: string; data?: any }
    try {
      json = await res.json()
    } catch {
      if (res.status === 504) throw new Error('Die KI braucht länger – bitte nochmal versuchen.')
      throw new Error(`Server Fehler (${res.status}) – bitte erneut versuchen.`)
    }
    if (!res.ok || !json.success) throw new Error(json.error || `API Fehler: ${res.status}`)
    return json.data
  }, [userKs])

  const handleGaebFile = useCallback(async (file: File) => {
    setGaebDetected(true)
    setGaebFileName(file.name)
    setGaebImporting(true)
    setGaebPrompt(null)
    setGaebPositionenCount(0)
    try {
      const text = await file.text()
      const isXML = text.trimStart().startsWith('<') || text.includes('<GAEB') || text.includes('<BoQ')
      const { positions, projektName } = isXML ? parseGaebXML(text) : parseGaebText(text)

      if (positions.length === 0) { setGaebImporting(false); return }

      // KI-Prompt aus Positionen bauen — wird beim Klick auf Generieren verwendet
      const prompt =
        `GAEB-Leistungsverzeichnis: ${projektName}\n\n` +
        `Kalkuliere folgende Positionen mit Material- und Arbeitszeitschätzung:\n\n` +
        positions.map((p, i) => {
          const mat = p.material[0]
          const mengeZeile = mat ? `${mat.menge} ${mat.einheit}` : ''
          // Beschreibung auf 200 Zeichen kürzen um Prompt-Länge zu begrenzen
          const beschr = p.beschreibung ? p.beschreibung.slice(0, 200) : ''
          return `${i + 1}. ${p.titel}${mengeZeile ? ' · ' + mengeZeile : ''}${beschr ? ' — ' + beschr : ''}`
        }).join('\n')

      setGaebPrompt(prompt)
      setGaebProjektName(projektName)
      setGaebPositionenCount(positions.length)
    } catch (e) {
      console.error('[gaeb-parse]', e)
    }
    setGaebImporting(false)
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
        if (recTimerRef.current) { clearInterval(recTimerRef.current); recTimerRef.current = null }
        wakeLockRef.current?.release(); wakeLockRef.current = null
        noSleepRef.current?.disable(); noSleepRef.current = null
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
      setRecSeconds(0)
      recTimerRef.current = setInterval(() => {
        setRecSeconds(s => {
          if (s + 1 >= MAX_REC_SECONDS) {
            mediaRecorderRef.current?.stop()
          }
          return s + 1
        })
      }, 1000)
      // Wake Lock: native API (Android/Desktop) + NoSleep.js Fallback (iOS Safari)
      try {
        wakeLockRef.current = await navigator.wakeLock.request('screen')
      } catch { /* nicht unterstützt */ }
      try {
        if (!noSleepRef.current) noSleepRef.current = new NoSleep()
        await noSleepRef.current.enable()
      } catch { /* ignorieren */ }
    } catch {
      setStartStatus('error')
      setStartMsg('Mikrofon nicht verfügbar – bitte Zugriff in den Browser-Einstellungen erlauben.')
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
    setDocNr(`${nummernPrefix}-${nummernNaechste}`)
    setDocTyp('Angebot')
    setAnschr(dokEinleitung || 'vielen Dank für Ihre Anfrage. Wir unterbreiten Ihnen gerne folgendes Angebot:')
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
    // GAEB-States zurücksetzen
    setGaebDetected(false)
    setGaebFileName('')
    setGaebImporting(false)
    setGaebPrompt(null)
    setGaebProjektName('')
    setGaebPositionenCount(0)
    setScreen('start')
  }, [nummernPrefix, nummernNaechste, dokEinleitung])

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

  const PROGRESS_MSGS = [
    'Analysiere Projektbeschreibung…',
    'Berechne Materialmengen…',
    'Kalkuliere Arbeitszeiten…',
    'Erstelle Angebot…',
  ]

  const startAnalyse = useCallback(async (overrideText?: string) => {
    const basePart = overrideText ?? startText
    // GAEB-Prompt + optionaler Zusatztext kombinieren
    const textToUse = gaebPrompt
      ? gaebPrompt + (basePart.trim() ? '\n\nZusätzliche Informationen:\n' + basePart : '')
      : basePart
    const imageB64s = uploadedFiles.filter(f => f.type === 'image' && f.b64).map(f => f.b64!)
    if (!textToUse.trim() && imageB64s.length === 0) return
    // Projektname aus GAEB vorbelegen
    if (gaebPrompt && gaebProjektName) setKunde(prev => ({ ...prev, projekt: prev.projekt || gaebProjektName }))
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

      // Parsed-Werte in Variablen fassen (für Auto-Save, bevor State-Updates greifen)
      let parsedKunde = { name: '', zusatz: '', strasse: '', ort: '', projekt: '' }
      if (data.kunde) {
        parsedKunde = {
          name: data.kunde.name || '',
          zusatz: data.kunde.zusatz || '',
          strasse: data.kunde.strasse || '',
          ort: data.kunde.ort || '',
          projekt: data.kunde.projekt || '',
        }
        setKunde(parsedKunde)
      }

      type AIMatRow = { bezeichnung?: string; menge?: number; einheit?: string; ekPreis?: number; aufschlag?: number }
      type AIArbRow = { kostenstelle?: string; minuten?: number; vkStunde?: number }
      let parsedPos: Angebotsposition[] = []
      if (data.positionen?.length > 0) {
        parsedPos = data.positionen.map((p: Record<string, unknown>, i: number) => ({
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
            kostenstelle: (a.kostenstelle as KostenstelleId) || 'Produktion',
            minuten: a.minuten || 60,
            vkStunde: a.vkStunde || DEFAULT_STUNDENSAETZE['Produktion'],
          })),
        }))
        setPos(parsedPos)
      }

      const parsedAnschr = data.anschreiben || anschr
      if (data.anschreiben) setAnschr(parsedAnschr)

      // Kein fragen → direkt zum App-Screen + Auto-Save
      if (!data.fragen?.length) {
        setStartStatus('idle')
        setScreen('app')
        setTab(gaebPrompt ? 'kalkulation' : 'kunde')
        // GAEB-State zurücksetzen
        setGaebDetected(false)
        setGaebPrompt(null)
        setGaebProjektName('')
        setGaebPositionenCount(0)

        // Automatisch speichern (feuere-und-vergiss, kein UI-Feedback nötig)
        const projectId = currentProjectIdRef.current
        const title = [parsedKunde.name.trim(), parsedKunde.projekt.trim()].filter(Boolean).join(' – ') || 'Ohne Titel'
        const payload = { kunde: parsedKunde, pos: parsedPos, docNr, docTyp, anschr: parsedAnschr, widerruf, angebotsdatum: angebotsdatum || today() }
        fetch(
          projectId ? `/api/projects/${projectId}` : '/api/projects',
          {
            method: projectId ? 'PUT' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, data: payload }),
          }
        ).then(async r => {
          if (!r.ok) return
          const row = await r.json()
          const isNew = !projectId
          if (isNew) {
            setCurrentProjectId(row.id)
            currentProjectIdRef.current = row.id
          }
          setProjects(prev => {
            const exists = prev.find(p => p.id === row.id)
            return exists ? prev.map(p => p.id === row.id ? row : p) : [row, ...prev]
          })
          if (isNew) {
            const next = nummernNaechste + 1
            setNummernNaechste(next)
            fetch('/api/settings/betriebsprofil', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ angebotsnummer_naechste: next }) }).catch(() => {})
            const gesamtNetto = parsedPos.reduce((a: number, p: Angebotsposition) => a + calcAngebotspos(p), 0)
            const ersteMaterial = parsedPos.flatMap((p: Angebotsposition) => p.material)[0]?.bezeichnung ?? ''
            fetch('/api/tracking', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'outcome_init', projectId: row.id, data: { moebel_typ: parsedPos[0]?.titel ?? '', material: ersteMaterial, ist_massivholz: /massiv|eiche|buche|nuss|fichte|kiefer/i.test(ersteMaterial), preis_kalkuliert: gesamtNetto, plz: parsedKunde.ort.trim().split(/\s+/)[0] ?? '' } }) }).catch(() => {})
          }
        }).catch(() => {})
      }
    } catch (e: unknown) {
      setStartStatus('error')
      setStartMsg(`Fehler: ${e instanceof Error ? e.message : 'Unbekannt'}`)
    } finally {
      if (progressTimerRef.current) { clearInterval(progressTimerRef.current); progressTimerRef.current = null }
    }
  }, [startText, uploadedFiles, callAI, gaebPrompt, gaebProjektName])

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
          const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4'
          const blob = new Blob(fragenAudioChunksRef.current, { type: mimeType })
          const form = new FormData()
          form.append('audio', blob, mimeType === 'audio/webm' ? 'fragen.webm' : 'fragen.mp4')
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
      const json = await res.json() as InquiryResult
      if (!res.ok) throw new Error((json as unknown as { error?: string }).error)
      setInquiryResult(prev => ({ ...prev, [posId]: json }))
      initSelections(json, `pos-${posId}`)
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
      setOptimMessages(prev => [...prev, { role: 'assistant', content: 'Mikrofon nicht verfügbar – bitte Zugriff in den Browser-Einstellungen erlauben.' }])
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
          message: 'Prüfe das Angebot. Liste NUR die Angaben auf, die für eine präzise Kalkulation noch fehlen. Format: eine Zeile pro Punkt mit → davor. Maximal 6 Punkte, kein erklärender Text.',
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

    // Snapshot VOR der KI-Antwort für Tracking
    const nettoVorher = totals.net
    const posVorher   = pos.length
    const msgNr       = optimMessages.length + 1

    try {
      const res = await fetch('/api/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          offerData: { positionen: pos, kunde },
          chatHistory: optimMessages.slice(-10),
          message: msg,
        }),
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let json: { success?: boolean; message?: string; updatedOffer?: any; error?: string } = {}
      try { json = await res.json() } catch {
        throw new Error('Antwort konnte nicht verarbeitet werden. Bitte erneut versuchen.')
      }
      if (!res.ok) throw new Error(json.error ?? 'Unbekannter Fehler')
      setOptimMessages(prev => [...prev, { role: 'assistant', content: json.message ?? '' }])

      const hadUpdate = !!json.updatedOffer?.positionen
      let nettoNachher: number | null = null

      if (hadUpdate) {
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
        // Neuen Netto berechnen direkt aus den zurückgegebenen Positionen
        nettoNachher = json.updatedOffer.positionen.reduce(
          (sum: number, p: Angebotsposition) => sum + calcAngebotspos(p), 0
        )
      }

      // Tracking — fire & forget
      if (currentProjectId) {
        fetch('/api/tracking', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'optim_message',
            projectId: currentProjectId,
            data: {
              msg_nr:              msgNr,
              netto_vorher:        nettoVorher,
              netto_nachher:       nettoNachher,
              positionen_vorher:   posVorher,
              positionen_nachher:  hadUpdate ? (json.updatedOffer.positionen?.length ?? posVorher) : posVorher,
              had_update:          hadUpdate,
            },
          }),
        }).catch(() => {})
      }

    } catch (e: unknown) {
      setOptimMessages(prev => [...prev, { role: 'assistant', content: `Fehler: ${e instanceof Error ? e.message : 'Unbekannt'}` }])
    }
    setOptimLoading(false)
  }, [optimInput, optimLoading, optimMessages, pos, kunde, offerId, totals.net, currentProjectId])

  const restoreVersion = useCallback(async (versionId: string) => {
    try {
      const res = await fetch(`/api/offer-versions?versionId=${versionId}`)
      const json = await res.json()
      if (json.data?.positionen) setPos(json.data.positionen)
      if (json.data?.kunde) setKunde(json.data.kunde)
    } catch (e) { console.error('[restoreVersion]', e) }
  }, [])

  // ── Help-Assistent Callbacks ────────────────────────
  const openHelp = useCallback(() => {
    setHelpOpen(true)
    if (helpMessages.length === 0) {
      const greeting = screen === 'app' && tab === 'kalkulation'
        ? 'Hallo! Ich bin dein CraftFlow-Assistent. Du befindest dich gerade in der Kalkulation.\n\n→ Tipp: Die goldene KI-Optimierung-Leiste öffnet einen Chat, in dem du Änderungen direkt per Text eingeben kannst.\n\nWas kann ich dir erklären?'
        : screen === 'app' && tab === 'angebot'
        ? 'Hallo! Ich bin dein CraftFlow-Assistent. Du bist im Angebot-Reiter.\n\nHier kannst du das fertige PDF erstellen und Texte für das Angebot anpassen.\n\nHast du eine Frage?'
        : 'Hallo! Ich bin dein CraftFlow-Assistent.\n\nIch kenne die gesamte App und helfe dir bei Fragen zu Funktionen, Kalkulation oder Bedienung.\n\nWas möchtest du wissen?'
      setHelpMessages([{ role: 'assistant', content: greeting }])
    }
  }, [helpMessages.length, screen, tab])

  const sendHelpMessage = useCallback(async (overrideMsg?: string) => {
    const msg = (overrideMsg ?? helpInput).trim()
    if (!msg || helpLoading) return
    setHelpInput('')
    const newMsg: OptimChatMsg = { role: 'user', content: msg }
    setHelpMessages(prev => [...prev, newMsg])
    setHelpLoading(true)
    try {
      const res = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatHistory: helpMessages.slice(-8),
          message: msg,
          context: { screen, tab, hasProject: pos.length > 0, positionCount: pos.length, optimPanelOpen },
        }),
      })
      let json: { message?: string; error?: string } = {}
      try { json = await res.json() } catch { throw new Error('Antwort nicht lesbar') }
      if (!res.ok) throw new Error(json.error ?? 'Fehler')
      setHelpMessages(prev => [...prev, { role: 'assistant', content: json.message ?? '' }])
    } catch {
      setHelpMessages(prev => [...prev, { role: 'assistant', content: 'Entschuldigung, ich konnte die Frage gerade nicht beantworten. Bitte versuche es erneut.' }])
    }
    setHelpLoading(false)
  }, [helpInput, helpLoading, helpMessages, screen, tab, pos.length, optimPanelOpen])

  useEffect(() => {
    if (helpChatRef.current) helpChatRef.current.scrollTop = helpChatRef.current.scrollHeight
  }, [helpMessages])

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
      const json = await res.json() as InquiryResult
      if (!res.ok) throw new Error((json as unknown as { error?: string }).error)
      setAllInquiryResult(json)
      initSelections(json, 'all')
      setAllInquiryStatus('done')
    } catch {
      setAllInquiryStatus('error')
    }
  }, [pos, selectedMats])

  // ── Kandidaten-Auswahl initialisieren ───────────────
  function initSelections(result: InquiryResult, key: string) {
    const sel: Record<string, Set<string>> = {}
    for (const g of result.groups) {
      const favs = g.candidates.filter(c => c.ist_favorit).map(c => c.supplierId)
      sel[`${key}__${g.gruppe}`] = new Set(favs.length ? favs : g.candidates.slice(0, 1).map(c => c.supplierId))
    }
    setSelectedCandidates(prev => ({ ...prev, ...sel }))
  }

  function toggleCandidate(key: string, gruppe: string, supplierId: string) {
    const selKey = `${key}__${gruppe}`
    setSelectedCandidates(prev => {
      const cur = new Set(prev[selKey] ?? [])
      if (cur.has(supplierId)) { cur.delete(supplierId) } else { cur.add(supplierId) }
      return { ...prev, [selKey]: cur }
    })
  }

  // ── Pro: E-Mail direkt versenden ────────────────────
  const sendInquiryEmail = useCallback(async (to: string, subject: string, body: string) => {
    const key = `${to}__${subject}`
    setSendingEmail(key)
    try {
      const res = await fetch('/api/suppliers/inquiry/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, subject, body }),
      })
      const json = await res.json() as { success?: boolean; error?: string }
      if (!res.ok) throw new Error(json.error ?? 'Fehler')
      setSentEmails(prev => new Set([...prev, key]))
    } catch (err: unknown) {
      alert(`E-Mail konnte nicht gesendet werden: ${err instanceof Error ? err.message : 'Unbekannter Fehler'}`)
    } finally {
      setSendingEmail(null)
    }
  }, [])

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

  const exportCSV = useCallback(() => {
    const BOM = '﻿'
    const header = ['Position', 'Typ', 'Bezeichnung', 'Menge', 'Einheit', 'EK €', 'Aufschlag %', 'VK €']
    const rows: string[][] = [header]
    pos.forEach((p, pi) => {
      p.material.forEach(m => {
        const vk = m.menge * m.ekPreis * (1 + m.aufschlag)
        rows.push([String(pi + 1), 'Material', m.bezeichnung, String(m.menge), m.einheit, String(m.ekPreis), String(Math.round(m.aufschlag * 100)), String(Math.round(vk * 100) / 100)])
      })
      p.arbeitszeit.forEach(a => {
        const vk = (a.minuten / 60) * a.vkStunde
        rows.push([String(pi + 1), 'Arbeitszeit', getKsLabel(a.kostenstelle), String(Math.round(a.minuten / 60 * 100) / 100), 'h', String(a.vkStunde), '', String(Math.round(vk * 100) / 100)])
      })
    })
    rows.push([])
    rows.push(['', '', '', '', '', '', 'Netto', String(Math.round(totals.net * 100) / 100)])
    rows.push(['', '', '', '', '', '', 'MwSt. 19%', String(Math.round(totals.net * 0.19 * 100) / 100)])
    rows.push(['', '', '', '', '', '', 'Brutto', String(Math.round(totals.net * 1.19 * 100) / 100)])

    const csv = BOM + rows.map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(';')).join('\r\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `angebot_${kunde.name.trim().split(/\s+/).pop() || 'export'}_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }, [pos, kunde, totals])

  const exportXLSX = useCallback(async () => {
    const XLSX = await import('xlsx')
    const wb = XLSX.utils.book_new()

    // Header-Block
    const meta: string[][] = [
      ['CraftFlow – Kalkulation'],
      ['Kunde', kunde.name, '', 'Projekt', kunde.projekt],
      ['Adresse', `${kunde.strasse}, ${kunde.ort}`],
      ['Datum', new Date().toLocaleDateString('de-DE')],
      [],
    ]

    const tableHeader = ['Pos', 'Typ', 'Bezeichnung', 'Menge', 'Einheit', 'EK €', 'Aufschlag %', 'VK €']
    const tableRows: (string | number)[][] = []

    pos.forEach((p, pi) => {
      tableRows.push([String(pi + 1), p.titel, '', '', '', '', '', ''])
      p.material.forEach(m => {
        const vk = m.menge * m.ekPreis * (1 + m.aufschlag)
        tableRows.push(['', 'Material', m.bezeichnung, m.menge, m.einheit, m.ekPreis, Math.round(m.aufschlag * 100), Math.round(vk * 100) / 100])
      })
      p.arbeitszeit.forEach(a => {
        const vk = (a.minuten / 60) * a.vkStunde
        tableRows.push(['', 'Arbeitszeit', getKsLabel(a.kostenstelle), Math.round(a.minuten / 60 * 100) / 100, 'h', a.vkStunde, '', Math.round(vk * 100) / 100])
      })
    })

    tableRows.push([])
    tableRows.push(['', '', '', '', '', '', 'Netto', Math.round(totals.net * 100) / 100])
    tableRows.push(['', '', '', '', '', '', 'MwSt. 19%', Math.round(totals.net * 0.19 * 100) / 100])
    tableRows.push(['', '', '', '', '', '', 'Brutto', Math.round(totals.net * 1.19 * 100) / 100])

    const sheetData = [...meta, tableHeader, ...tableRows]
    const ws = XLSX.utils.aoa_to_sheet(sheetData)

    // Spaltenbreiten
    ws['!cols'] = [{ wch: 6 }, { wch: 14 }, { wch: 36 }, { wch: 8 }, { wch: 8 }, { wch: 10 }, { wch: 12 }, { wch: 12 }]

    XLSX.utils.book_append_sheet(wb, ws, 'Kalkulation')
    const filename = `angebot_${kunde.name.trim().split(/\s+/).pop() || 'export'}_${new Date().toISOString().slice(0, 10)}.xlsx`
    XLSX.writeFile(wb, filename)
  }, [pos, kunde, totals])

  const exportGAEB = useCallback(() => {
    const dateStr = new Date().toISOString().slice(0, 10)
    const projektName = [kunde.name, kunde.projekt].filter(Boolean).join(' – ') || 'Angebot'
    let itemsXml = ''
    pos.forEach((p, i) => {
      const gesamt = calcAngebotspos(p)
      const rno = String((i + 1) * 10).padStart(4, '0')
      const menge = p.material[0]?.menge ?? 1
      const einheit = p.material[0]?.einheit ?? 'Psch'
      const up = menge > 0 ? gesamt / menge : gesamt
      itemsXml += `
          <Item RNoPart="${rno}">
            <Qty>${menge.toFixed(3)}</Qty>
            <QU>${xmlEscape(einheit)}</QU>
            <Description>
              <ShortText>${xmlEscape(p.titel)}</ShortText>
              <CompleteText>
                <DetailTxt>
                  <Text><p>${xmlEscape(p.beschreibung || p.titel)}</p></Text>
                </DetailTxt>
              </CompleteText>
            </Description>
            <UP>${up.toFixed(2)}</UP>
            <T>${gesamt.toFixed(2)}</T>
          </Item>`
    })
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<GAEB xmlns="http://www.gaeb.de/GAEB_DA_XML/3.2">\n  <GAEBInfo>\n    <FileName>${xmlEscape(docNr)}.X84</FileName>\n    <Date>${dateStr}</Date>\n    <Conversion>false</Conversion>\n  </GAEBInfo>\n  <Award>\n    <DP>DA84</DP>\n  </Award>\n  <BoQ>\n    <BoQInfo>\n      <Name>${xmlEscape(projektName)}</Name>\n      <LblBoQ>Angebot</LblBoQ>\n    </BoQInfo>\n    <BoQBody>\n      <BoQCtgy RNoPart="01">\n        <LblTx><p>${xmlEscape(projektName)}</p></LblTx>\n        <BoQBody>\n          <Itemlist>${itemsXml}\n          </Itemlist>\n        </BoQBody>\n      </BoQCtgy>\n    </BoQBody>\n  </BoQ>\n</GAEB>`
    const blob = new Blob([xml], { type: 'application/xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${docNr}_${dateStr}.X84`
    a.click()
    URL.revokeObjectURL(url)
  }, [pos, kunde, docNr])

  const exportFullCSV = useCallback(() => {
    const BOM = '﻿'
    const dl = (v: string | number | null | undefined) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const num = (v: number) => String(Math.round(v * 100) / 100)
    const now = new Date()
    const dateStr = now.toLocaleDateString('de-DE')
    const projektTitel = [kunde.name, kunde.projekt].filter(Boolean).join(' – ') || 'Angebot'

    const rows: string[] = [
      dl('CRAFTFLOW EXPORT') + ';' + dl(projektTitel),
      dl('Exportiert am') + ';' + dl(dateStr),
      '',
      // ── Projektkopf ──────────────────────────────────
      dl('[PROJEKT]'),
      [dl('Feld'), dl('Wert')].join(';'),
      [dl('Angebotsnummer'), dl(docNr)].join(';'),
      [dl('Projekttitel'), dl(projektTitel)].join(';'),
      [dl('Kundename'), dl(kunde.name)].join(';'),
      [dl('Anschriftszusatz'), dl(kunde.zusatz)].join(';'),
      [dl('Strasse'), dl(kunde.strasse)].join(';'),
      [dl('Ort'), dl(kunde.ort)].join(';'),
      [dl('Angebotsdatum'), dl(angebotsdatum || today())].join(';'),
      '',
      // ── Positionen ───────────────────────────────────
      dl('[POSITIONEN]'),
      [dl('Pos-Nr'), dl('Titel'), dl('Beschreibung'), dl('Gesamt Netto EUR')].join(';'),
      ...pos.map((p, pi) => [
        dl(pi + 1), dl(p.titel), dl(p.beschreibung), dl(num(calcAngebotspos(p))),
      ].join(';')),
      '',
      // ── Material ─────────────────────────────────────
      dl('[MATERIAL]'),
      [dl('Pos-Nr'), dl('Position'), dl('Nr'), dl('Bezeichnung'), dl('Menge'), dl('Einheit'), dl('EK EUR'), dl('Aufschlag %'), dl('VK Einzel EUR'), dl('VK Gesamt EUR')].join(';'),
      ...pos.flatMap((p, pi) =>
        p.material.map((m, mi) => {
          const vkEinzel = m.ekPreis * (1 + m.aufschlag)
          const vkGesamt = m.menge * vkEinzel
          return [dl(pi + 1), dl(p.titel), dl(mi + 1), dl(m.bezeichnung), dl(m.menge), dl(m.einheit), dl(m.ekPreis), dl(Math.round(m.aufschlag * 100)), dl(num(vkEinzel)), dl(num(vkGesamt))].join(';')
        })
      ),
      '',
      // ── Arbeitszeit ──────────────────────────────────
      dl('[ARBEITSZEIT]'),
      [dl('Pos-Nr'), dl('Position'), dl('Nr'), dl('Kostenstelle'), dl('Bezeichnung'), dl('Minuten'), dl('Stunden'), dl('Stundensatz EUR'), dl('Gesamt EUR')].join(';'),
      ...pos.flatMap((p, pi) =>
        p.arbeitszeit.map((a, ai) => {
          const std = Math.round(a.minuten / 60 * 100) / 100
          const gesamt = std * a.vkStunde
          return [dl(pi + 1), dl(p.titel), dl(ai + 1), dl(a.kostenstelle), dl(getKsLabel(a.kostenstelle)), dl(a.minuten), dl(std), dl(a.vkStunde), dl(num(gesamt))].join(';')
        })
      ),
      '',
      // ── Zusammenfassung ──────────────────────────────
      dl('[ZUSAMMENFASSUNG]'),
      [dl('Position'), dl('Titel'), dl('Netto EUR')].join(';'),
      ...pos.map((p, pi) => [dl(pi + 1), dl(p.titel), dl(num(calcAngebotspos(p)))].join(';')),
      '',
      [dl(''), dl('Netto gesamt EUR'), dl(num(totals.net))].join(';'),
      [dl(''), dl('MwSt. 19 %'), dl(num(totals.net * 0.19))].join(';'),
      [dl(''), dl('Brutto EUR'), dl(num(totals.net * 1.19))].join(';'),
    ]

    const csv = BOM + rows.join('\r\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `kalkulation_vollstaendig_${(kunde.name.trim().split(/\s+/).pop() || 'export')}_${now.toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }, [pos, kunde, docNr, angebotsdatum, totals])

  const exportSQL = useCallback(() => {
    const sq = (v: string | number | null | undefined) => `'${String(v ?? '').replace(/'/g, "''")}'`
    const num = (v: number) => String(Math.round(v * 100) / 100)
    const now = new Date()
    const timestamp = now.toISOString()
    const projektTitel = [kunde.name, kunde.projekt].filter(Boolean).join(' – ') || 'Angebot'
    const netto = totals.net
    const projId = `proj_${now.getTime().toString(36)}`

    const lines: string[] = [
      '-- ============================================================',
      `-- CraftFlow SQL Export`,
      `-- Projekt: ${projektTitel}`,
      `-- Angebotsnr.: ${docNr}`,
      `-- Exportiert: ${timestamp}`,
      '-- Kompatibel mit: SQLite, MySQL, PostgreSQL, MSSQL',
      '-- ============================================================',
      '',
      '-- TABELLE: projekt',
      'CREATE TABLE IF NOT EXISTS projekt (',
      '  id          TEXT PRIMARY KEY,',
      '  angebotsnummer TEXT,',
      '  titel       TEXT,',
      '  kunde_name  TEXT,',
      '  kunde_zusatz TEXT,',
      '  kunde_strasse TEXT,',
      '  kunde_ort   TEXT,',
      '  angebotsdatum TEXT,',
      '  netto       REAL,',
      '  mwst_prozent REAL,',
      '  mwst        REAL,',
      '  brutto      REAL,',
      '  exportiert_am TEXT',
      ');',
      '',
      'INSERT INTO projekt (id, angebotsnummer, titel, kunde_name, kunde_zusatz, kunde_strasse, kunde_ort, angebotsdatum, netto, mwst_prozent, mwst, brutto, exportiert_am) VALUES (',
      `  ${sq(projId)}, ${sq(docNr)}, ${sq(projektTitel)}, ${sq(kunde.name)}, ${sq(kunde.zusatz)}, ${sq(kunde.strasse)}, ${sq(kunde.ort)},`,
      `  ${sq(angebotsdatum || today())}, ${num(netto)}, 19.0, ${num(netto * 0.19)}, ${num(netto * 1.19)}, ${sq(timestamp)}`,
      ');',
      '',
      '-- TABELLE: angebotsposition',
      'CREATE TABLE IF NOT EXISTS angebotsposition (',
      '  id              TEXT PRIMARY KEY,',
      '  projekt_id      TEXT,',
      '  positionsnummer INTEGER,',
      '  titel           TEXT,',
      '  beschreibung    TEXT,',
      '  gesamt_netto    REAL,',
      '  FOREIGN KEY (projekt_id) REFERENCES projekt(id)',
      ');',
      '',
    ]

    pos.forEach((p, pi) => {
      const posId = `pos_${pi + 1}`
      lines.push(
        `INSERT INTO angebotsposition (id, projekt_id, positionsnummer, titel, beschreibung, gesamt_netto) VALUES (`,
        `  ${sq(posId)}, ${sq(projId)}, ${pi + 1}, ${sq(p.titel)}, ${sq(p.beschreibung)}, ${num(calcAngebotspos(p))}`,
        `);`,
      )
    })

    lines.push(
      '',
      '-- TABELLE: material',
      'CREATE TABLE IF NOT EXISTS material (',
      '  id               TEXT PRIMARY KEY,',
      '  position_id      TEXT,',
      '  positionsnummer  INTEGER,',
      '  bezeichnung      TEXT,',
      '  menge            REAL,',
      '  einheit          TEXT,',
      '  ek_preis         REAL,',
      '  aufschlag_prozent REAL,',
      '  vk_einzel        REAL,',
      '  vk_gesamt        REAL,',
      '  FOREIGN KEY (position_id) REFERENCES angebotsposition(id)',
      ');',
      '',
    )

    pos.forEach((p, pi) => {
      const posId = `pos_${pi + 1}`
      p.material.forEach((m, mi) => {
        const vkEinzel = m.ekPreis * (1 + m.aufschlag)
        lines.push(
          `INSERT INTO material (id, position_id, positionsnummer, bezeichnung, menge, einheit, ek_preis, aufschlag_prozent, vk_einzel, vk_gesamt) VALUES (`,
          `  ${sq(`mat_${pi + 1}_${mi + 1}`)}, ${sq(posId)}, ${pi + 1}, ${sq(m.bezeichnung)}, ${m.menge}, ${sq(m.einheit)}, ${m.ekPreis}, ${num(m.aufschlag * 100)}, ${num(vkEinzel)}, ${num(m.menge * vkEinzel)}`,
          `);`,
        )
      })
    })

    lines.push(
      '',
      '-- TABELLE: arbeitszeit',
      'CREATE TABLE IF NOT EXISTS arbeitszeit (',
      '  id                      TEXT PRIMARY KEY,',
      '  position_id             TEXT,',
      '  positionsnummer         INTEGER,',
      '  kostenstelle            TEXT,',
      '  kostenstelle_bezeichnung TEXT,',
      '  minuten                 REAL,',
      '  stunden                 REAL,',
      '  stundensatz             REAL,',
      '  gesamt                  REAL,',
      '  FOREIGN KEY (position_id) REFERENCES angebotsposition(id)',
      ');',
      '',
    )

    pos.forEach((p, pi) => {
      const posId = `pos_${pi + 1}`
      p.arbeitszeit.forEach((a, ai) => {
        const std = Math.round(a.minuten / 60 * 100) / 100
        lines.push(
          `INSERT INTO arbeitszeit (id, position_id, positionsnummer, kostenstelle, kostenstelle_bezeichnung, minuten, stunden, stundensatz, gesamt) VALUES (`,
          `  ${sq(`az_${pi + 1}_${ai + 1}`)}, ${sq(posId)}, ${pi + 1}, ${sq(a.kostenstelle)}, ${sq(getKsLabel(a.kostenstelle))}, ${a.minuten}, ${std}, ${a.vkStunde}, ${num(std * a.vkStunde)}`,
          `);`,
        )
      })
    })

    lines.push(
      '',
      '-- ============================================================',
      '-- ZUSAMMENFASSUNG',
      '-- ============================================================',
      `-- Positionen:  ${pos.length}`,
      `-- Netto:       ${num(netto)} EUR`,
      `-- MwSt. 19%:  ${num(netto * 0.19)} EUR`,
      `-- Brutto:      ${num(netto * 1.19)} EUR`,
      '',
    )

    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `kalkulation_${(kunde.name.trim().split(/\s+/).pop() || 'export')}_${now.toISOString().slice(0, 10)}.sql`
    a.click()
    URL.revokeObjectURL(url)
  }, [pos, kunde, docNr, angebotsdatum, totals])

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
     ONBOARDING MODAL
  ══════════════════════════════════════════════════ */
  const OnboardingModal = showOnboarding ? (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: '#141414', border: '2px solid ' + C.copper, borderRadius: 12, padding: '32px 28px', width: '100%', maxWidth: 400, fontFamily: 'Helvetica Neue,sans-serif' }}>
        <div style={{ color: C.copper, fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 8 }}>Willkommen bei CraftFlow</div>
        <h2 style={{ color: C.white, fontSize: 20, fontWeight: 800, marginBottom: 12, letterSpacing: -0.3 }}>Einstellungen hinterlegen</h2>
        <p style={{ color: '#8A8A8A', fontSize: 13, lineHeight: 1.65, marginBottom: 24 }}>
          Damit die KI mit deinen individuellen Stundensätzen und Materialaufschlägen kalkuliert, hinterleg einmalig deine Betriebsdaten. Das dauert 2 Minuten.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button
            onClick={() => {
              fetch('/api/settings/betriebsprofil', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ onboarding_abgeschlossen: true }) })
              setShowOnboarding(false)
              window.location.href = '/settings'
            }}
            style={{ background: C.copper, color: C.black, border: 'none', borderRadius: 8, padding: '14px', fontSize: 14, fontWeight: 800, cursor: 'pointer', fontFamily: 'Helvetica Neue,sans-serif', letterSpacing: 0.3 }}
          >
            Jetzt Einstellungen öffnen
          </button>
          <button
            onClick={() => {
              fetch('/api/settings/betriebsprofil', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ onboarding_abgeschlossen: true }) })
              setShowOnboarding(false)
            }}
            style={{ background: 'transparent', color: '#8A8A8A', border: '1px solid ' + C.border, borderRadius: 8, padding: '12px', fontSize: 13, cursor: 'pointer', fontFamily: 'Helvetica Neue,sans-serif' }}
          >
            Später – direkt loslegen
          </button>
        </div>
      </div>
    </div>
  ) : null

  /* ══════════════════════════════════════════════════
     PAYWALL: Trial abgelaufen, kein aktiver Plan
  ══════════════════════════════════════════════════ */
  if (isBlocked) {
    const PAYWALL_PLANS = [
      { id: 'solo',       name: 'Solo',       price: 7,  priceId: 'price_1Tn1xzRvozvhvO9JJ3og0R3w', highlight: 'Einstieg',    features: ['3 Angebote / Monat', 'KI-Kalkulation', 'PDF-Angebot'] },
      { id: 'starter',    name: 'Starter',    price: 29, priceId: 'price_1Tn1y0RvozvhvO9JK7pRRRht', highlight: 'Beliebt',     features: ['15 Angebote / Monat', 'Bilder & PDFs', 'CSV-Export', 'Lieferantenanfrage'] },
      { id: 'pro',        name: 'Pro',        price: 49, priceId: 'price_1Tn1y0RvozvhvO9J4QXMCzje', highlight: 'Wachstum',    features: ['50 Angebote / Monat', 'Eigene E-Mail (SMTP)', 'Bis zu 3 Nutzer'] },
      { id: 'enterprise', name: 'Enterprise', price: 79, priceId: 'price_1Tn1y1RvozvhvO9JYlX8lp4z', highlight: 'Vollzugang',  features: ['Unbegrenzt Angebote', 'GAEB-Import', 'Priorisierter Support'] },
    ]

    async function startCheckout(priceId: string) {
      setPwLoading(priceId)
      setPwError(null)
      try {
        const res = await fetch('/api/stripe/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ priceId }),
        })
        const { url, error } = await res.json()
        if (error || !url) { setPwError('Fehler beim Öffnen des Checkouts.'); setPwLoading(null); return }
        window.location.href = url
      } catch {
        setPwError('Netzwerkfehler – bitte erneut versuchen.')
        setPwLoading(null)
      }
    }

    return (
      <div suppressHydrationWarning style={{ fontFamily: 'Helvetica Neue,Helvetica,Arial,sans-serif', background: C.black, minHeight: '100vh', color: C.white, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px 16px 64px' }}>
        {/* Header */}
        <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: C.white, marginBottom: 8, textAlign: 'center' }}>
          Testzeitraum abgelaufen
        </h1>
        <p style={{ fontSize: 14, color: C.textMid, textAlign: 'center', maxWidth: 420, lineHeight: 1.6, marginBottom: 8 }}>
          Deine 14-tägige Testversion ist abgelaufen. Wähle einen Plan um weiterzumachen — alle Pläne sind monatlich kündbar.
        </p>
        <p style={{ fontSize: 12, color: C.textMid, marginBottom: 36, textAlign: 'center' }}>
          Gutscheincode? <span onClick={() => window.location.href = '/settings'} style={{ color: C.copper, cursor: 'pointer', textDecoration: 'underline' }}>Hier einlösen →</span>
        </p>

        {pwError && (
          <div style={{ background: 'rgba(224,90,90,.1)', border: '1px solid #E05A5A', borderRadius: 6, padding: '10px 16px', marginBottom: 20, fontSize: 13, color: '#E05A5A' }}>
            {pwError}
          </div>
        )}

        {/* Plan-Karten */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: 16, width: '100%', maxWidth: 720 }}>
          {PAYWALL_PLANS.map(plan => {
            const isLoading = pwLoading === plan.priceId
            const isEnterprise = plan.id === 'enterprise'
            return (
              <div key={plan.id} style={{
                background: isEnterprise ? '#1a1510' : C.gray1,
                border: `2px solid ${isEnterprise ? C.copper : C.border}`,
                borderRadius: 10, padding: '22px 20px',
                display: 'flex', flexDirection: 'column', gap: 14, position: 'relative',
              }}>
                <div style={{ position: 'absolute', top: -10, left: 16, background: isEnterprise ? C.copper : C.gray2, color: isEnterprise ? C.black : C.textMid, fontSize: 9, fontWeight: 800, letterSpacing: 1.5, padding: '3px 10px', borderRadius: 20 }}>
                  {plan.highlight.toUpperCase()}
                </div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: C.white }}>{plan.name}</div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: isEnterprise ? C.copper : C.white, lineHeight: 1.1, marginTop: 2 }}>
                    {plan.price} €<span style={{ fontSize: 13, fontWeight: 400, color: C.textMid }}> / Monat</span>
                  </div>
                  <div style={{ fontSize: 10, color: C.textMid, marginTop: 2, letterSpacing: 0.3 }}>zzgl. gesetzl. MwSt.</div>
                </div>
                <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
                  {plan.features.map(f => (
                    <li key={f} style={{ fontSize: 12, color: C.textMid, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                      <span style={{ color: C.copper, flexShrink: 0, fontWeight: 700 }}>✓</span>{f}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => startCheckout(plan.priceId)}
                  disabled={!!pwLoading}
                  style={{
                    background: isEnterprise ? C.copper : C.gray2,
                    color: isEnterprise ? C.black : C.white,
                    border: `1px solid ${isEnterprise ? C.copper : C.border}`,
                    borderRadius: 6, padding: '11px 0', fontSize: 13, fontWeight: 700,
                    cursor: pwLoading ? 'not-allowed' : 'pointer',
                    fontFamily: 'Helvetica Neue, sans-serif', width: '100%',
                    opacity: pwLoading && !isLoading ? 0.5 : 1,
                  }}
                >
                  {isLoading ? '…' : `${plan.name} abonnieren`}
                </button>
              </div>
            )
          })}
        </div>

        <p style={{ marginTop: 24, fontSize: 12, color: C.textMid, textAlign: 'center' }}>
          Alle Preise in Euro, netto zzgl. gesetzlicher MwSt. · Monatlich kündbar · Nur für Unternehmen (B2B) · Sichere Zahlung via Stripe
        </p>
      </div>
    )
  }

  /* ── Help-Widget (alle Screens) ───────────────────── */
  const HelpWidget = (
    <>
      {!helpOpen && (
        <button onClick={openHelp} title="CraftFlow Assistent" style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 500,
          width: 52, height: 52, borderRadius: '50%',
          background: C.copper, border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 20px rgba(200,136,90,0.5)',
          fontSize: 22, color: C.black, fontWeight: 800,
        }}>?</button>
      )}
      {helpOpen && (
        <div style={{
          position: 'fixed', bottom: 0, right: 0, zIndex: 500,
          width: isMobile ? '100%' : 380,
          height: isMobile ? '100%' : 560,
          background: C.darkbg, borderTop: `2px solid ${C.copper}`,
          borderLeft: isMobile ? 'none' : `2px solid ${C.copper}`,
          display: 'flex', flexDirection: 'column',
          fontFamily: 'Helvetica Neue,Helvetica,Arial,sans-serif',
        }}>
          <div style={{ padding: '12px 14px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
            <div>
              <div style={{ color: C.copper, fontWeight: 800, fontSize: 13, letterSpacing: 1 }}>✦ CRAFTFLOW ASSISTENT</div>
              <div style={{ color: C.textMid, fontSize: 10 }}>Fragen · Hilfe · Erste Schritte</div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button onClick={() => sendHelpMessage('Zeig mir die Erste Schritte Anleitung')} style={{ background: '#2a1f14', color: C.copper, border: `1px solid ${C.copper}`, borderRadius: 4, padding: '4px 8px', fontSize: 10, fontWeight: 700, cursor: 'pointer', letterSpacing: 0.5 }}>
                ERSTE SCHRITTE
              </button>
              <button onClick={() => setHelpOpen(false)} style={{ background: 'transparent', border: 'none', color: C.textMid, cursor: 'pointer', fontSize: 20, lineHeight: 1, padding: 4 }}>×</button>
            </div>
          </div>
          <div ref={helpChatRef} style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {helpMessages.map((msg, i) => (
              <div key={i} style={{
                alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '88%',
                background: msg.role === 'user' ? C.copper : '#1e1e1e',
                color: msg.role === 'user' ? C.black : C.white,
                borderRadius: msg.role === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                padding: '9px 12px', fontSize: 12, lineHeight: 1.5,
              }}>
                {msg.content.split('\n').map((line, li) => {
                  if (line.startsWith('→ ')) return (
                    <div key={li} style={{ display: 'flex', gap: 6, marginBottom: 2 }}>
                      <span style={{ color: msg.role === 'user' ? C.black : C.copper, fontWeight: 700, flexShrink: 0 }}>→</span>
                      <span>{line.slice(2)}</span>
                    </div>
                  )
                  if (line === '') return li === 0 ? null : <div key={li} style={{ height: 5 }} />
                  return <div key={li}>{line}</div>
                })}
              </div>
            ))}
            {helpLoading && (
              <div style={{ alignSelf: 'flex-start', background: '#1e1e1e', borderRadius: '12px 12px 12px 2px', padding: '9px 14px', fontSize: 12, color: C.textMid }}>···</div>
            )}
          </div>
          <div style={{ padding: '10px 12px', borderTop: `1px solid ${C.border}`, flexShrink: 0, display: 'flex', gap: 8 }}>
            <input
              value={helpInput}
              onChange={e => setHelpInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendHelpMessage()}
              placeholder="Frage stellen …"
              disabled={helpLoading}
              style={{ flex: 1, background: '#1a1a1a', border: `1px solid ${C.border}`, borderRadius: 6, color: C.white, padding: '8px 10px', fontSize: 12, fontFamily: 'Helvetica Neue,sans-serif', outline: 'none', opacity: helpLoading ? 0.5 : 1 }}
            />
            <button
              onClick={() => sendHelpMessage()}
              disabled={!helpInput.trim() || helpLoading}
              style={{ background: helpInput.trim() && !helpLoading ? C.copper : '#3a2a1a', color: helpInput.trim() && !helpLoading ? C.black : '#6a4a2a', border: 'none', borderRadius: 6, padding: '8px 14px', fontSize: 12, fontWeight: 700, cursor: helpInput.trim() && !helpLoading ? 'pointer' : 'not-allowed' }}
            >→</button>
          </div>
        </div>
      )}
    </>
  )

  /* ══════════════════════════════════════════════════
     SCREEN: PDF
  ══════════════════════════════════════════════════ */
  if (screen === 'projekte') {
    const statusColors: Record<string, { color: string; label: string }> = {
      gewonnen:   { color: '#5ABE6A', label: 'Gewonnen' },
      verhandelt: { color: brandAccent, label: 'Verhandelt' },
      verloren:   { color: '#E05A5A', label: 'Verloren' },
      offen:      { color: C.textMid, label: 'Offen' },
    }
    return (
      <div suppressHydrationWarning style={{ fontFamily: 'Helvetica Neue,Helvetica,Arial,sans-serif', background: C.black, minHeight: '100vh', color: C.white }}>
        {/* Header */}
        <div style={{ background: C.darkbg, padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `2px solid ${brandAccent}`, gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <LogoMark size={32} userLogoUrl={profilLogoUrl} />
            <div style={{ color: brandAccent, fontSize: 14, fontWeight: 800, letterSpacing: 3 }}>MEINE PROJEKTE</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 4 : 6, flexShrink: 0 }}>
            <button onClick={resetAll} style={{ background: brandAccent, color: C.black, border: 'none', borderRadius: 6, padding: isMobile ? '8px 10px' : '9px 12px', cursor: 'pointer', fontSize: 16, fontFamily: 'Helvetica Neue,sans-serif', fontWeight: 800, lineHeight: 1 }} title="Neues Angebot">✏️</button>
            <button onClick={() => setScreen('projekte')} style={{ background: 'transparent', color: C.textMid, border: `1px solid ${C.border}`, borderRadius: 6, padding: isMobile ? '7px 9px' : '9px 11px', cursor: 'pointer', fontSize: 16, fontFamily: 'Helvetica Neue,sans-serif', lineHeight: 1 }} title="Meine Projekte">📋</button>
            <button onClick={() => window.location.href = '/settings'} style={{ background: 'transparent', color: C.textMid, border: `1px solid ${C.border}`, borderRadius: 6, padding: isMobile ? '7px 9px' : '9px 11px', cursor: 'pointer', fontSize: 16, fontFamily: 'Helvetica Neue,sans-serif', lineHeight: 1 }} title="Einstellungen">⚙️</button>
            {userEmail && (
              <button onClick={logout} style={{ background: 'transparent', color: C.textMid, border: `1px solid ${C.border}`, borderRadius: 6, padding: isMobile ? '7px 9px' : '9px 11px', cursor: 'pointer', fontSize: 16, fontFamily: 'Helvetica Neue,sans-serif', lineHeight: 1 }} title="Abmelden">🚪</button>
            )}
          </div>
        </div>

        {/* Filter + Sort */}
        {projects.length > 0 && (
          <div style={{ maxWidth: 700, margin: '0 auto', padding: '16px 16px 0' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', justifyContent: 'space-between' }}>
              {/* Status-Filter */}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {(['alle', 'offen', 'gewonnen', 'verhandelt', 'verloren'] as const).map(f => {
                  const sc = f === 'alle' ? { color: C.textMid, label: 'Alle' } : (statusColors[f] ?? { color: C.textMid, label: f })
                  const active = projectFilterStatus === f
                  return (
                    <button key={f} onClick={() => setProjectFilterStatus(f)}
                      style={{ fontSize: 11, fontWeight: 700, padding: '5px 12px', borderRadius: 20, border: `1px solid ${active ? sc.color : C.border}`, background: active ? sc.color + '22' : 'transparent', color: active ? sc.color : C.textMid, cursor: 'pointer', fontFamily: 'Helvetica Neue,sans-serif', transition: 'all .15s' }}>
                      {sc.label}
                    </button>
                  )
                })}
              </div>
              {/* Sortierung */}
              <div style={{ display: 'flex', gap: 6 }}>
                {([['newest', 'Neueste'], ['oldest', 'Älteste'], ['az', 'A–Z']] as const).map(([val, label]) => (
                  <button key={val} onClick={() => setProjectSort(val)}
                    style={{ fontSize: 11, fontWeight: 700, padding: '5px 10px', borderRadius: 20, border: `1px solid ${projectSort === val ? brandAccent : C.border}`, background: projectSort === val ? brandAccent + '22' : 'transparent', color: projectSort === val ? brandAccent : C.textMid, cursor: 'pointer', fontFamily: 'Helvetica Neue,sans-serif', transition: 'all .15s' }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Liste */}
        <div style={{ maxWidth: 700, margin: '0 auto', padding: '16px 16px 28px' }}>
          {projects.length === 0 ? (
            <div style={{ textAlign: 'center', paddingTop: 80, color: C.textMid }}>
              <div style={{ fontSize: 40, marginBottom: 16 }}>📋</div>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: C.white }}>Noch keine Projekte</div>
              <div style={{ fontSize: 12 }}>Erstelle ein neues Angebot und speichere es.</div>
              <button
                onClick={resetAll}
                style={{ marginTop: 24, background: brandAccent, color: C.black, border: 'none', borderRadius: 6, padding: '11px 22px', cursor: 'pointer', fontSize: 13, fontFamily: 'Helvetica Neue,sans-serif', fontWeight: 800 }}
              >+ Neues Projekt</button>
            </div>
          ) : (() => {
            const filtered = projects
              .filter(p => {
                if (projectFilterStatus === 'alle') return true
                if (projectFilterStatus === 'offen') return p.status === 'offen' || p.status === 'entwurf' || !p.status
                return p.status === projectFilterStatus
              })
              .sort((a, b) => {
                if (projectSort === 'az') return a.title.localeCompare(b.title, 'de')
                if (projectSort === 'oldest') return new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime()
                return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
              })
            if (filtered.length === 0) return (
              <div style={{ textAlign: 'center', paddingTop: 60, color: C.textMid }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>🔍</div>
                <div style={{ fontSize: 13 }}>Keine Projekte mit diesem Filter.</div>
                <button onClick={() => setProjectFilterStatus('alle')} style={{ marginTop: 16, background: 'transparent', color: brandAccent, border: `1px solid ${brandAccent}`, borderRadius: 6, padding: '8px 18px', cursor: 'pointer', fontSize: 12, fontFamily: 'Helvetica Neue,sans-serif' }}>Filter zurücksetzen</button>
              </div>
            )
            return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {filtered.map(p => {
                const sc = statusColors[p.status] ?? statusColors['offen']
                return (
                  <div
                    key={p.id}
                    onClick={() => loadProject(p.id)}
                    style={{ background: C.darkbg, border: `1px solid ${C.border}`, borderRadius: 10, padding: '16px 18px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: C.white, marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</div>
                      <div style={{ fontSize: 11, color: C.textMid }}>
                        {new Date(p.updated_at).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                      <div style={{ position: 'relative' }}>
                        <button
                          onClick={e => { e.stopPropagation(); setStatusDropdown(statusDropdown === p.id ? null : p.id) }}
                          style={{ fontSize: 11, fontWeight: 700, color: sc.color, background: sc.color + '18', padding: '4px 10px', borderRadius: 20, border: `1px solid ${sc.color}44`, whiteSpace: 'nowrap', cursor: 'pointer', fontFamily: 'Helvetica Neue,sans-serif' }}
                        >
                          {sc.label} ▾
                        </button>
                        {statusDropdown === p.id && (
                          <>
                            <div style={{ position: 'fixed', inset: 0, zIndex: 49 }} onClick={e => { e.stopPropagation(); setStatusDropdown(null) }} />
                            <div style={{ position: 'absolute', top: '110%', right: 0, background: C.gray1, border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden', zIndex: 50, minWidth: 150, boxShadow: '0 4px 20px rgba(0,0,0,.6)' }}>
                              {Object.entries(statusColors).map(([key, val]) => (
                                <button
                                  key={key}
                                  onClick={e => { e.stopPropagation(); updateProjectStatus(p.id, key) }}
                                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: p.status === key ? C.gray2 : 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'Helvetica Neue,sans-serif', textAlign: 'left' as const }}
                                >
                                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: val.color, flexShrink: 0 }} />
                                  <span style={{ fontSize: 13, color: p.status === key ? C.white : C.textMid, fontWeight: p.status === key ? 700 : 400 }}>{val.label}</span>
                                  {p.status === key && <span style={{ marginLeft: 'auto', color: val.color, fontSize: 12 }}>✓</span>}
                                </button>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                      <button
                        onClick={e => { e.stopPropagation(); loadProject(p.id) }}
                        style={{ background: C.gray2, color: C.white, border: `1px solid ${C.border}`, borderRadius: 6, padding: '7px 14px', cursor: 'pointer', fontSize: 12, fontFamily: 'Helvetica Neue,sans-serif', fontWeight: 600, whiteSpace: 'nowrap' }}
                      >Öffnen →</button>
                    </div>
                  </div>
                )
              })}
            </div>
            )
          })()}
        </div>
      {HelpWidget}
      </div>
    )
  }

  if (screen === 'pdf') {
    return (
      <div suppressHydrationWarning style={{ fontFamily: 'Helvetica Neue,sans-serif', background: C.black, minHeight: '100vh' }}>
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
      {HelpWidget}
      </div>
    )
  }

  /* ══════════════════════════════════════════════════
     SCREEN: START
  ══════════════════════════════════════════════════ */
  if (screen === 'start') {
    const canGenerate = !!(startText.trim() || uploadedFiles.some(f => f.type === 'image' && f.b64) || gaebPrompt)
    const loading = startStatus === 'loading'
    const isRecording = micStatus === 'recording'
    const isTranscribing = micStatus === 'transcribing'

    return (
      <div suppressHydrationWarning style={{ fontFamily: 'Helvetica Neue,Helvetica,Arial,sans-serif', background: C.black, minHeight: '100vh', color: C.white }}>
        {OnboardingModal}
        {isInTrial && (
          <div onClick={() => window.location.href = '/settings#plan'} style={{ background: `${C.copper}18`, borderBottom: `1px solid ${C.copper}55`, padding: '8px 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, cursor: 'pointer' }}>
            <span style={{ fontSize: 14 }}>🎁</span>
            <span style={{ fontSize: 12, color: C.copper, fontFamily: 'Helvetica Neue,sans-serif' }}>
              <strong>{trialDaysLeft} {trialDaysLeft === 1 ? 'Tag' : 'Tage'}</strong> Testversion verbleiben — alle Funktionen freigeschaltet
            </span>
            <span style={{ fontSize: 11, color: C.textMid, marginLeft: 4 }}>Plan wählen →</span>
          </div>
        )}
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
        <div style={{ background: C.darkbg, padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `2px solid ${brandAccent}`, gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flexShrink: 1 }}>
            <LogoMark size={34} userLogoUrl={profilLogoUrl} />
            <div style={{ minWidth: 0 }}>
              <div style={{ color: brandAccent, fontSize: 15, fontWeight: 800, letterSpacing: 3, whiteSpace: 'nowrap' }}>CRAFTFLOW</div>
              {profilFirmaName && !isMobile && <div style={{ color: C.textMid, fontSize: 9, letterSpacing: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 120 }}>{profilFirmaName.toUpperCase()}</div>}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 4 : 6, flexShrink: 0 }}>
            <button
              onClick={resetAll}
              style={{ background: brandAccent, color: C.black, border: 'none', borderRadius: 6, padding: isMobile ? '8px 10px' : '9px 12px', cursor: 'pointer', fontSize: 16, fontFamily: 'Helvetica Neue,sans-serif', fontWeight: 800, lineHeight: 1 }}
              title="Neues Angebot"
            >
              ✏️
            </button>
            <button onClick={() => setScreen('projekte')} style={{ background: 'transparent', color: C.textMid, border: `1px solid ${C.border}`, borderRadius: 6, padding: isMobile ? '7px 9px' : '9px 11px', cursor: 'pointer', fontSize: 16, fontFamily: 'Helvetica Neue,sans-serif', lineHeight: 1 }} title="Meine Projekte">
              📋
            </button>
            <button onClick={() => window.location.href = '/settings'} style={{ background: 'transparent', color: C.textMid, border: `1px solid ${C.border}`, borderRadius: 6, padding: isMobile ? '7px 9px' : '9px 11px', cursor: 'pointer', fontSize: 16, fontFamily: 'Helvetica Neue,sans-serif', lineHeight: 1 }} title="Einstellungen">
              ⚙️
            </button>
            {userEmail && (
              <button onClick={logout} style={{ background: 'transparent', color: C.textMid, border: `1px solid ${C.border}`, borderRadius: 6, padding: isMobile ? '7px 9px' : '9px 11px', cursor: 'pointer', fontSize: 16, fontFamily: 'Helvetica Neue,sans-serif', lineHeight: 1 }} title="Abmelden">
                🚪
              </button>
            )}
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
              {micStatus === 'recording' && (
                <span>
                  {'● '}
                  {String(Math.floor(recSeconds / 60)).padStart(2, '0')}:{String(recSeconds % 60).padStart(2, '0')}
                  {recSeconds >= MAX_REC_SECONDS - 30 ? <span style={{ color: '#ff4444', marginLeft: 8 }}>⚠ Max. 5 Min.</span> : ' – zum Stoppen tippen'}
                </span>
              )}
              {micStatus === 'transcribing' && 'Wird transkribiert…'}
            </div>
          </div>

          {/* Foto / PDF-Button */}
          <div style={{ marginBottom: 14 }}>
            {/* Separate inputs per Dateityp — behebt iOS Multi-Select-Bug bei gemischtem accept */}
            <input ref={startPhotoRef} type="file" accept="image/jpeg,image/png,image/heic,image/heif,image/webp,image/*" multiple
              onChange={e => { const files = Array.from(e.target.files ?? []); e.target.value = ''; files.forEach(f => loadBild(f)) }}
              style={{ display: 'none' }} />
            <input ref={startPdfRef} type="file" accept="application/pdf,.pdf" multiple
              onChange={e => { const files = Array.from(e.target.files ?? []); e.target.value = ''; files.forEach(f => handlePdfUpload(f)) }}
              style={{ display: 'none' }} />
            <input ref={startGaebRef} type="file" accept={GAEB_EXTENSIONS.join(',')}
              onChange={e => { const files = Array.from(e.target.files ?? []); e.target.value = ''; files.forEach(f => { if (!planCanUse('enterprise')) { window.location.href = '/settings#plan'; return }; handleGaebFile(f) }) }}
              style={{ display: 'none' }} />
            {/* Upload-Fläche – plan-basiert */}
            <div
              style={{
                width: '100%', borderRadius: 10, cursor: uploadingCount > 0 ? 'wait' : 'pointer',
                border: `2px dashed ${uploadedFiles.length > 0 ? C.copper : C.border}`,
                background: uploadedFiles.length > 0 ? `${C.copper}10` : C.gray1,
                overflow: 'hidden',
              }}
            >
              {/* Kopfzeile */}
              <div style={{ padding: '12px 14px 10px', display: 'flex', alignItems: 'center', gap: 8, borderBottom: `1px solid ${C.border}` }}>
                <span style={{ fontSize: 18 }}>{uploadingCount > 0 ? '⟳' : uploadedFiles.length > 0 ? '✓' : '📎'}</span>
                <span style={{ fontSize: 12, color: uploadedFiles.length > 0 ? C.copper : C.textMid, fontFamily: 'Helvetica Neue,sans-serif', fontWeight: 600 }}>
                  {uploadingCount > 0 ? 'Wird verarbeitet…' : uploadedFiles.length > 0 ? `${uploadedFiles.length} Datei${uploadedFiles.length > 1 ? 'en' : ''} hochgeladen – weitere hinzufügen` : 'Dateien hochladen'}
                </span>
              </div>
              {/* Feature-Chips — jeder öffnet seinen eigenen Picker */}
              <div style={{ padding: '10px 14px', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {/* Fotos – ab Starter */}
                <div
                  onClick={() => { if (!planCanUse('starter')) { window.location.href = '/settings#plan'; return }; if (uploadingCount === 0) startPhotoRef.current?.click() }}
                  style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 20, background: planCanUse('starter') ? `${C.copper}20` : C.gray1, border: `1px solid ${planCanUse('starter') ? C.copper + '55' : C.border}`, opacity: planCanUse('starter') ? 1 : 0.5, cursor: 'pointer' }}>
                  <span style={{ fontSize: 13 }}>{planCanUse('starter') ? '📷' : '🔒'}</span>
                  <span style={{ fontSize: 11, color: planCanUse('starter') ? C.white : C.textMid, fontFamily: 'Helvetica Neue,sans-serif', fontWeight: 600 }}>Fotos</span>
                  {!planCanUse('starter') && <span style={{ fontSize: 9, color: C.copper, fontFamily: 'Helvetica Neue,sans-serif', fontWeight: 700 }}>AB STARTER</span>}
                </div>
                {/* PDFs – ab Starter */}
                <div
                  onClick={() => { if (!planCanUse('starter')) { window.location.href = '/settings#plan'; return }; if (uploadingCount === 0) startPdfRef.current?.click() }}
                  style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 20, background: planCanUse('starter') ? `${C.copper}20` : C.gray1, border: `1px solid ${planCanUse('starter') ? C.copper + '55' : C.border}`, opacity: planCanUse('starter') ? 1 : 0.5, cursor: 'pointer' }}>
                  <span style={{ fontSize: 13 }}>{planCanUse('starter') ? '📄' : '🔒'}</span>
                  <span style={{ fontSize: 11, color: planCanUse('starter') ? C.white : C.textMid, fontFamily: 'Helvetica Neue,sans-serif', fontWeight: 600 }}>PDFs</span>
                  {!planCanUse('starter') && <span style={{ fontSize: 9, color: C.copper, fontFamily: 'Helvetica Neue,sans-serif', fontWeight: 700 }}>AB STARTER</span>}
                </div>
                {/* GAEB – ab Enterprise */}
                <div
                  onClick={() => { if (!planCanUse('enterprise')) { window.location.href = '/settings#plan'; return }; if (uploadingCount === 0) startGaebRef.current?.click() }}
                  style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 20, background: planCanUse('enterprise') ? `${C.copper}20` : C.gray1, border: `1px solid ${planCanUse('enterprise') ? C.copper + '55' : C.border}`, opacity: planCanUse('enterprise') ? 1 : 0.5, cursor: 'pointer' }}>
                  <span style={{ fontSize: 13 }}>{planCanUse('enterprise') ? '🏗' : '🔒'}</span>
                  <span style={{ fontSize: 11, color: planCanUse('enterprise') ? C.white : C.textMid, fontFamily: 'Helvetica Neue,sans-serif', fontWeight: 600 }}>GAEB (.X83 / .X84)</span>
                  {!planCanUse('enterprise') && <span style={{ fontSize: 9, color: C.copper, fontFamily: 'Helvetica Neue,sans-serif', fontWeight: 700 }}>AB ENTERPRISE</span>}
                </div>
              </div>
            </div>
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
            {gaebDetected && (
              <div style={{ marginTop: 10, borderRadius: 6, border: `1px solid ${C.copper}55`, background: `${C.copper}0A`, padding: '12px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 16 }}>🏗</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, color: C.copper, fontWeight: 700 }}>{gaebFileName}</div>
                    <div style={{ fontSize: 11, color: C.textMid, marginTop: 2 }}>
                      {gaebImporting
                        ? '⟳ Datei wird eingelesen…'
                        : gaebPrompt
                        ? `${gaebPositionenCount} Position${gaebPositionenCount !== 1 ? 'en' : ''} erkannt`
                        : 'Keine Positionen gefunden – bitte GAEB DA-XML verwenden'}
                    </div>
                  </div>
                  {!gaebImporting && (
                    <button
                      onClick={() => { setGaebDetected(false); setGaebPrompt(null); setGaebFileName(''); setGaebPositionenCount(0) }}
                      style={{ background: 'none', border: 'none', color: C.textMid, fontSize: 16, cursor: 'pointer', padding: 0, lineHeight: 1, flexShrink: 0 }}
                    >×</button>
                  )}
                </div>
                {gaebPrompt && (
                  <div style={{ marginTop: 8, fontSize: 11, color: C.textMid, borderTop: `1px solid ${C.border}`, paddingTop: 8 }}>
                    Ergänze bei Bedarf weitere Informationen im Textfeld unten — dann auf <strong style={{ color: C.copper }}>Kalkulation generieren</strong> klicken.
                  </div>
                )}
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
            onClick={() => { if (!loading && canGenerate) startAnalyse() }}
            disabled={!canGenerate || loading}
            style={{
              width: '100%', marginTop: 14,
              background: !canGenerate && !loading ? C.gray2 : C.copper,
              color: !canGenerate && !loading ? C.textMid : C.black,
              border: 'none', borderRadius: 10, padding: '18px 0',
              cursor: loading ? 'wait' : !canGenerate ? 'not-allowed' : 'pointer',
              fontSize: 17, fontFamily: 'Helvetica Neue,sans-serif',
              fontWeight: 800, letterSpacing: 2,
              opacity: loading ? 0.85 : 1,
            }}
          >
            {loading ? '⟳  KI erstellt Kalkulation…' : '⚡ KALKULATION GENERIEREN'}
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

      {HelpWidget}
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
      {OnboardingModal}

      {/* Header */}
      <div style={{ background: C.darkbg, padding: '11px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `2px solid ${brandAccent}`, gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flexShrink: 1 }}>
          <LogoMark size={30} userLogoUrl={profilLogoUrl} />
          <div style={{ minWidth: 0 }}>
            <div style={{ color: brandAccent, fontSize: 13, fontWeight: 800, letterSpacing: 2, whiteSpace: 'nowrap' }}>CRAFTFLOW</div>
            {profilFirmaName && <div style={{ color: C.textMid, fontSize: 8, letterSpacing: 1, whiteSpace: 'nowrap' }}>{profilFirmaName.toUpperCase()}</div>}
          </div>
          <div style={{ color: C.white, fontSize: 11, fontWeight: 600, maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginLeft: 6 }}>
            {kunde.name || '–'}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 4 : 6, flexShrink: 0 }}>
          <button onClick={resetAll} style={{ background: brandAccent, color: C.black, border: 'none', borderRadius: 6, padding: isMobile ? '8px 10px' : '9px 12px', cursor: 'pointer', fontSize: 16, fontFamily: 'Helvetica Neue,sans-serif', fontWeight: 800, lineHeight: 1 }} title="Neues Angebot">✏️</button>
          <button onClick={() => setScreen(previousScreen)} style={{ background: 'transparent', color: C.textMid, border: `1px solid ${C.border}`, borderRadius: 6, padding: isMobile ? '7px 9px' : '9px 11px', cursor: 'pointer', fontSize: 16, fontFamily: 'Helvetica Neue,sans-serif', lineHeight: 1 }} title="Meine Projekte">📋</button>
          <button onClick={() => window.location.href = '/settings'} style={{ background: 'transparent', color: C.textMid, border: `1px solid ${C.border}`, borderRadius: 6, padding: isMobile ? '7px 9px' : '9px 11px', cursor: 'pointer', fontSize: 16, fontFamily: 'Helvetica Neue,sans-serif', lineHeight: 1 }} title="Einstellungen">⚙️</button>
          {userEmail && (
            <button onClick={logout} style={{ background: 'transparent', color: C.textMid, border: `1px solid ${C.border}`, borderRadius: 6, padding: isMobile ? '7px 9px' : '9px 11px', cursor: 'pointer', fontSize: 16, fontFamily: 'Helvetica Neue,sans-serif', lineHeight: 1 }} title="Abmelden">🚪</button>
          )}
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
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 10, marginBottom: 10 }}>
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
                width: 340px; min-width: 340px;
                border-left: 2px solid #C8885A44;
                display: flex; flex-direction: column;
                flex-shrink: 0; overflow: hidden;
                background: #111;
                height: calc(100vh - 116px);
                position: sticky; top: 0;
              }
              .cf-optim-panel .chat-area {
                flex: 1; overflow-y: auto; padding: 14px;
                display: flex; flex-direction: column; gap: 10px;
              }
              .cf-optim-panel .chat-area::-webkit-scrollbar { width: 4px; }
              .cf-optim-panel .chat-area::-webkit-scrollbar-thumb { background: #333; border-radius: 2px; }
              @media (max-width: 640px) {
                .cf-optim-panel {
                  position: fixed; top: 116px; bottom: 0; left: 0; right: 0;
                  width: 100% !important; min-width: 0; height: auto;
                  border-left: none; border-top: 2px solid #C8885A; z-index: 200;
                }
              }
            `}</style>
            <div style={{ display: 'flex', minHeight: 'calc(100vh - 116px)', alignItems: 'flex-start' }}>

            {/* ── LEFT: Kalkulation Content ── */}
            <div style={{ flex: 1, padding: 14, minWidth: 0, overflowY: 'auto', maxHeight: 'calc(100vh - 116px)', display: isMobile && optimPanelOpen ? 'none' : undefined }}>

            {/* Feature 3+4: Top action buttons */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
              <button
                onClick={() => {
                  if (!planCanUse('starter')) { window.location.href = '/settings#plan'; return }
                  startAllInquiry()
                }}
                disabled={allInquiryStatus === 'loading'}
                style={{
                  flex: 1, minWidth: 160,
                  background: allInquiryStatus === 'done' ? '#1a3a1a' : 'transparent',
                  color: !planCanUse('starter') ? C.textMid : allInquiryStatus === 'done' ? '#90EE90' : allInquiryStatus === 'loading' ? C.textMid : C.copper,
                  border: `1px solid ${!planCanUse('starter') ? C.border : allInquiryStatus === 'done' ? '#3a6a3a' : allInquiryStatus === 'error' ? '#8b2222' : C.copper}`,
                  borderRadius: 3, padding: '8px 12px',
                  cursor: allInquiryStatus === 'loading' ? 'wait' : 'pointer',
                  fontSize: 11, fontFamily: 'Helvetica Neue,sans-serif', fontWeight: 700,
                  opacity: !planCanUse('starter') ? 0.6 : 1,
                }}
              >
                {!planCanUse('starter') ? '🔒 Materialien anfragen — ab Starter' : allInquiryStatus === 'loading' ? '⟳ Suche Lieferanten…' : allInquiryStatus === 'done' ? '✓ Anfragen bereit' : '✉ Alle Materialien anfragen'}
              </button>
              {/* Export Dropdown */}
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => {
                    if (!planCanUse('starter')) { window.location.href = '/settings#plan'; return }
                    setExportMenuOpen(o => !o)
                  }}
                  style={{ background: exportMenuOpen ? C.gray2 : 'transparent', color: planCanUse('starter') ? C.textMid : C.textMid, border: `1px solid ${C.border}`, borderRadius: 3, padding: '8px 12px', cursor: 'pointer', fontSize: 11, fontFamily: 'Helvetica Neue,sans-serif', whiteSpace: 'nowrap', opacity: planCanUse('starter') ? 1 : 0.6 }}
                >
                  {planCanUse('starter') ? `↓ Export ${exportMenuOpen ? '▲' : '▼'}` : '🔒 Export'}
                </button>
                {exportMenuOpen && (
                  <>
                    <div
                      style={{ position: 'fixed', inset: 0, zIndex: 49 }}
                      onClick={() => setExportMenuOpen(false)}
                    />
                    <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 4, background: '#1E1E1E', border: `1px solid ${C.border}`, borderRadius: 6, overflow: 'hidden', zIndex: 50, minWidth: 160, boxShadow: '0 4px 16px rgba(0,0,0,0.5)' }}>
                      {[
                        { label: '📋 CSV – Vollexport', action: () => { exportFullCSV(); setExportMenuOpen(false) } },
                        { label: '🗄 SQL (.sql)', action: () => { exportSQL(); setExportMenuOpen(false) } },
                        { label: '📊 Excel (.xlsx)', action: () => { exportXLSX(); setExportMenuOpen(false) } },
                        { label: '⬛ CSV – Übersicht', action: () => { exportCSV(); setExportMenuOpen(false) } },
                        { label: '{ } JSON', action: () => { exportJSON(); setExportMenuOpen(false) } },
                        {
                          label: planCanUse('enterprise') ? '🏗 GAEB DA84 (.X84)' : '🔒 GAEB DA84 — Enterprise',
                          action: () => { if (planCanUse('enterprise')) { exportGAEB(); setExportMenuOpen(false) } else { window.location.href = '/settings#plan' } },
                        },
                      ].map(item => (
                        <button
                          key={item.label}
                          onClick={item.action}
                          style={{ display: 'block', width: '100%', padding: '12px 16px', background: 'transparent', border: 'none', borderBottom: `1px solid ${C.border}`, color: planCanUse('enterprise') || !item.label.includes('GAEB') ? C.white : C.textMid, fontSize: 12, fontFamily: 'Helvetica Neue,sans-serif', textAlign: 'left', cursor: 'pointer', minHeight: 44 }}
                          onMouseEnter={e => (e.currentTarget.style.background = C.gray2)}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
              <button onClick={copyToClipboard} style={{ background: copiedFeedback ? '#1a3a1a' : 'transparent', color: copiedFeedback ? '#90EE90' : C.textMid, border: `1px solid ${copiedFeedback ? '#3a6a3a' : C.border}`, borderRadius: 3, padding: '8px 12px', cursor: 'pointer', fontSize: 11, fontFamily: 'Helvetica Neue,sans-serif' }}>
                {copiedFeedback ? '✓ Kopiert' : '⎘ Kopieren'}
              </button>
            </div>

            {allInquiryStatus === 'done' && allInquiryResult && (
              <div style={{ background: C.black, border: `1px solid ${C.border}`, borderRadius: 4, padding: '10px 12px', marginBottom: 14 }}>
                {allInquiryResult.groups.map((g, gi) => (
                  <div key={gi} style={{ marginBottom: 12, paddingBottom: 12, borderBottom: gi < allInquiryResult.groups.length - 1 ? `1px solid ${C.border}` : 'none' }}>
                    <div style={{ fontSize: 10, letterSpacing: 1.5, color: C.textMid, textTransform: 'uppercase', marginBottom: 4 }}>{g.gruppe}</div>
                    <div style={{ fontSize: 11, color: C.textMid, marginBottom: 6 }}>{g.materialien.slice(0, 2).join(' · ')}{g.materialien.length > 2 ? ` +${g.materialien.length - 2}` : ''}</div>
                    {g.candidates.map((c) => {
                      const selKey = `all__${g.gruppe}`
                      const isSelected = (selectedCandidates[selKey] ?? new Set()).has(c.supplierId)
                      const emailKey = `${c.email}__${c.subject}`
                      const isSending = sendingEmail === emailKey
                      const isSent = sentEmails.has(emailKey)
                      return (
                        <div key={c.supplierId} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, padding: '5px 8px', borderRadius: 4, background: isSelected ? `${C.copper}10` : C.gray1, border: `1px solid ${isSelected ? C.copper + '44' : C.border}` }}>
                          <input type="checkbox" checked={isSelected} onChange={() => toggleCandidate('all', g.gruppe, c.supplierId)} style={{ accentColor: C.copper, cursor: 'pointer', flexShrink: 0 }} />
                          <span style={{ fontSize: 11, color: c.ist_favorit ? '#F5C518' : C.textMid, flexShrink: 0 }}>★</span>
                          <span style={{ fontSize: 12, color: C.white, flex: 1 }}>{c.supplierName}</span>
                          {c.phone && <span style={{ fontSize: 11, color: C.textMid }}>{c.phone}</span>}
                          {isSelected && (
                            planCanUse('pro') ? (
                              isSent ? <span style={{ fontSize: 11, color: '#90EE90' }}>✓ Gesendet</span> : (
                                <button onClick={() => sendInquiryEmail(c.email, c.subject, c.body)} disabled={isSending}
                                  style={{ fontSize: 11, color: C.black, background: C.copper, border: 'none', borderRadius: 3, padding: '2px 8px', cursor: isSending ? 'wait' : 'pointer', fontFamily: 'Helvetica Neue,sans-serif', fontWeight: 700, flexShrink: 0 }}>
                                  {isSending ? '⟳…' : '✉ Senden'}
                                </button>
                              )
                            ) : (
                              <a href={`mailto:${c.email}?subject=${encodeURIComponent(c.subject)}&body=${encodeURIComponent(c.body)}`}
                                style={{ fontSize: 11, color: C.copper, textDecoration: 'none', border: `1px solid ${C.copper}`, borderRadius: 3, padding: '2px 8px', flexShrink: 0 }}>
                                ✉ E-Mail öffnen
                              </a>
                            )
                          )}
                        </div>
                      )
                    })}
                  </div>
                ))}
                {(allInquiryResult.missingGroups?.length ?? 0) > 0 && (
                  <div style={{ fontSize: 11, color: C.copper, marginTop: 4 }}>
                    Kein Lieferant für: {allInquiryResult.missingGroups.map(g => g.gruppe).join(', ')}
                    {!planCanUse('enterprise') && <span style={{ color: C.textMid }}> — 🔒 <a href="/settings#plan" style={{ color: C.textMid }}>Enterprise: Händlersuche im Internet</a></span>}
                  </div>
                )}
                {(allInquiryResult.suggestedSuppliers?.length ?? 0) > 0 && (
                  <div style={{ marginTop: 10, borderTop: `1px solid ${C.border}`, paddingTop: 10 }}>
                    <div style={{ fontSize: 11, color: C.textMid, marginBottom: 6, fontWeight: 700, letterSpacing: 1 }}>IM INTERNET GEFUNDEN</div>
                    {allInquiryResult.suggestedSuppliers!.map((s, i) => (
                      <div key={i} style={{ marginBottom: 8, paddingBottom: 8, borderBottom: i < allInquiryResult.suggestedSuppliers!.length - 1 ? `1px solid ${C.border}` : 'none' }}>
                        <div style={{ fontSize: 12, color: C.white, marginBottom: 2 }}><strong>{s.name}</strong> <span style={{ fontSize: 10, color: C.textMid }}>({s.gruppe})</span></div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const, alignItems: 'center' }}>
                          {s.website && <a href={s.website} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: C.copper, textDecoration: 'none' }}>{s.website.replace(/^https?:\/\//, '')}</a>}
                          {s.email && <span style={{ fontSize: 11, color: C.textMid }}>{s.email}</span>}
                          <button onClick={() => { window.location.href = `/settings?tab=lieferanten&prefill=${encodeURIComponent(JSON.stringify({ company_name: s.name, website: s.website, general_email: s.email, phone: s.phone, kategorien: [s.gruppe] }))}` }}
                            style={{ fontSize: 10, color: C.copper, background: 'transparent', border: `1px solid ${C.copper}`, borderRadius: 3, padding: '1px 7px', cursor: 'pointer', fontFamily: 'Helvetica Neue,sans-serif', fontWeight: 700 }}>
                            + Hinzufügen
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {allInquiryResult.uncategorized?.length > 0 && (
                  <div style={{ fontSize: 11, color: C.textMid, marginTop: 4 }}>Nicht kategorisiert: {allInquiryResult.uncategorized.join(', ')}</div>
                )}
                {allInquiryResult.groups.length === 0 && (allInquiryResult.suggestedSuppliers?.length ?? 0) === 0 && (
                  <div style={{ fontSize: 12, color: C.textMid }}>Keine Lieferanten gefunden — bitte in Einstellungen → Lieferanten hinterlegen.</div>
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

            {/* KI-Optimierung Haupt-Button */}
            <button
              onClick={openOptimPanel}
              style={{
                width: '100%', marginBottom: 14,
                background: optimPanelOpen ? `${C.copper}22` : `${C.copper}15`,
                border: `1px solid ${C.copper}`,
                borderRadius: 8, padding: '14px 16px',
                cursor: 'pointer', fontFamily: 'Helvetica Neue,sans-serif',
                display: 'flex', alignItems: 'center', gap: 12,
                textAlign: 'left' as const,
              }}
            >
              <span style={{ fontSize: 24, flexShrink: 0 }}>✨</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: C.copper, fontSize: 14, fontWeight: 800, letterSpacing: 0.3 }}>KI-Optimierung</div>
                <div style={{ color: C.textMid, fontSize: 11, marginTop: 2, lineHeight: 1.4 }}>KI analysiert dein Angebot und schlägt Verbesserungen vor</div>
              </div>
              <span style={{ color: C.copper, fontSize: 18, flexShrink: 0 }}>→</span>
            </button>

            {/* Gesamtübersicht oben */}
            <div style={{ background: C.darkbg, borderRadius: 4, border: `1px solid ${C.copper}44`, overflow: 'hidden', marginBottom: 14 }}>
              <div style={{ display: 'flex' }}>
                {[{ l: 'Positionen', v: `${pos.length}`, hideOnMobile: false }, { l: 'Netto', v: eur(totals.net), hideOnMobile: false }, { l: 'MwSt.', v: eur(vat), hideOnMobile: true }, { l: 'Brutto', v: eur(gross), hideOnMobile: false }]
                  .filter(item => !isMobile || !item.hideOnMobile)
                  .map(({ l, v }, i) => (
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
                        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: isMobile ? 320 : 480 }}>
                          <thead>
                            <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                              <th style={{ ...thStyle, width: '4%' }}></th>
                              <th style={{ ...thStyle, width: isMobile ? '40%' : '32%' }}>Bezeichnung</th>
                              <th style={{ ...thStyle, width: '9%' }}>Menge</th>
                              {!isMobile && <th style={{ ...thStyle, width: '8%' }}>Einheit</th>}
                              <th style={{ ...thStyle, width: '10%' }}>EK €</th>
                              {!isMobile && <th style={{ ...thStyle, width: '10%' }}>Aufschl.%</th>}
                              <th style={{ ...thStyle, width: '15%', textAlign: 'right' }}>VK</th>
                              <th style={{ ...thStyle, width: '8%' }}></th>
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
                                  <input type="number" step="0.1" value={m.menge} onChange={e => updMatRow(p.id, m.id, 'menge', parseFloat(e.target.value) || 0)} style={{ ...cellInput, minWidth: 44 }} />
                                </td>
                                {!isMobile && <td style={tdStyle}>
                                  <input value={m.einheit} onChange={e => updMatRow(p.id, m.id, 'einheit', e.target.value)} style={{ ...cellInput, minWidth: 38 }} />
                                </td>}
                                <td style={tdStyle}>
                                  <input type="number" step="0.01" value={m.ekPreis} onChange={e => updMatRow(p.id, m.id, 'ekPreis', parseFloat(e.target.value) || 0)} style={{ ...cellInput, minWidth: 48 }} />
                                </td>
                                {!isMobile && <td style={tdStyle}>
                                  <input type="number" step="1" value={Math.round(m.aufschlag * 100)} onChange={e => updMatRow(p.id, m.id, 'aufschlag', (parseFloat(e.target.value) || 0) / 100)} style={{ ...cellInput, minWidth: 44 }} />
                                </td>}
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
                        const canInquire = planCanUse('starter')
                        return (
                          <div style={{ marginTop: 10 }}>
                            {ist !== 'loading' && ist !== 'done' && (
                              <button
                                onClick={() => {
                                  if (!canInquire) { window.location.href = '/settings#plan'; return }
                                  startInquiry(p.id, p.titel, p.material)
                                }}
                                disabled={canInquire && selCount === 0}
                                style={{
                                  background: (!canInquire || selCount === 0) ? C.gray2 : 'transparent',
                                  color: (!canInquire || selCount === 0) ? C.textMid : C.copper,
                                  border: `1px solid ${(!canInquire || selCount === 0) ? C.border : C.copper}`,
                                  borderRadius: 3, padding: '6px 14px', cursor: (!canInquire || selCount === 0) ? 'not-allowed' : 'pointer',
                                  fontSize: 11, fontFamily: 'Helvetica Neue,sans-serif', fontWeight: 700,
                                }}
                              >
                                {!canInquire ? '🔒 Preise anfragen — ab Starter' : `✉ Ausgewählte Preise anfragen (${selCount}/${p.material.length})`}
                              </button>
                            )}
                            {ist === 'loading' && (
                              <div style={{ fontSize: 12, color: C.textMid, padding: '6px 0' }}>
                                {planCanUse('enterprise') ? '⟳ Suche Lieferanten — bei fehlenden Einträgen auch im Internet…' : '⟳ Suche passende Lieferanten…'}
                              </div>
                            )}
                            {ist === 'error' && (
                              <div style={{ fontSize: 12, color: '#ff9999', padding: '6px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
                                Fehler beim Erstellen der Anfragen.
                                <button onClick={() => startInquiry(p.id, p.titel, p.material)} style={{ background: 'transparent', color: C.copper, border: 'none', cursor: 'pointer', fontSize: 11, textDecoration: 'underline', fontFamily: 'Helvetica Neue,sans-serif', padding: 0 }}>
                                  Erneut versuchen
                                </button>
                              </div>
                            )}
                            {ist === 'done' && res && (
                              <div style={{ marginTop: 4, background: C.black, border: `1px solid ${C.border}`, borderRadius: 4, padding: '10px 12px' }}>
                                {res.groups.map((g, gi) => (
                                  <div key={gi} style={{ marginBottom: 12, paddingBottom: 12, borderBottom: gi < res.groups.length - 1 ? `1px solid ${C.border}` : 'none' }}>
                                    <div style={{ fontSize: 10, letterSpacing: 1.5, color: C.textMid, textTransform: 'uppercase', marginBottom: 4 }}>{g.gruppe}</div>
                                    <div style={{ fontSize: 11, color: C.textMid, marginBottom: 6 }}>{g.materialien.slice(0, 2).join(' · ')}{g.materialien.length > 2 ? ` +${g.materialien.length - 2}` : ''}</div>
                                    {g.candidates.map((c) => {
                                      const selKey = `pos-${p.id}__${g.gruppe}`
                                      const isSelected = (selectedCandidates[selKey] ?? new Set()).has(c.supplierId)
                                      const emailKey = `${c.email}__${c.subject}`
                                      const isSending = sendingEmail === emailKey
                                      const isSent = sentEmails.has(emailKey)
                                      return (
                                        <div key={c.supplierId} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, padding: '5px 8px', borderRadius: 4, background: isSelected ? `${C.copper}10` : C.gray1, border: `1px solid ${isSelected ? C.copper + '44' : C.border}` }}>
                                          <input type="checkbox" checked={isSelected} onChange={() => toggleCandidate(`pos-${p.id}`, g.gruppe, c.supplierId)} style={{ accentColor: C.copper, cursor: 'pointer', flexShrink: 0 }} />
                                          <span style={{ fontSize: 11, color: c.ist_favorit ? '#F5C518' : C.textMid, flexShrink: 0 }}>★</span>
                                          <span style={{ fontSize: 12, color: C.white, flex: 1 }}>{c.supplierName}</span>
                                          {c.phone && <span style={{ fontSize: 11, color: C.textMid }}>{c.phone}</span>}
                                          {isSelected && (
                                            planCanUse('pro') ? (
                                              isSent ? <span style={{ fontSize: 11, color: '#90EE90' }}>✓ Gesendet</span> : (
                                                <button onClick={() => sendInquiryEmail(c.email, c.subject, c.body)} disabled={isSending}
                                                  style={{ fontSize: 11, color: C.black, background: C.copper, border: 'none', borderRadius: 3, padding: '2px 8px', cursor: isSending ? 'wait' : 'pointer', fontFamily: 'Helvetica Neue,sans-serif', fontWeight: 700, flexShrink: 0 }}>
                                                  {isSending ? '⟳…' : '✉ Senden'}
                                                </button>
                                              )
                                            ) : (
                                              <a href={`mailto:${c.email}?subject=${encodeURIComponent(c.subject)}&body=${encodeURIComponent(c.body)}`}
                                                style={{ fontSize: 11, color: C.copper, textDecoration: 'none', border: `1px solid ${C.copper}`, borderRadius: 3, padding: '2px 8px', flexShrink: 0 }}>
                                                ✉ E-Mail öffnen
                                              </a>
                                            )
                                          )}
                                        </div>
                                      )
                                    })}
                                  </div>
                                ))}
                                {(res.missingGroups?.length ?? 0) > 0 && (
                                  <div style={{ fontSize: 11, color: C.copper, marginTop: 4 }}>
                                    Kein Lieferant für: {res.missingGroups.map(g => g.gruppe).join(', ')}
                                    {!planCanUse('enterprise') && <span style={{ color: C.textMid }}> — 🔒 <a href="/settings#plan" style={{ color: C.textMid }}>Enterprise: Händlersuche im Internet</a></span>}
                                  </div>
                                )}
                                {(res.suggestedSuppliers?.length ?? 0) > 0 && (
                                  <div style={{ marginTop: 10, borderTop: `1px solid ${C.border}`, paddingTop: 10 }}>
                                    <div style={{ fontSize: 11, color: C.textMid, marginBottom: 6, fontWeight: 700, letterSpacing: 1 }}>IM INTERNET GEFUNDEN</div>
                                    {res.suggestedSuppliers!.map((s, i) => (
                                      <div key={i} style={{ marginBottom: 8 }}>
                                        <div style={{ fontSize: 12, color: C.white }}><strong>{s.name}</strong> <span style={{ fontSize: 10, color: C.textMid }}>({s.gruppe})</span></div>
                                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 3 }}>
                                          {s.website && <a href={s.website} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: C.copper, textDecoration: 'none' }}>{s.website.replace(/^https?:\/\//, '')}</a>}
                                          <button onClick={() => { window.location.href = `/settings?tab=lieferanten&prefill=${encodeURIComponent(JSON.stringify({ company_name: s.name, website: s.website, general_email: s.email, phone: s.phone, kategorien: [s.gruppe] }))}` }}
                                            style={{ fontSize: 10, color: C.copper, background: 'transparent', border: `1px solid ${C.copper}`, borderRadius: 3, padding: '1px 7px', cursor: 'pointer', fontFamily: 'Helvetica Neue,sans-serif', fontWeight: 700 }}>
                                            + Hinzufügen
                                          </button>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                                {res.uncategorized?.length > 0 && (
                                  <div style={{ marginTop: 6, fontSize: 11, color: C.textMid }}>Nicht kategorisiert: {res.uncategorized.join(', ')}</div>
                                )}
                                {res.groups.length === 0 && (res.suggestedSuppliers?.length ?? 0) === 0 && (
                                  <div style={{ fontSize: 12, color: C.textMid }}>Keine Lieferanten — bitte in Einstellungen → Lieferanten ergänzen.</div>
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
                      {/* Header + Gesamtübersicht */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
                        <Lbl>Arbeitszeit</Lbl>
                        <div style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
                          {(() => {
                            const totalMin = p.arbeitszeit.reduce((s, a) => s + a.minuten, 0)
                            if (totalMin === 0) return null
                            const h = Math.floor(totalMin / 60)
                            const m = totalMin % 60
                            return <span style={{ fontSize: 11, color: C.white, fontWeight: 600 }}>{h > 0 ? `${h}h ` : ''}{m > 0 ? `${m}min` : ''}</span>
                          })()}
                          {arbTotal > 0 && <span style={{ fontSize: 10, color: C.textMid }}>{eur(arbTotal)}</span>}
                        </div>
                      </div>

                      {/* Gruppierte Kostenstellen (built-in + custom) */}
                      {allGroupsOrder.map(gruppe => {
                        const eintraege = p.arbeitszeit.filter(a => getKsGruppe(a.kostenstelle) === gruppe)
                        if (eintraege.length === 0) return null
                        const gruppeMin = eintraege.reduce((s, a) => s + a.minuten, 0)
                        const gh = Math.floor(gruppeMin / 60)
                        const gm = gruppeMin % 60
                        return (
                          <div key={gruppe} style={{ marginBottom: 10 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 4, borderBottom: `1px solid ${C.border}`, marginBottom: 4 }}>
                              <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: C.copper }}>{gruppe}</span>
                              <span style={{ fontSize: 10, color: C.textMid }}>{gh > 0 ? `${gh}h ` : ''}{gm > 0 ? `${gm}min` : (gruppeMin === 0 ? '' : '')}</span>
                            </div>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                              <tbody>
                                {eintraege.map(a => (
                                  <tr key={a.id} style={{ borderBottom: `1px solid ${C.border}22` }}>
                                    <td style={{ ...tdStyle, width: isMobile ? '50%' : '36%', color: C.white, fontSize: 12 }}>
                                      {getKsLabel(a.kostenstelle)}
                                    </td>
                                    {!isMobile && <td style={{ ...tdStyle, width: '14%', fontSize: 10, color: C.textMid, whiteSpace: 'nowrap' as const }}>
                                      {a.vkStunde} €/h
                                    </td>}
                                    <td style={{ ...tdStyle, width: isMobile ? '28%' : '22%' }}>
                                      <input type="number" step="5" value={a.minuten}
                                        onChange={e => updArbRow(p.id, a.id, 'minuten', parseInt(e.target.value) || 0)}
                                        style={{ ...cellInput, minWidth: 44 }} /> <span style={{ fontSize: 10, color: C.textMid }}>min</span>
                                    </td>
                                    {!isMobile && <td style={{ ...tdStyle, width: '10%', fontSize: 10, color: C.textMid }}>
                                      {(a.minuten / 60).toFixed(1)}h
                                    </td>}
                                    <td style={{ ...tdStyle, width: isMobile ? '16%' : '14%', textAlign: 'right' as const, fontSize: 11, fontWeight: 600, color: C.white, whiteSpace: 'nowrap' as const }}>
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
                        )
                      })}

                      {/* Einträge ohne bekannte Gruppe (Fallback) */}
                      {(() => {
                        const ungrouped = p.arbeitszeit.filter(a => getKsGruppe(a.kostenstelle) === null)
                        if (ungrouped.length === 0) return null
                        return (
                          <div style={{ marginBottom: 10 }}>
                            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: C.textMid, paddingBottom: 4, borderBottom: `1px solid ${C.border}`, marginBottom: 4 }}>Sonstiges</div>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                              <tbody>
                                {ungrouped.map(a => (
                                  <tr key={a.id} style={{ borderBottom: `1px solid ${C.border}22` }}>
                                    <td style={tdStyle}>
                                      <select value={a.kostenstelle} onChange={e => updArbRow(p.id, a.id, 'kostenstelle', e.target.value)} style={{ ...cellInput, minWidth: 148 }}>
                                        {allKsOptions.map(opt => (
                                          <option key={opt.code} value={opt.code}>{opt.label}</option>
                                        ))}
                                      </select>
                                    </td>
                                    <td style={tdStyle}>
                                      <input type="number" step="5" value={a.minuten} onChange={e => updArbRow(p.id, a.id, 'minuten', parseInt(e.target.value) || 0)} style={{ ...cellInput, minWidth: 52 }} />
                                    </td>
                                    <td style={tdStyle}>
                                      <input type="number" step="1" value={a.vkStunde} onChange={e => updArbRow(p.id, a.id, 'vkStunde', parseFloat(e.target.value) || 0)} style={{ ...cellInput, minWidth: 48 }} />
                                    </td>
                                    <td style={{ ...tdStyle, textAlign: 'right' as const, fontSize: 11, fontWeight: 600, color: C.white, whiteSpace: 'nowrap' as const }}>
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
                        )
                      })()}

                      <button onClick={() => addArbRow(p.id)} style={{ marginTop: 4, background: 'transparent', color: C.textMid, border: `1px dashed ${C.border}`, borderRadius: 3, padding: '5px 12px', cursor: 'pointer', fontSize: 11, fontFamily: 'Helvetica Neue,sans-serif' }}>
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
              !isMobile && <button
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
                <div style={{ padding: '12px 16px', borderBottom: `1px solid ${C.copper}33`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0, background: `${C.copper}0A` }}>
                  <div>
                    <div style={{ color: C.copper, fontWeight: 800, fontSize: 12, letterSpacing: 1.5 }}>✨ KI-OPTIMIERUNG</div>
                    <div style={{ color: C.textMid, fontSize: 10, marginTop: 1 }}>Frage stellen oder Änderung beschreiben</div>
                  </div>
                  <button onClick={() => setOptimPanelOpen(false)} style={{ background: 'transparent', color: C.textMid, border: `1px solid ${C.border}`, borderRadius: 4, padding: '4px 10px', cursor: 'pointer', fontSize: 13, fontFamily: 'Helvetica Neue,sans-serif', lineHeight: 1 }}>×</button>
                </div>

                {/* Chat */}
                <div ref={optimChatRef} className="chat-area">
                  {optimMessages.length === 0 && !optimLoading && (
                    <div style={{ color: C.textMid, fontSize: 12, lineHeight: 1.6, padding: '8px 0' }}>
                      KI analysiert das Angebot…
                    </div>
                  )}
                  {optimMessages.map((msg, i) => (
                    <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                      <div style={{ fontSize: 9, color: C.textMid, marginBottom: 3, letterSpacing: 0.5 }}>
                        {msg.role === 'user' ? 'DU' : 'KI'}
                      </div>
                      <div style={{
                        maxWidth: '92%', padding: '9px 13px', borderRadius: msg.role === 'user' ? '10px 10px 2px 10px' : '10px 10px 10px 2px',
                        fontSize: 13, lineHeight: 1.65,
                        background: msg.role === 'user' ? C.copper : C.gray1,
                        color: msg.role === 'user' ? C.black : C.white,
                        wordBreak: 'break-word',
                        border: msg.role === 'assistant' ? `1px solid ${C.border}` : 'none',
                      }}>
                        {msg.content.split('\n').map((line, li) => {
                          const clean = line.replace(/\*\*(.*?)\*\*/g, '$1').replace(/#{1,3}\s*/g, '')
                          if (clean.startsWith('→ ') || clean.startsWith('- ')) {
                            const txt = clean.startsWith('→ ') ? clean.slice(2) : clean.slice(2)
                            return (
                              <div key={li} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 3 }}>
                                <span style={{ color: msg.role === 'user' ? C.black : C.copper, flexShrink: 0, fontWeight: 700, fontSize: 13 }}>→</span>
                                <span>{txt}</span>
                              </div>
                            )
                          }
                          if (clean === '') return li === 0 ? null : <div key={li} style={{ height: 6 }} />
                          return <div key={li} style={{ marginBottom: li < msg.content.split('\n').length - 1 ? 2 : 0 }}>{clean}</div>
                        })}
                      </div>
                    </div>
                  ))}
                  {optimLoading && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: C.copper, opacity: 0.8 }} />
                      <span style={{ color: C.textMid, fontSize: 11 }}>KI denkt…</span>
                    </div>
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
                <div style={{ padding: '12px 14px', borderTop: `1px solid ${C.copper}33`, flexShrink: 0, background: `${C.copper}05` }}>
                  <div style={{ fontSize: 10, color: C.textMid, marginBottom: 6, letterSpacing: 0.5 }}>
                    Antworte auf die Analyse oder beschreibe eine Änderung:
                  </div>
                  <textarea
                    value={optimInput}
                    onChange={e => setOptimInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendOptimMessage() } }}
                    placeholder='z.B. "Holzart ist Eiche massiv" oder "Maße: 240×220×60 cm"'
                    rows={3}
                    disabled={optimLoading}
                    style={{ width: '100%', background: C.gray2, border: `1px solid ${C.copper}44`, borderRadius: 6, padding: '10px 12px', fontSize: 12, lineHeight: 1.55, color: C.white, fontFamily: 'Helvetica Neue,sans-serif', resize: 'none', boxSizing: 'border-box', outline: 'none' }}
                  />
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <button
                      onClick={optimToggleRecording}
                      disabled={optimMicStatus === 'transcribing' || optimLoading}
                      style={{ background: optimMicStatus === 'recording' ? '#cc2222' : C.gray2, color: optimMicStatus === 'recording' ? '#fff' : C.textMid, border: `1px solid ${optimMicStatus === 'recording' ? '#cc2222' : C.border}`, borderRadius: 5, padding: '8px 12px', cursor: 'pointer', fontSize: 14, flexShrink: 0 }}
                    >
                      {optimMicStatus === 'transcribing' ? '⟳' : '🎤'}
                    </button>
                    <button
                      onClick={sendOptimMessage}
                      disabled={!optimInput.trim() || optimLoading}
                      style={{ flex: 1, background: (!optimInput.trim() || optimLoading) ? C.gray2 : C.copper, color: (!optimInput.trim() || optimLoading) ? C.textMid : C.black, border: 'none', borderRadius: 5, padding: '8px 14px', cursor: (!optimInput.trim() || optimLoading) ? 'not-allowed' : 'pointer', fontSize: 13, fontFamily: 'Helvetica Neue,sans-serif', fontWeight: 800 }}
                    >
                      {optimLoading ? '…' : 'Senden →'}
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
                <Lbl>Angebotsnummer</Lbl>
                <TxtInput value={docNr} onChange={setDocNr} />
              </div>
            </Card>

            <Card>
              <div style={{ padding: '12px 16px' }}>
                <Lbl>Empfänger</Lbl>
                <div style={{ background: C.black, borderRadius: 3, padding: '10px 12px', border: `1px solid ${C.border}` }}>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{kunde.name || '–'}</div>
                  {(kunde.strasse || kunde.ort) && <div style={{ color: C.textMid, fontSize: 11, marginTop: 2 }}>{[kunde.strasse, kunde.ort].filter(Boolean).join(' · ')}</div>}
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
              {saveStatus === 'saving' ? '…' : saveStatus === 'saved' ? '✓ Gespeichert' : saveStatus === 'error' ? '✗ Fehler beim Speichern' : '💾 Änderungen speichern'}
            </button>

            {usage !== null && usage.remaining !== null && usage.remaining <= 3 && (
              <div style={{ textAlign: 'center', fontSize: 11, color: usage.remaining === 0 ? '#E05A5A' : '#C8885A', marginBottom: 8 }}>
                {usage.remaining === 0
                  ? `Limit erreicht (${usage.count}/${usage.limit} Angebote diesen Monat)`
                  : `Noch ${usage.remaining} von ${usage.limit} Angeboten diesen Monat`}
              </div>
            )}
            <button onClick={async () => {
              if (usage !== null && !usage.erlaubt) {
                alert(`Du hast dein monatliches Limit von ${usage.limit} Angeboten erreicht. Bitte upgrade deinen Plan.`)
                return
              }
              const ok = await incrementUsage()
              if (!ok) {
                alert('Limit erreicht. Bitte upgrade deinen Plan unter Einstellungen → Mein Plan.')
                return
              }
              const datum = angebotsdatum || today()
              if (!angebotsdatum) setAngebotsdatum(datum)
              setPdfHTML(buildPDF(pos, kunde, docNr, docTyp, anschr, widerruf, {
                anredeVorlage: dokAnrede || undefined,
                nachtext: dokNachtext || undefined,
                widerrufText: dokWiderruf || undefined,
                zahlungText: dokZahlung || undefined,
                logoUrl: profilLogoUrl || undefined,
                angebotsdatum: datum,
              }))
              setScreen('pdf')
              if (currentProjectId) {
                fetch('/api/tracking', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'pdf_export', projectId: currentProjectId, data: { preis_netto: totals.net } }) })
              }
            }} disabled={usage !== null && !usage.erlaubt} style={{ width: '100%', background: usage !== null && !usage.erlaubt ? '#3a2a1a' : C.copper, color: usage !== null && !usage.erlaubt ? '#6a4a2a' : C.black, border: 'none', padding: '14px 0', borderRadius: 3, fontSize: 13, fontFamily: 'Helvetica Neue,sans-serif', fontWeight: 800, letterSpacing: 2, cursor: usage !== null && !usage.erlaubt ? 'not-allowed' : 'pointer' }}>
              ▶ DOKUMENT ALS PDF ANZEIGEN
            </button>
          </div>
        )}


      </div>

      {HelpWidget}
    </div>
  )
}
