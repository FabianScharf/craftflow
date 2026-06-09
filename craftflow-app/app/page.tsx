'use client'

import { useState, useRef, useCallback } from 'react'
import {
  C, FIRMA,
  DEFAULT_STUNDENSAETZE,
  eur, today,
  ladeKunden, speichereKunden,
  type Kunde, type KundeDB,
  type Angebotsposition, type MaterialPosten, type ArbeitsPosten, type KostenstelleId,
} from '@/lib/types'
import { buildPDF } from '@/lib/pdf'

/* ── Kostenstellen ────────────────────────────────── */
const KOSTENSTELLE_LABELS: Record<KostenstelleId, string> = {
  '00_Meeting':                   '00 Meeting',
  '01_02_Planung':                '01_02 Planung',
  '02_01_Konstruktion':           '02_01 Konstruktion',
  '02_02_Arbeitsvorbereitung':    '02_02 Arbeitsvorbereitung',
  '03_00_Produktion':             '03_00 Produktion',
  '03_01_Warenhandling':          '03_01 Warenhandling',
  '03_02_Zuschnitt':              '03_02 Zuschnitt',
  '03_03_Bekantung':              '03_03 Bekantung',
  '03_04_CNC':                    '03_04 CNC',
  '03_05_Oberflaechenbehandlung': '03_05 Oberfläche',
  '03_06_Zusammenbau':            '03_06 Zusammenbau',
  '03_07_Verpacken':              '03_07 Verpacken',
  '03_08_Azubi':                  '03_08 Azubi/Helfer',
  '05_01_Montage':                '05_01 Montage',
  '06_01_Lieferung':              '06_01 Lieferung',
}
const KOSTENSTELLEN_LIST = Object.keys(KOSTENSTELLE_LABELS) as KostenstelleId[]

function calcAngebotspos(p: Angebotsposition): number {
  const mat = p.material.reduce((sum, m) => sum + m.ekPreis * (1 + m.aufschlag) * m.menge, 0)
  const arb = p.arbeitszeit.reduce((sum, a) => sum + (a.minuten / 60) * a.vkStunde, 0)
  return mat + arb
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

/* ── Haupt-Komponente ─────────────────────────────── */
export default function CraftFlow() {
  // Navigation
  const [screen, setScreen] = useState<'start' | 'app' | 'pdf'>('start')

  // Kunden
  const [kunden, setKunden] = useState<KundeDB[]>(ladeKunden)
  const [kunde, setKunde] = useState<Kunde>({ name: '', zusatz: '', strasse: '', ort: '', projekt: '' })
  const [kundeTyp, setKundeTyp] = useState<'neu' | 'bestand'>('neu')
  const [kundeQuery, setKundeQuery] = useState('')

  // App State
  const [tab, setTab] = useState('diktieren')
  const [pos, setPos] = useState<Angebotsposition[]>([
    {
      id: 1,
      titel: 'Einbauschrank',
      beschreibung: 'Maße und Material nach Absprache.',
      material: [
        { id: 11, bezeichnung: 'Spanplatte 18mm weiß', menge: 8, einheit: 'm²', ekPreis: 20, aufschlag: 0.30 },
      ],
      arbeitszeit: [
        { id: 12, kostenstelle: '02_01_Konstruktion', minuten: 60, vkStunde: 75 },
        { id: 13, kostenstelle: '03_02_Zuschnitt', minuten: 120, vkStunde: 72 },
        { id: 14, kostenstelle: '03_03_Bekantung', minuten: 60, vkStunde: 100 },
        { id: 15, kostenstelle: '03_06_Zusammenbau', minuten: 180, vkStunde: 65 },
      ],
    },
    {
      id: 2,
      titel: 'Lieferung & Montage',
      beschreibung: 'Fachgerechte Montage inkl. An-/Abfahrt.',
      material: [],
      arbeitszeit: [
        { id: 21, kostenstelle: '05_01_Montage', minuten: 480, vkStunde: 65 },
        { id: 22, kostenstelle: '06_01_Lieferung', minuten: 60, vkStunde: 65 },
      ],
    },
  ])
  const [docNr, setDocNr] = useState('AB-264')
  const [docTyp, setDocTyp] = useState('Auftragsbestätigung')
  const [anschr, setAnschr] = useState('herzlichen Dank für Ihren Auftrag, den wir hiermit gerne bestätigen:')
  const [widerruf, setWiderruf] = useState(true)
  const [pdfHTML, setPdfHTML] = useState('')

  // Start / Diktat
  const [startText, setStartText] = useState('')
  const [startBild, setStartBild] = useState<string | null>(null)
  const [startBildB64, setStartBildB64] = useState<string | null>(null)
  const [startStatus, setStartStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [startMsg, setStartMsg] = useState('')

  const [diktatText, setDiktatText] = useState('')
  const [diktatStufe, setDiktatStufe] = useState('komplett')
  const [diktatBild, setDiktatBild] = useState<string | null>(null)
  const [diktatBildB64, setDiktatBildB64] = useState<string | null>(null)
  const [diktatStatus, setDiktatStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [diktatMsg, setDiktatMsg] = useState('')

  const startFileRef = useRef<HTMLInputElement>(null)
  const diktatFileRef = useRef<HTMLInputElement>(null)
  const startTextRef = useRef<HTMLTextAreaElement>(null)
  const diktatTextRef = useRef<HTMLTextAreaElement>(null)

  // ── Helpers ────────────────────────────────────────
  const updK = (f: keyof Kunde, v: string) => setKunde(prev => ({ ...prev, [f]: v }))

  const updTitel = (id: number, v: string) =>
    setPos(prev => prev.map(p => p.id === id ? { ...p, titel: v } : p))
  const updBeschreibung = (id: number, v: string) =>
    setPos(prev => prev.map(p => p.id === id ? { ...p, beschreibung: v } : p))
  const addPos = () => setPos(prev => [...prev, {
    id: Date.now(), titel: 'Neue Position', beschreibung: '', material: [], arbeitszeit: [],
  }])
  const delPos = (id: number) => setPos(prev => prev.filter(p => p.id !== id))

  const updMat = (posId: number, matId: number, f: keyof MaterialPosten, v: unknown) =>
    setPos(prev => prev.map(p => p.id === posId
      ? { ...p, material: p.material.map(m => m.id === matId ? { ...m, [f]: v } as MaterialPosten : m) }
      : p))
  const addMat = (posId: number) => setPos(prev => prev.map(p => p.id === posId
    ? { ...p, material: [...p.material, { id: Date.now(), bezeichnung: '', menge: 1, einheit: 'Stk', ekPreis: 0, aufschlag: 0.30 }] }
    : p))
  const delMat = (posId: number, matId: number) => setPos(prev => prev.map(p => p.id === posId
    ? { ...p, material: p.material.filter(m => m.id !== matId) }
    : p))

  const updArb = (posId: number, arbId: number, f: keyof ArbeitsPosten, v: unknown) =>
    setPos(prev => prev.map(p => p.id === posId
      ? { ...p, arbeitszeit: p.arbeitszeit.map(a => a.id === arbId ? { ...a, [f]: v } as ArbeitsPosten : a) }
      : p))
  const updArbKs = (posId: number, arbId: number, ks: KostenstelleId) =>
    setPos(prev => prev.map(p => p.id === posId
      ? { ...p, arbeitszeit: p.arbeitszeit.map(a => a.id === arbId
          ? { ...a, kostenstelle: ks, vkStunde: DEFAULT_STUNDENSAETZE[ks] }
          : a) }
      : p))
  const addArb = (posId: number) => setPos(prev => prev.map(p => p.id === posId
    ? { ...p, arbeitszeit: [...p.arbeitszeit, {
        id: Date.now(),
        kostenstelle: '03_06_Zusammenbau' as KostenstelleId,
        minuten: 60,
        vkStunde: DEFAULT_STUNDENSAETZE['03_06_Zusammenbau'],
      }] }
    : p))
  const delArb = (posId: number, arbId: number) => setPos(prev => prev.map(p => p.id === posId
    ? { ...p, arbeitszeit: p.arbeitszeit.filter(a => a.id !== arbId) }
    : p))

  const totals = pos.reduce((a, p) => ({ net: a.net + calcAngebotspos(p) }), { net: 0 })
  const vat = totals.net * 0.19
  const gross = totals.net + vat

  const gefilterteKunden = kunden.filter(k =>
    k.name.toLowerCase().includes(kundeQuery.toLowerCase()) ||
    k.ort.toLowerCase().includes(kundeQuery.toLowerCase())
  )

  // ── Bild laden ─────────────────────────────────────
  const loadBild = useCallback((file: File, setter: (url: string | null) => void, setterB64: (b64: string | null) => void) => {
    setter(URL.createObjectURL(file))
    const reader = new FileReader()
    reader.onload = ev => {
      const result = ev.target?.result as string
      setterB64(result.split(',')[1])
    }
    reader.readAsDataURL(file)
  }, [])

  // ── KI Analyse ─────────────────────────────────────
  const callAI = useCallback(async (text: string, imageB64: string | null, mode: string) => {
    const res = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, imageBase64: imageB64, mode }),
    })
    if (!res.ok) throw new Error(`API Fehler: ${res.status}`)
    const json = await res.json()
    if (!json.success) throw new Error(json.error || 'Unbekannter Fehler')
    return json.data
  }, [])

  const mapPositionen = (raw: unknown[], baseId: number): Angebotsposition[] =>
    (raw as Partial<Angebotsposition>[]).map((p, i) => ({
      id: baseId + i,
      titel: p.titel || 'Position',
      beschreibung: p.beschreibung || '',
      material: ((p.material || []) as Partial<MaterialPosten>[]).map((m, j) => ({
        id: baseId + i * 100 + j,
        bezeichnung: m.bezeichnung || '',
        menge: m.menge || 1,
        einheit: m.einheit || 'Stk',
        ekPreis: m.ekPreis || 0,
        aufschlag: m.aufschlag ?? 0.30,
      })),
      arbeitszeit: ((p.arbeitszeit || []) as Partial<ArbeitsPosten>[]).map((a, j) => ({
        id: baseId + i * 100 + 50 + j,
        kostenstelle: (a.kostenstelle || '03_00_Produktion') as KostenstelleId,
        minuten: a.minuten || 60,
        vkStunde: a.vkStunde || 65,
      })),
    }))

  // ── Start: Analyse + Positionen erstellen ─────────
  const startAnalyse = useCallback(async () => {
    if (!startText.trim()) return
    setStartStatus('loading')
    setStartMsg('KI analysiert...')
    try {
      const data = await callAI(startText, startBildB64, 'analyse')

      if (data.fragen?.length > 0) {
        setStartStatus('done')
        setStartMsg('🔍 Rückfragen – bitte ergänzen und erneut senden:\n• ' + (data.fragen as string[]).join('\n• '))
        return
      }

      if (data.kunde) {
        setKunde(prev => ({
          name: data.kunde.name || prev.name,
          zusatz: data.kunde.zusatz || prev.zusatz,
          strasse: data.kunde.strasse || prev.strasse,
          ort: data.kunde.ort || prev.ort,
          projekt: data.kunde.projekt || prev.projekt,
        }))
      }

      if (data.positionen?.length > 0) {
        setPos(mapPositionen(data.positionen, Date.now()))
      }

      if (data.anschreiben) setAnschr(data.anschreiben)

      setStartStatus('done')
      setStartMsg(`✓ ${data.positionen?.length || 0} Positionen erkannt. Bitte auf "Weiter" tippen und in der Kalkulation prüfen.`)
    } catch (e: unknown) {
      setStartStatus('error')
      setStartMsg(`Fehler: ${e instanceof Error ? e.message : 'Unbekannt'}`)
    }
  }, [startText, startBildB64, callAI])

  // ── Diktat Analyse ─────────────────────────────────
  const runDiktat = useCallback(async () => {
    if (!diktatText.trim()) { setDiktatMsg('Bitte Text eingeben.'); return }
    setDiktatStatus('loading')
    setDiktatMsg('KI analysiert...')
    try {
      if (diktatStufe === 'text') {
        setDiktatText(diktatText.replace(/\s+/g, ' ').trim())
        setDiktatStatus('done')
        setDiktatMsg('✓ Text bereinigt.')
        return
      }
      const data = await callAI(diktatText, diktatBildB64, 'analyse')

      if (data.fragen?.length > 0) {
        setDiktatStatus('done')
        setDiktatMsg('🔍 Rückfragen – bitte ergänzen und erneut senden:\n• ' + (data.fragen as string[]).join('\n• '))
        return
      }

      if (data.positionen?.length > 0) {
        setPos(mapPositionen(data.positionen, Date.now()))
        if (diktatStufe === 'komplett' && data.anschreiben) setAnschr(data.anschreiben)
      }
      setDiktatStatus('done')
      setDiktatMsg(`✓ ${data.positionen?.length || 0} Positionen → Kalkulation prüfen!`)
    } catch (e: unknown) {
      setDiktatStatus('error')
      setDiktatMsg(`Fehler: ${e instanceof Error ? e.message : 'Unbekannt'}`)
    }
  }, [diktatText, diktatBildB64, diktatStufe, callAI])

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
            💡 PDF speichern: Teilen-Symbol → "Als PDF sichern"
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
    return (
      <div style={{ fontFamily: 'Helvetica Neue,Helvetica,Arial,sans-serif', background: C.black, minHeight: '100vh', color: C.white }}>
        {/* Header */}
        <div style={{ background: C.darkbg, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: `2px solid ${C.copper}` }}>
          <LogoMark size={38} />
          <div>
            <div style={{ color: C.copper, fontSize: 17, fontWeight: 800, letterSpacing: 3 }}>CRAFTFLOW</div>
            <div style={{ color: C.textMid, fontSize: 9, letterSpacing: 2 }}>KI-ANGEBOTSSYSTEM · FS CRAFTED</div>
          </div>
        </div>

        <div style={{ padding: '16px 14px', maxWidth: 760, margin: '0 auto', boxSizing: 'border-box' }}>

          {/* Hero */}
          <div style={{ background: `linear-gradient(135deg,${C.gray1} 0%,#1a1208 100%)`, borderRadius: 8, padding: '20px 16px', marginBottom: 14, border: `1px solid ${C.copper}33`, textAlign: 'center' }}>
            <div style={{ fontSize: 34, marginBottom: 8 }}>🎤 📷 ➜ 📄</div>
            <div style={{ color: C.copper, fontSize: 18, fontWeight: 800, marginBottom: 6 }}>Sprechen. Fotografieren. Fertig.</div>
            <div style={{ color: C.textMid, fontSize: 12, lineHeight: 1.7, marginBottom: 14 }}>
              Beschreibe Kunde und Projekt in 30 Sekunden –{'\n'}CraftFlow erstellt das Angebot automatisch.
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
              {[{ icon: '🎤', l: 'Diktieren' }, { a: true }, { icon: '📷', l: 'Foto' }, { a: true }, { icon: '🔢', l: 'Kalkulation' }, { a: true }, { icon: '📄', l: 'Angebot' }]
                .map((s, i) => s.a
                  ? <div key={i} style={{ color: C.copper, fontSize: 14 }}>›</div>
                  : <div key={i} style={{ background: C.gray2, borderRadius: 4, padding: '6px 10px', textAlign: 'center', border: `1px solid ${C.border}` }}>
                    <div style={{ fontSize: 16 }}>{(s as {icon:string;l:string}).icon}</div>
                    <div style={{ fontSize: 9, color: C.textMid, marginTop: 2 }}>{(s as {icon:string;l:string}).l}</div>
                  </div>
                )}
            </div>
          </div>

          {/* Schritt 1: Kunde */}
          <Card accent={C.copper}>
            <div style={{ padding: '14px 16px' }}>
              <Lbl>Schritt 1 – Kunde</Lbl>
              <div style={{ display: 'flex', gap: 0, border: `1px solid ${C.border}`, borderRadius: 3, overflow: 'hidden', marginBottom: 12 }}>
                {[{ id: 'neu', l: '+ Neukunde' }, { id: 'bestand', l: '👤 Bestandskunde' }].map(t => (
                  <button key={t.id} onClick={() => setKundeTyp(t.id as 'neu' | 'bestand')} style={{ flex: 1, padding: '9px 4px', fontSize: 12, background: kundeTyp === t.id ? C.copper : C.gray2, color: kundeTyp === t.id ? C.black : C.textMid, border: 'none', cursor: 'pointer', fontFamily: 'Helvetica Neue,sans-serif', fontWeight: kundeTyp === t.id ? 700 : 400 }}>
                    {t.l}
                  </button>
                ))}
              </div>

              {kundeTyp === 'bestand' ? (
                <div>
                  <TxtInput value={kundeQuery} onChange={setKundeQuery} placeholder="Name oder Ort suchen..." />
                  <div style={{ marginTop: 8, maxHeight: 180, overflowY: 'auto' }}>
                    {gefilterteKunden.map(k => (
                      <div key={k.id} onClick={() => { setKunde({ name: k.name, zusatz: k.zusatz || '', strasse: k.strasse, ort: k.ort, projekt: '' }); setKundeQuery('') }}
                        style={{ padding: '10px 12px', background: C.gray2, borderRadius: 3, marginBottom: 6, cursor: 'pointer', border: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 13 }}>{k.name}</div>
                          <div style={{ color: C.textMid, fontSize: 11 }}>{k.strasse} · {k.ort}</div>
                        </div>
                        <div style={{ fontSize: 9, background: C.copper, color: C.black, padding: '2px 8px', borderRadius: 10, fontWeight: 700 }}>{k.typ}</div>
                      </div>
                    ))}
                    {gefilterteKunden.length === 0 && <div style={{ color: C.textMid, fontSize: 12, padding: '10px 0', textAlign: 'center' }}>Kein Kunde gefunden</div>}
                  </div>
                  {kunde.name && (
                    <div style={{ marginTop: 8, background: C.black, borderRadius: 3, padding: '10px 12px', border: `1px solid ${C.copper}44` }}>
                      <div style={{ color: C.copper, fontSize: 11, fontWeight: 700 }}>{kunde.name}</div>
                      <div style={{ color: C.textMid, fontSize: 11 }}>{kunde.strasse} · {kunde.ort}</div>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <div style={{ background: `${C.copper}18`, border: `1px solid ${C.copper}33`, borderRadius: 3, padding: '10px 12px', marginBottom: 10, fontSize: 12, color: C.white, lineHeight: 1.6 }}>
                    🎤 <strong style={{ color: C.copper }}>Tipp:</strong> Im Textfeld unten einfach diktieren – die KI erkennt automatisch Name, Adresse und Projekt aus deiner Beschreibung.
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    {[
                      { f: 'name' as keyof Kunde, l: 'Kundenname', p: 'z.B. Familie Müller' },
                      { f: 'projekt' as keyof Kunde, l: 'Bauvorhaben', p: 'z.B. TV-Board' },
                      { f: 'strasse' as keyof Kunde, l: 'Straße', p: 'z.B. Hauptstr. 12' },
                      { f: 'ort' as keyof Kunde, l: 'PLZ Ort', p: 'z.B. 63825 Schöllkrippen' },
                    ].map(({ f, l, p }) => (
                      <div key={f}>
                        <Lbl>{l}</Lbl>
                        <TxtInput value={kunde[f]} onChange={v => updK(f, v)} placeholder={p} />
                      </div>
                    ))}
                  </div>
                  {kunde.name && (
                    <button onClick={() => {
                      const neu: KundeDB = { id: Date.now(), ...kunde, typ: 'Privat' }
                      const updated = [...kunden, neu]
                      setKunden(updated); speichereKunden(updated)
                    }} style={{ marginTop: 8, background: 'transparent', color: C.copper, border: `1px solid ${C.copper}`, borderRadius: 3, padding: '7px 14px', cursor: 'pointer', fontSize: 11, fontFamily: 'Helvetica Neue,sans-serif' }}>
                      + In Kundendatenbank speichern
                    </button>
                  )}
                </div>
              )}
            </div>
          </Card>

          {/* Schritt 2: Projekt */}
          <Card>
            <div style={{ padding: '14px 16px' }}>
              <Lbl>Schritt 2 – Projekt beschreiben</Lbl>

              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 10 }}>
                <div style={{ flex: 1 }}>
                  <input ref={startFileRef} type="file" accept="image/*"
                    onChange={e => { const f = e.target.files?.[0]; if (f) loadBild(f, setStartBild, setStartBildB64) }}
                    style={{ display: 'none' }} />
                  <button onClick={() => startFileRef.current?.click()} style={{ width: '100%', padding: '9px', background: C.gray2, border: `1px dashed ${startBild ? C.copper : C.border}`, borderRadius: 3, color: startBild ? C.copper : C.textMid, fontSize: 12, cursor: 'pointer', fontFamily: 'Helvetica Neue,sans-serif' }}>
                    {startBild ? '✓ Foto vorhanden – neues auswählen' : '📷 Situationsfoto aufnehmen oder auswählen'}
                  </button>
                </div>
                {startBild && (
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    <img src={startBild} alt="Situation" style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 4, border: `2px solid ${C.copper}` }} />
                    <button onClick={() => { setStartBild(null); setStartBildB64(null) }} style={{ position: 'absolute', top: -6, right: -6, width: 18, height: 18, background: C.copper, color: C.black, border: 'none', borderRadius: '50%', cursor: 'pointer', fontSize: 10, fontWeight: 800, lineHeight: '18px', textAlign: 'center' }}>×</button>
                  </div>
                )}
              </div>

              <button onClick={() => startTextRef.current?.focus()} style={{ width: '100%', background: C.copper, color: C.black, border: 'none', borderRadius: 3, padding: '10px', cursor: 'pointer', fontSize: 12, fontFamily: 'Helvetica Neue,sans-serif', fontWeight: 700, marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <span style={{ fontSize: 16 }}>🎤</span> Textfeld öffnen & diktieren
              </button>

              <textarea ref={startTextRef} value={startText} onChange={e => setStartText(e.target.value)}
                placeholder={'Beispiel:\n"Kunde ist Sabrina Pürzl, Alter Kleinbahnweg 7, 63517 Gelnhausen Meerholz. Sie möchte ein TV-Board aus Eiche Massivholz, drei Teile: links Tür mit Regalfach, Mitte Klappe mit Akustikstoff für Soundbar, rechts zwei Schubladen. Rückwand aus Organoid Alm Heu. Montage ca. 10 Stunden."'}
                style={{ width: '100%', background: C.gray2, border: `1px solid ${C.border}`, borderRadius: 3, padding: 12, fontSize: 13, lineHeight: 1.7, color: C.white, fontFamily: 'Helvetica Neue,sans-serif', resize: 'vertical', minHeight: 120, boxSizing: 'border-box', outline: 'none' }} />

              <button onClick={startAnalyse} disabled={startStatus === 'loading' || !startText.trim()} style={{ width: '100%', marginTop: 10, background: (!startText.trim() || startStatus === 'loading') ? C.gray2 : C.copper, color: (!startText.trim() || startStatus === 'loading') ? C.textMid : C.black, border: 'none', borderRadius: 3, padding: '13px 0', cursor: (!startText.trim() || startStatus === 'loading') ? 'not-allowed' : 'pointer', fontSize: 13, fontFamily: 'Helvetica Neue,sans-serif', fontWeight: 800, letterSpacing: 1 }}>
                {startStatus === 'loading' ? '⟳ KI analysiert...' : '▶ ANGEBOT ERSTELLEN'}
              </button>

              {startMsg && (
                <div style={{ marginTop: 10, background: startStatus === 'done' ? '#0d1a0d' : '#1a0d0d', border: `1px solid ${startStatus === 'done' ? '#2a4a2a' : '#4a2a2a'}`, borderRadius: 3, padding: '10px 12px', fontSize: 12, color: startStatus === 'done' ? '#90EE90' : '#ff9999', whiteSpace: 'pre-line' }}>
                  {startMsg}
                </div>
              )}
            </div>
          </Card>

          <button onClick={() => setScreen('app')} style={{ width: '100%', background: C.copper, color: C.black, border: 'none', borderRadius: 4, padding: '15px 0', fontSize: 14, fontFamily: 'Helvetica Neue,sans-serif', fontWeight: 800, letterSpacing: 1, cursor: 'pointer', marginBottom: 20 }}>
            {kunde.name ? `▶ WEITER MIT "${kunde.name.split(' ').slice(-1)[0].toUpperCase()}"` : '▶ WEITER ZUR KALKULATION'}
          </button>

          <div style={{ textAlign: 'center', fontSize: 11, color: C.textMid, paddingBottom: 20 }}>
            CraftFlow · KI-Angebotssystem für Schreiner
          </div>
        </div>
      </div>
    )
  }

  /* ══════════════════════════════════════════════════
     SCREEN: APP (3 Tabs)
  ══════════════════════════════════════════════════ */
  const TABS = [
    { id: 'diktieren', label: '🎤 Diktieren' },
    { id: 'kalkulation', label: '🔢 Kalkulation' },
    { id: 'dokument', label: '📄 Dokument' },
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
          <div onClick={() => setScreen('start')} style={{ color: C.textMid, fontSize: 9, cursor: 'pointer', textDecoration: 'underline', marginTop: 2 }}>← Start</div>
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

        {/* ══ DIKTIEREN ══ */}
        {tab === 'diktieren' && (
          <div>
            {kunde.name && (
              <Card accent={C.copper} style={{ marginBottom: 12 }}>
                <div style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <Lbl>Aktueller Kunde</Lbl>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{kunde.name}</div>
                    <div style={{ color: C.textMid, fontSize: 11 }}>{kunde.projekt || '–'} · {kunde.ort}</div>
                  </div>
                  <button onClick={() => setScreen('start')} style={{ background: 'transparent', color: C.textMid, border: `1px solid ${C.border}`, borderRadius: 3, padding: '5px 10px', cursor: 'pointer', fontSize: 10, fontFamily: 'Helvetica Neue,sans-serif' }}>
                    ändern
                  </button>
                </div>
              </Card>
            )}

            <Card>
              <div style={{ padding: '12px 16px' }}>
                <Lbl>Situationsfoto (optional)</Lbl>
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <input ref={diktatFileRef} type="file" accept="image/*"
                      onChange={e => { const f = e.target.files?.[0]; if (f) loadBild(f, setDiktatBild, setDiktatBildB64) }}
                      style={{ display: 'none' }} />
                    <button onClick={() => diktatFileRef.current?.click()} style={{ width: '100%', padding: '9px', background: C.gray2, border: `1px dashed ${diktatBild ? C.copper : C.border}`, borderRadius: 3, color: diktatBild ? C.copper : C.textMid, fontSize: 12, cursor: 'pointer', fontFamily: 'Helvetica Neue,sans-serif' }}>
                      {diktatBild ? '✓ Foto vorhanden' : '📷 Foto aufnehmen oder auswählen'}
                    </button>
                  </div>
                  {diktatBild && (
                    <div style={{ position: 'relative', flexShrink: 0 }}>
                      <img src={diktatBild} alt="" style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 4, border: `2px solid ${C.copper}` }} />
                      <button onClick={() => { setDiktatBild(null); setDiktatBildB64(null) }} style={{ position: 'absolute', top: -6, right: -6, width: 18, height: 18, background: C.copper, color: C.black, border: 'none', borderRadius: '50%', cursor: 'pointer', fontSize: 10, fontWeight: 800, lineHeight: '18px', textAlign: 'center' }}>×</button>
                    </div>
                  )}
                </div>
              </div>
            </Card>

            <Card>
              <div style={{ padding: '12px 16px' }}>
                <Lbl>Was soll die KI tun?</Lbl>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                  {[
                    { id: 'text', icon: '📝', l: 'Nur transkribieren', d: 'Text formatieren – manuell anpassen' },
                    { id: 'extrakt', icon: '🔍', l: 'Positionen extrahieren', d: 'Leistungen erkennen & Positionen erstellen' },
                    { id: 'komplett', icon: '⚡', l: 'Komplettes Angebot', d: 'Alles automatisch – Positionen + Anschreiben' },
                  ].map(s => (
                    <div key={s.id} onClick={() => setDiktatStufe(s.id)}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', background: diktatStufe === s.id ? `${C.copper}22` : C.gray2, border: `1px solid ${diktatStufe === s.id ? C.copper : C.border}`, borderRadius: 3, cursor: 'pointer' }}>
                      <span style={{ fontSize: 18, flexShrink: 0 }}>{s.icon}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: 12, color: diktatStufe === s.id ? C.copper : C.white }}>{s.l}</div>
                        <div style={{ fontSize: 10, color: C.textMid }}>{s.d}</div>
                      </div>
                      <div style={{ width: 16, height: 16, borderRadius: '50%', border: `2px solid ${diktatStufe === s.id ? C.copper : C.border}`, background: diktatStufe === s.id ? C.copper : 'transparent' }} />
                    </div>
                  ))}
                </div>
              </div>
            </Card>

            <Card>
              <div style={{ padding: '12px 16px' }}>
                <Lbl>Projektbeschreibung</Lbl>
                <button onClick={() => diktatTextRef.current?.focus()} style={{ width: '100%', background: C.copper, color: C.black, border: 'none', borderRadius: 3, padding: '10px', cursor: 'pointer', fontSize: 12, fontFamily: 'Helvetica Neue,sans-serif', fontWeight: 700, marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <span style={{ fontSize: 16 }}>🎤</span> Textfeld öffnen & diktieren
                </button>
                <textarea ref={diktatTextRef} value={diktatText} onChange={e => setDiktatText(e.target.value)}
                  placeholder={'z.B. "TV-Board Eiche massiv, drei Teile, Klappe mit Akustikstoff, Schubladen, Rückwand Organoid, Montage 10 Stunden."'}
                  style={{ width: '100%', background: C.gray2, border: `1px solid ${C.border}`, borderRadius: 3, padding: 12, fontSize: 13, lineHeight: 1.7, color: C.white, fontFamily: 'Helvetica Neue,sans-serif', resize: 'vertical', minHeight: 100, boxSizing: 'border-box', outline: 'none' }} />
                <button onClick={runDiktat} disabled={diktatStatus === 'loading'} style={{ width: '100%', marginTop: 8, background: diktatStatus === 'loading' ? C.gray2 : C.copper, color: diktatStatus === 'loading' ? C.textMid : C.black, border: 'none', borderRadius: 3, padding: '12px 0', cursor: diktatStatus === 'loading' ? 'not-allowed' : 'pointer', fontSize: 12, fontFamily: 'Helvetica Neue,sans-serif', fontWeight: 800, letterSpacing: 1 }}>
                  {diktatStatus === 'loading' ? '⟳ KI analysiert...' : diktatStufe === 'text' ? '▶ TEXT FORMATIEREN' : diktatStufe === 'extrakt' ? '▶ POSITIONEN EXTRAHIEREN' : '▶ ANGEBOT ERSTELLEN'}
                </button>
              </div>
            </Card>

            {diktatMsg && (
              <Card accent={diktatStatus === 'done' ? '#4A7C6F' : '#cc3333'}>
                <div style={{ padding: '12px 16px' }}>
                  <div style={{ fontSize: 12, lineHeight: 1.8, color: diktatStatus === 'done' ? '#90EE90' : '#ff9999', whiteSpace: 'pre-line' }}>{diktatMsg}</div>
                  {diktatStatus === 'done' && <button onClick={() => setTab('kalkulation')} style={{ marginTop: 10, background: '#4A7C6F', color: '#fff', border: 'none', borderRadius: 3, padding: '8px 16px', cursor: 'pointer', fontSize: 11, fontFamily: 'Helvetica Neue,sans-serif', fontWeight: 700 }}>→ Zur Kalkulation</button>}
                </div>
              </Card>
            )}
          </div>
        )}

        {/* ══ KALKULATION ══ */}
        {tab === 'kalkulation' && (
          <div>
            {/* Netto / Brutto Übersicht */}
            <Card accent={C.copper}>
              <div style={{ padding: '12px 16px' }}>
                <div style={{ display: 'flex', background: C.black, borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ flex: 1, padding: '10px 14px' }}>
                    <Lbl c={C.textMid}>Netto</Lbl>
                    <div style={{ color: C.copper, fontSize: 19, fontWeight: 800 }}>{eur(totals.net)}</div>
                  </div>
                  <div style={{ width: 1, background: C.border }} />
                  <div style={{ flex: 1, padding: '10px 14px', textAlign: 'right' }}>
                    <Lbl c={C.textMid}>Brutto</Lbl>
                    <div style={{ color: C.white, fontSize: 15, fontWeight: 700 }}>{eur(gross)}</div>
                  </div>
                </div>
              </div>
            </Card>

            {/* Positionen */}
            {pos.map(p => {
              const gesamt = calcAngebotspos(p)
              const matTotal = p.material.reduce((sum, m) => sum + m.ekPreis * (1 + m.aufschlag) * m.menge, 0)
              const arbTotal = p.arbeitszeit.reduce((sum, a) => sum + (a.minuten / 60) * a.vkStunde, 0)
              return (
                <Card key={p.id} accent={C.copper}>
                  <div style={{ padding: '12px 14px' }}>

                    {/* Kopfzeile */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <input value={p.titel} onChange={e => updTitel(p.id, e.target.value)}
                          style={{ width: '100%', background: 'transparent', border: 'none', fontSize: 13, fontWeight: 700, color: C.white, fontFamily: 'Helvetica Neue,sans-serif', outline: 'none', display: 'block', marginBottom: 2 }} />
                        <textarea value={p.beschreibung} onChange={e => updBeschreibung(p.id, e.target.value)}
                          rows={2} style={{ width: '100%', background: 'transparent', border: 'none', fontSize: 11, color: C.textMid, resize: 'none', outline: 'none', fontFamily: 'Helvetica Neue,sans-serif', boxSizing: 'border-box' }} />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 800, color: C.copper }}>{eur(gesamt)}</div>
                        <button onClick={() => delPos(p.id)} style={{ background: 'transparent', color: C.textMid, border: `1px solid ${C.border}`, borderRadius: 3, padding: '2px 8px', cursor: 'pointer', fontSize: 10 }}>✕</button>
                      </div>
                    </div>

                    <HR color={C.border} my={8} />

                    {/* Material */}
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                        <Lbl>Material</Lbl>
                        {matTotal > 0 && <div style={{ fontSize: 10, color: C.copper, fontWeight: 700 }}>{eur(matTotal)}</div>}
                      </div>
                      {p.material.length > 0 && (
                        <div style={{ display: 'grid', gridTemplateColumns: '2fr 50px 40px 56px 36px 1fr 18px', gap: 3, marginBottom: 3 }}>
                          {['Bezeichnung', 'Menge', 'Einh.', 'EK €', '+%', 'VK ges.', ''].map((h, i) => (
                            <div key={i} style={{ fontSize: 7, color: C.textMid, letterSpacing: 1, textTransform: 'uppercase', paddingLeft: 2 }}>{h}</div>
                          ))}
                        </div>
                      )}
                      {p.material.map(m => {
                        const vk = m.ekPreis * (1 + m.aufschlag) * m.menge
                        return (
                          <div key={m.id} style={{ display: 'grid', gridTemplateColumns: '2fr 50px 40px 56px 36px 1fr 18px', gap: 3, marginBottom: 3, alignItems: 'center' }}>
                            <input value={m.bezeichnung} onChange={e => updMat(p.id, m.id, 'bezeichnung', e.target.value)}
                              placeholder="Bezeichnung"
                              style={{ padding: '4px 5px', background: C.gray2, border: `1px solid ${C.border}`, borderRadius: 2, fontSize: 10, color: C.white, fontFamily: 'Helvetica Neue,sans-serif', outline: 'none', boxSizing: 'border-box', minWidth: 0 }} />
                            <input type="number" step="0.01" value={m.menge} onChange={e => updMat(p.id, m.id, 'menge', parseFloat(e.target.value) || 0)}
                              style={{ padding: '4px 5px', background: C.gray2, border: `1px solid ${C.border}`, borderRadius: 2, fontSize: 10, color: C.white, fontFamily: 'Helvetica Neue,sans-serif', outline: 'none', boxSizing: 'border-box', minWidth: 0 }} />
                            <input value={m.einheit} onChange={e => updMat(p.id, m.id, 'einheit', e.target.value)}
                              style={{ padding: '4px 5px', background: C.gray2, border: `1px solid ${C.border}`, borderRadius: 2, fontSize: 10, color: C.white, fontFamily: 'Helvetica Neue,sans-serif', outline: 'none', boxSizing: 'border-box', minWidth: 0 }} />
                            <input type="number" step="0.01" value={m.ekPreis} onChange={e => updMat(p.id, m.id, 'ekPreis', parseFloat(e.target.value) || 0)}
                              style={{ padding: '4px 5px', background: C.gray2, border: `1px solid ${C.border}`, borderRadius: 2, fontSize: 10, color: C.white, fontFamily: 'Helvetica Neue,sans-serif', outline: 'none', boxSizing: 'border-box', minWidth: 0 }} />
                            <input type="number" step="1" value={Math.round(m.aufschlag * 100)} onChange={e => updMat(p.id, m.id, 'aufschlag', (parseFloat(e.target.value) || 0) / 100)}
                              style={{ padding: '4px 5px', background: C.gray2, border: `1px solid ${C.border}`, borderRadius: 2, fontSize: 10, color: C.white, fontFamily: 'Helvetica Neue,sans-serif', outline: 'none', boxSizing: 'border-box', minWidth: 0 }} />
                            <div style={{ fontSize: 10, color: C.copper, textAlign: 'right', fontWeight: 700 }}>{eur(vk)}</div>
                            <button onClick={() => delMat(p.id, m.id)} style={{ background: 'transparent', color: C.textMid, border: `1px solid ${C.border}`, borderRadius: 2, padding: '2px 3px', cursor: 'pointer', fontSize: 8, fontFamily: 'Helvetica Neue,sans-serif', lineHeight: 1 }}>✕</button>
                          </div>
                        )
                      })}
                      <button onClick={() => addMat(p.id)} style={{ width: '100%', background: 'transparent', color: C.textMid, border: `1px dashed ${C.border}`, borderRadius: 2, padding: '5px 0', cursor: 'pointer', fontSize: 10, fontFamily: 'Helvetica Neue,sans-serif', marginTop: 2 }}>
                        + Material
                      </button>
                    </div>

                    <HR color={C.border} my={6} />

                    {/* Arbeitszeit */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                        <Lbl>Arbeitszeit</Lbl>
                        {arbTotal > 0 && <div style={{ fontSize: 10, color: C.copper, fontWeight: 700 }}>{eur(arbTotal)}</div>}
                      </div>
                      {p.arbeitszeit.length > 0 && (
                        <div style={{ display: 'grid', gridTemplateColumns: '3fr 52px 48px 1fr 18px', gap: 3, marginBottom: 3 }}>
                          {['Kostenstelle', 'Min', '€/h', 'Kosten', ''].map((h, i) => (
                            <div key={i} style={{ fontSize: 7, color: C.textMid, letterSpacing: 1, textTransform: 'uppercase', paddingLeft: 2 }}>{h}</div>
                          ))}
                        </div>
                      )}
                      {p.arbeitszeit.map(a => {
                        const kosten = (a.minuten / 60) * a.vkStunde
                        return (
                          <div key={a.id} style={{ display: 'grid', gridTemplateColumns: '3fr 52px 48px 1fr 18px', gap: 3, marginBottom: 3, alignItems: 'center' }}>
                            <select value={a.kostenstelle} onChange={e => updArbKs(p.id, a.id, e.target.value as KostenstelleId)}
                              style={{ padding: '4px 5px', background: C.gray2, border: `1px solid ${C.border}`, borderRadius: 2, fontSize: 10, color: C.white, fontFamily: 'Helvetica Neue,sans-serif', outline: 'none', minWidth: 0 }}>
                              {KOSTENSTELLEN_LIST.map(ks => (
                                <option key={ks} value={ks}>{KOSTENSTELLE_LABELS[ks]}</option>
                              ))}
                            </select>
                            <input type="number" step="1" value={a.minuten} onChange={e => updArb(p.id, a.id, 'minuten', parseFloat(e.target.value) || 0)}
                              style={{ padding: '4px 5px', background: C.gray2, border: `1px solid ${C.border}`, borderRadius: 2, fontSize: 10, color: C.white, fontFamily: 'Helvetica Neue,sans-serif', outline: 'none', boxSizing: 'border-box', minWidth: 0 }} />
                            <input type="number" step="0.5" value={a.vkStunde} onChange={e => updArb(p.id, a.id, 'vkStunde', parseFloat(e.target.value) || 0)}
                              style={{ padding: '4px 5px', background: C.gray2, border: `1px solid ${C.border}`, borderRadius: 2, fontSize: 10, color: C.white, fontFamily: 'Helvetica Neue,sans-serif', outline: 'none', boxSizing: 'border-box', minWidth: 0 }} />
                            <div style={{ fontSize: 10, color: C.copper, textAlign: 'right', fontWeight: 700 }}>{eur(kosten)}</div>
                            <button onClick={() => delArb(p.id, a.id)} style={{ background: 'transparent', color: C.textMid, border: `1px solid ${C.border}`, borderRadius: 2, padding: '2px 3px', cursor: 'pointer', fontSize: 8, fontFamily: 'Helvetica Neue,sans-serif', lineHeight: 1 }}>✕</button>
                          </div>
                        )
                      })}
                      <button onClick={() => addArb(p.id)} style={{ width: '100%', background: 'transparent', color: C.textMid, border: `1px dashed ${C.border}`, borderRadius: 2, padding: '5px 0', cursor: 'pointer', fontSize: 10, fontFamily: 'Helvetica Neue,sans-serif', marginTop: 2 }}>
                        + Arbeitsgang
                      </button>
                    </div>

                  </div>
                </Card>
              )
            })}

            <button onClick={addPos} style={{ width: '100%', background: 'transparent', color: C.textMid, border: `1px dashed ${C.border}`, borderRadius: 4, padding: '11px 0', cursor: 'pointer', fontSize: 12, fontFamily: 'Helvetica Neue,sans-serif', marginBottom: 12 }}>
              + Position hinzufügen
            </button>

            <div style={{ background: C.darkbg, borderRadius: 4, border: `1px solid ${C.copper}44`, overflow: 'hidden' }}>
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
          </div>
        )}

        {/* ══ DOKUMENT ══ */}
        {tab === 'dokument' && (
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
                  const gesamt = calcAngebotspos(p)
                  return (
                    <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: i < pos.length - 1 ? `1px solid ${C.border}` : 'none', gap: 8, alignItems: 'flex-start' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, lineHeight: 1.2 }}>{p.titel}</div>
                        {p.beschreibung && <div style={{ fontSize: 10, color: C.textMid, marginTop: 2 }}>{p.beschreibung}</div>}
                      </div>
                      <div style={{ fontWeight: 800, fontSize: 12, color: C.copper, flexShrink: 0 }}>{eur(gesamt)}</div>
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
