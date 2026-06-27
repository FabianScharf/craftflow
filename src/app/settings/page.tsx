'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/utils/supabase/client'
import { PlanGate } from '@/components/PlanGate'

import { LieferantenSettings } from '@/components/settings/LieferantenSettings'
import { EmailSettings } from '@/components/settings/EmailSettings'
import { type Plan, usePlan } from '@/hooks/usePlan'

const C = {
  black:   'var(--c-primary, #0D0D0D)',
  dark:    '#141414',
  gray1:   '#1A1A1A',
  gray2:   '#222222',
  border:  '#2E2E2E',
  copper:  'var(--c-accent, #C8885A)',
  white:   '#F5F2EE',
  textMid: '#8A8A8A',
  ok:      '#5ABE6A',
  err:     '#E05A5A',
}

const inp = (extra?: React.CSSProperties): React.CSSProperties => ({
  width: '100%', boxSizing: 'border-box',
  padding: '9px 11px', background: C.gray2,
  border: `1px solid ${C.border}`, borderRadius: 4,
  fontSize: 13, color: C.white,
  fontFamily: 'Helvetica Neue,sans-serif', outline: 'none',
  ...extra,
})

const lbl: React.CSSProperties = {
  fontSize: 10, letterSpacing: 2, textTransform: 'uppercase',
  color: C.textMid, marginBottom: 4, display: 'block',
}

const STANDARD_CODES = [
  '00_Meeting','01_02_Planung','02_01_Konstruktion','02_02_Arbeitsvorbereitung',
  '03_00_Produktion','03_01_Warenhandling','03_02_Zuschnitt','03_03_Bekantung',
  '03_04_CNC','03_05_Oberflaechenbehandlung','03_06_Zusammenbau','03_07_Verpacken',
  '03_08_Azubi','05_01_Montage','06_01_Lieferung',
]

const DEFAULT_MATERIALGRUPPEN = [
  'Massivholz','Plattenwerkstoffe','Beschläge','Handelsware',
  'Oberflächenmaterialien','Montagematerial',
]

type Profil = Record<string, string>
type Kostenstelle = {
  id: string; code: string; bezeichnung: string; stundensatz: number
  aktiv: boolean; gruppe: string | null; reihenfolge: number; ist_standard: boolean
}
type Materialgruppe = {
  id: string; name: string; aufschlag_prozent: number; reihenfolge: number; aktiv: boolean
}

const GRUPPEN_ORDER = ['Verwaltung','Planung','Konstruktion','Produktion','Montage','Lieferung']

const PLANS: { id: Plan; name: string; price: number; priceId: string; angebote: string; features: string[] }[] = [
  { id: 'solo',       name: 'Solo',       price: 7,  priceId: 'price_1TmSblRvozvhvO9J3EKljmMh', angebote: '3 / Monat',         features: ['Spracheingabe & KI-Kalkulation','PDF-Angebot erstellen','1 Benutzer'] },
  { id: 'starter',    name: 'Starter',    price: 29, priceId: 'price_1TmScDRvozvhvO9J9tvsywrG', angebote: '15 / Monat',        features: ['Alles aus Solo','Bilder & PDFs hochladen','Kalkulationsexport (CSV/Excel)','Lieferantenanfrage über CraftFlow','Bis zu 3 Benutzer'] },
  { id: 'pro',        name: 'Pro',        price: 49, priceId: 'price_1TmScSRvozvhvO9J0RF42acJ', angebote: '50 / Monat',        features: ['Alles aus Starter','Lieferantenanfrage über eigene E-Mail (SMTP)'] },
  { id: 'enterprise', name: 'Enterprise', price: 79, priceId: 'price_1TmSchRvozvhvO9JOduoM8KU', angebote: 'Unbegrenzt',        features: ['Alles aus Pro','GAEB-Import & Kalkulation','Priorisierter Support'] },
]

function groupKostenstellen(list: Kostenstelle[]): Record<string, Kostenstelle[]> {
  const map: Record<string, Kostenstelle[]> = {}
  for (const k of list) {
    const g = k.gruppe ?? 'Sonstige'
    if (!map[g]) map[g] = []
    map[g].push(k)
  }
  return map
}

export default function SettingsPage() {
  const { isInTrial, trialDaysLeft } = usePlan()
  const [section, setSection] = useState<'firma' | 'marketing' | 'kostenstellen' | 'warenaufschlaege' | 'lieferanten' | 'email' | 'buchhaltung' | 'auswertung' | 'dokumente' | 'plan'>('firma')
  const [isMobile, setIsMobile] = useState(false)
  const [mobileShowContent, setMobileShowContent] = useState(false)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null)
  const [loadingPortal, setLoadingPortal] = useState(false)
  const [stripeMsg, setStripeMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  const [profil, setProfil] = useState<Profil>({})
  const [profilSaving, setProfilSaving] = useState(false)
  const [profilMsg, setProfilMsg] = useState('')

  const [kostenstellen, setKostenstellen] = useState<Kostenstelle[]>([])
  const [ksMsg, setKsMsg] = useState<Record<string, string>>({})
  const [newKs, setNewKs] = useState({ code: '', bezeichnung: '', stundensatz: 65, gruppe: '' })
  const [showNewKs, setShowNewKs] = useState(false)

  const [materialgruppen, setMaterialgruppen] = useState<Materialgruppe[]>([])
  const [mgMsg, setMgMsg] = useState<Record<string, string>>({})
  const [newMg, setNewMg] = useState({ name: '', aufschlag_prozent: 30 })
  const [showNewMg, setShowNewMg] = useState(false)

  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [logoUploading, setLogoUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const [userEmail, setUserEmail] = useState('')

  async function loadAll() {
    const [bpRes, ksRes, mgRes] = await Promise.all([
      fetch('/api/settings/betriebsprofil').then(r => r.json()).catch(() => ({})),
      fetch('/api/settings/kostenstellen').then(r => r.json()).catch(() => ({})),
      fetch('/api/settings/materialgruppen').then(r => r.json()).catch(() => ({})),
    ])

    if (bpRes.profil) {
      setProfil(bpRes.profil)
      if (bpRes.profil.logo_url) setLogoPreview(bpRes.profil.logo_url)
    }

    const ks: Kostenstelle[] = ksRes.kostenstellen ?? []
    const mg: Materialgruppe[] = mgRes.materialgruppen ?? []

    if (ks.length === 0) {
      await fetch('/api/settings/init', { method: 'POST' }).catch(() => {})
      const [ks2, mg2] = await Promise.all([
        fetch('/api/settings/kostenstellen').then(r => r.json()).catch(() => ({})),
        fetch('/api/settings/materialgruppen').then(r => r.json()).catch(() => ({})),
      ])
      setKostenstellen(ks2.kostenstellen ?? [])
      setMaterialgruppen(mg2.materialgruppen ?? [])
    } else {
      setKostenstellen(ks)
      setMaterialgruppen(mg)
    }
  }

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      setUserEmail(data.user?.email ?? '')
    })
    loadAll()

    const params = new URLSearchParams(window.location.search)
    if (params.get('stripe') === 'success') {
      setStripeMsg({ type: 'ok', text: 'Plan erfolgreich aktiviert!' })
      setSection('plan')
      window.history.replaceState({}, '', '/settings')
    } else if (params.get('stripe') === 'cancelled') {
      setStripeMsg({ type: 'err', text: 'Checkout abgebrochen.' })
      setSection('plan')
      window.history.replaceState({}, '', '/settings')
    }
  }, [])

  function setP(key: string, val: string) {
    setProfil(prev => ({ ...prev, [key]: val }))
  }

  async function saveProfil() {
    setProfilSaving(true)
    setProfilMsg('')
    const res = await fetch('/api/settings/betriebsprofil', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...profil, onboarding_abgeschlossen: true }),
    })
    setProfilSaving(false)
    setProfilMsg(res.ok ? 'Gespeichert.' : 'Fehler beim Speichern.')
    if (res.ok) {
      const root = document.documentElement
      if (profil.farbe_primaer) root.style.setProperty('--c-primary', profil.farbe_primaer)
      if (profil.farbe_akzent) root.style.setProperty('--c-accent', profil.farbe_akzent)
    }
    setTimeout(() => setProfilMsg(''), 3000)
  }

  async function saveKs(ks: Kostenstelle, field: 'stundensatz' | 'aktiv', val: number | boolean) {
    const res = await fetch('/api/settings/kostenstellen', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: ks.id, [field]: val }),
    })
    setKsMsg(prev => ({ ...prev, [ks.id]: res.ok ? '✓' : 'Fehler' }))
    if (res.ok) {
      setKostenstellen(prev => prev.map(k => k.id === ks.id ? { ...k, [field]: val } : k))
      setTimeout(() => setKsMsg(prev => { const n = { ...prev }; delete n[ks.id]; return n }), 2000)
    }
  }

  async function deleteKs(id: string) {
    const res = await fetch('/api/settings/kostenstellen', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    if (res.ok) setKostenstellen(prev => prev.filter(k => k.id !== id))
  }

  async function addKs() {
    if (!newKs.code || !newKs.bezeichnung) return
    const res = await fetch('/api/settings/kostenstellen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newKs),
    })
    const d = await res.json()
    if (d.kostenstelle) {
      setKostenstellen(prev => [...prev, d.kostenstelle])
      setNewKs({ code: '', bezeichnung: '', stundensatz: 65, gruppe: '' })
      setShowNewKs(false)
    }
  }

  async function saveMg(id: string, name: string, aufschlag: number) {
    const res = await fetch('/api/settings/materialgruppen', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, name, aufschlag_prozent: aufschlag }),
    })
    setMgMsg(prev => ({ ...prev, [id]: res.ok ? '✓' : 'Fehler' }))
    if (res.ok) {
      setMaterialgruppen(prev => prev.map(m => m.id === id ? { ...m, name, aufschlag_prozent: aufschlag } : m))
      setTimeout(() => setMgMsg(prev => { const n = { ...prev }; delete n[id]; return n }), 2000)
    }
  }

  async function deleteMg(id: string, name: string) {
    if (DEFAULT_MATERIALGRUPPEN.includes(name)) return
    const res = await fetch('/api/settings/materialgruppen', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    if (res.ok) setMaterialgruppen(prev => prev.filter(m => m.id !== id))
  }

  async function addMg() {
    if (!newMg.name) return
    const res = await fetch('/api/settings/materialgruppen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newMg),
    })
    const d = await res.json()
    if (d.materialgruppe) {
      setMaterialgruppen(prev => [...prev, d.materialgruppe])
      setNewMg({ name: '', aufschlag_prozent: 30 })
      setShowNewMg(false)
    }
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setLogoUploading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLogoUploading(false); return }

    const ext = file.name.split('.').pop() ?? 'png'
    const path = `${user.id}/logo.${ext}`
    const { error } = await supabase.storage.from('logos').upload(path, file, { upsert: true })
    if (error) { setLogoUploading(false); return }

    const { data: urlData } = supabase.storage.from('logos').getPublicUrl(path)
    const logo_url = urlData.publicUrl
    setLogoPreview(logo_url)
    setP('logo_url', logo_url)
    await fetch('/api/settings/betriebsprofil', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ logo_url }),
    })
    setLogoUploading(false)
  }

  async function selectPlan(priceId: string, planId: string) {
    if (planId === userPlan) return
    setCheckoutLoading(priceId)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId }),
      })
      const { url, error } = await res.json()
      if (error) { setStripeMsg({ type: 'err', text: error }); setCheckoutLoading(null); return }
      window.location.href = url
    } catch {
      setStripeMsg({ type: 'err', text: 'Fehler beim Öffnen des Checkouts.' })
      setCheckoutLoading(null)
    }
  }

  async function openPortal() {
    setLoadingPortal(true)
    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST' })
      const { url, error } = await res.json()
      if (error) { setStripeMsg({ type: 'err', text: error }); setLoadingPortal(false); return }
      window.location.href = url
    } catch {
      setStripeMsg({ type: 'err', text: 'Fehler beim Öffnen des Kundenportals.' })
      setLoadingPortal(false)
    }
  }

  async function logout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  const userPlan = (profil.plan as Plan | undefined) ?? 'solo'

  const navItems: { id: typeof section; label: string; icon: string; minPlan?: Plan }[] = [
    { id: 'firma',            label: 'Firmendaten',     icon: '🏢' },
    { id: 'buchhaltung',      label: 'Buchhaltung',     icon: '🧾' },
    { id: 'dokumente',        label: 'Dokumente',       icon: '📝' },
    { id: 'auswertung',       label: 'Auswertung',      icon: '📊' },
    { id: 'marketing',        label: 'Marketing & CI',  icon: '🎨' },
    { id: 'kostenstellen',    label: 'Kostenstellen',   icon: '⏱' },
    { id: 'warenaufschlaege', label: 'Warenaufschläge', icon: '📦' },
    { id: 'lieferanten',      label: 'Lieferanten',     icon: '🏭', minPlan: 'starter' },
    { id: 'email',            label: 'E-Mail & Versand', icon: '✉️', minPlan: 'starter' },
    { id: 'plan',             label: 'Mein Plan',       icon: '💳' },
  ]

  const groups = groupKostenstellen(kostenstellen)
  const allGruppen = [...new Set([...GRUPPEN_ORDER, ...Object.keys(groups)])]

  return (
    <div suppressHydrationWarning style={{ background: C.black, minHeight: '100vh', fontFamily: 'Helvetica Neue,sans-serif', color: C.white }}>

      {/* Top bar */}
      <div style={{ borderBottom: `1px solid ${C.border}`, padding: '0 16px', display: 'flex', alignItems: 'center', height: 52, gap: 12, position: 'sticky', top: 0, zIndex: 10, background: C.black }}>
        <button
          onClick={() => {
            if (isMobile && mobileShowContent) { setMobileShowContent(false) }
            else { window.history.back() }
          }}
          style={{ background: 'none', border: 'none', color: C.textMid, cursor: 'pointer', fontSize: 18, padding: 0, lineHeight: 1 }}
        >←</button>
        <span style={{ color: C.copper, fontWeight: 800, letterSpacing: 2, fontSize: 13 }}>
          {isMobile && mobileShowContent
            ? navItems.find(n => n.id === section)?.label ?? 'EINSTELLUNGEN'
            : 'EINSTELLUNGEN'}
        </span>
      </div>

      <div style={{ display: 'flex', maxWidth: 960, margin: '0 auto' }}>

        {/* Sidebar — auf Mobile nur wenn kein Inhalt gezeigt */}
        {(!isMobile || !mobileShowContent) && (
          <div style={{
            width: isMobile ? '100%' : 210,
            flexShrink: 0,
            borderRight: isMobile ? 'none' : `1px solid ${C.border}`,
            minHeight: 'calc(100vh - 52px)',
            padding: isMobile ? '8px 0' : '16px 0',
            display: 'flex', flexDirection: 'column',
          }}>
            {navItems.map(item => (
              <button
                key={item.id}
                onClick={() => { setSection(item.id); if (isMobile) setMobileShowContent(true) }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  width: '100%', padding: isMobile ? '15px 20px' : '11px 20px', border: 'none', cursor: 'pointer',
                  background: !isMobile && section === item.id ? C.gray2 : 'transparent',
                  color: C.white,
                  fontSize: isMobile ? 15 : 13, fontFamily: 'Helvetica Neue,sans-serif', textAlign: 'left',
                  borderLeft: !isMobile && section === item.id ? `3px solid ${C.copper}` : isMobile ? 'none' : '3px solid transparent',
                  borderBottom: isMobile ? `1px solid ${C.border}` : 'none',
                }}
              >
                <span style={{ fontSize: isMobile ? 20 : 15 }}>{item.icon}</span>
                <span style={{ flex: 1 }}>{item.label}</span>
                {item.minPlan && userPlan === 'solo' && (
                  <span style={{ fontSize: 9, color: C.copper, border: `1px solid ${C.copper}50`, borderRadius: 3, padding: '1px 4px', letterSpacing: 0.5, flexShrink: 0 }}>
                    Starter
                  </span>
                )}
                {isMobile && <span style={{ color: C.textMid, fontSize: 16 }}>›</span>}
              </button>
            ))}

            {isInTrial && (
              <div
                onClick={() => { setSection('plan'); if (isMobile) setMobileShowContent(true) }}
                style={{ margin: '12px 12px 0', background: `${C.copper}15`, border: `1px solid ${C.copper}44`, borderRadius: 8, padding: '10px 12px', cursor: 'pointer' }}
              >
                <div style={{ fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', color: C.copper, marginBottom: 3 }}>🎁 Testversion</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.white }}>{trialDaysLeft} {trialDaysLeft === 1 ? 'Tag' : 'Tage'} verbleiben</div>
                <div style={{ fontSize: 11, color: C.textMid, marginTop: 2 }}>Plan wählen →</div>
              </div>
            )}

            <div style={{ marginTop: 'auto', padding: '24px 20px 16px', borderTop: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 12, color: C.textMid, marginBottom: 8, wordBreak: 'break-all' }}>{userEmail}</div>
              <button
                onClick={logout}
                style={{ background: 'none', border: 'none', color: C.err, fontSize: 13, cursor: 'pointer', padding: 0 }}
              >Abmelden</button>
            </div>
          </div>
        )}

        {/* Main content — auf Mobile nur wenn Inhalt gewählt */}
        {(!isMobile || mobileShowContent) && (
        <div style={{ flex: 1, padding: isMobile ? '20px 16px' : '24px 20px', maxWidth: 680, minWidth: 0, width: '100%' }}>

          {/* BEREICH 1 — FIRMENDATEN */}
          {section === 'firma' && (
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20, color: C.white }}>Firmendaten</h2>
              <div style={{ display: 'grid', gap: 14 }}>
                <Field label="Firmenname" value={profil.firma_name ?? ''} onChange={v => setP('firma_name', v)} />
                <Field label="Inhaber / Geschäftsführer" value={profil.inhaber ?? ''} onChange={v => setP('inhaber', v)} />
                <Field label="Zusatz (z.B. GmbH, Meisterbetrieb)" value={profil.firma_zusatz ?? ''} onChange={v => setP('firma_zusatz', v)} />

                <Divider />

                <Field label="Straße & Hausnummer" value={profil.strasse ?? ''} onChange={v => setP('strasse', v)} />
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '90px 1fr' : '100px 1fr', gap: 10 }}>
                  <Field label="PLZ" value={profil.plz ?? ''} onChange={v => setP('plz', v)} />
                  <Field label="Ort" value={profil.ort ?? ''} onChange={v => setP('ort', v)} />
                </div>
                <Field label="Telefon" value={profil.telefon ?? ''} onChange={v => setP('telefon', v)} type="tel" />
                <Field label="E-Mail" value={profil.email ?? ''} onChange={v => setP('email', v)} type="email" />
                <Field label="Website" value={profil.website ?? ''} onChange={v => setP('website', v)} />

              </div>
              <SaveRow saving={profilSaving} msg={profilMsg} onSave={saveProfil} />
            </div>
          )}

          {/* BEREICH 2 — MARKETING & CI */}
          {section === 'marketing' && (
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20, color: C.white }}>Marketing & CI</h2>
              <div style={{ display: 'grid', gap: 20 }}>

                <div>
                  <label style={lbl}>Primärfarbe (Hintergrund)</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <input
                      type="color"
                      value={profil.farbe_primaer || '#0D0D0D'}
                      onChange={e => setP('farbe_primaer', e.target.value)}
                      style={{ width: 46, height: 36, border: `1px solid ${C.border}`, borderRadius: 4, background: 'none', cursor: 'pointer', padding: 2, flexShrink: 0 }}
                    />
                    <input
                      value={profil.farbe_primaer || '#0D0D0D'}
                      onChange={e => setP('farbe_primaer', e.target.value)}
                      style={inp({ width: 110 })}
                      maxLength={7}
                      placeholder="#0D0D0D"
                    />
                  </div>
                </div>

                <div>
                  <label style={lbl}>Akzentfarbe (Buttons / Highlights)</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <input
                      type="color"
                      value={profil.farbe_akzent || '#C8885A'}
                      onChange={e => setP('farbe_akzent', e.target.value)}
                      style={{ width: 46, height: 36, border: `1px solid ${C.border}`, borderRadius: 4, background: 'none', cursor: 'pointer', padding: 2, flexShrink: 0 }}
                    />
                    <input
                      value={profil.farbe_akzent || '#C8885A'}
                      onChange={e => setP('farbe_akzent', e.target.value)}
                      style={inp({ width: 110 })}
                      maxLength={7}
                      placeholder="#C8885A"
                    />
                  </div>
                </div>

                {/* Live-Vorschau */}
                <div>
                  <label style={lbl}>Vorschau</label>
                  <div style={{ borderRadius: 8, overflow: 'hidden', border: `1px solid ${C.border}` }}>
                    <div style={{ background: profil.farbe_primaer || '#0D0D0D', padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
                      {logoPreview && <img src={logoPreview} alt="Logo" style={{ height: 26, width: 'auto' }} />}
                      <span style={{ color: profil.farbe_akzent || '#C8885A', fontWeight: 800, letterSpacing: 3, fontSize: 13 }}>
                        {profil.firma_name || 'FIRMENNAME'}
                      </span>
                    </div>
                    <div style={{ background: profil.farbe_primaer || '#0D0D0D', padding: '10px 18px 14px', display: 'flex', gap: 8 }}>
                      <div style={{ background: profil.farbe_akzent || '#C8885A', borderRadius: 4, padding: '7px 14px', fontSize: 12, fontWeight: 700, color: profil.farbe_primaer || '#0D0D0D' }}>
                        Speichern
                      </div>
                      <div style={{ border: `1px solid ${profil.farbe_akzent || '#C8885A'}`, borderRadius: 4, padding: '7px 14px', fontSize: 12, color: profil.farbe_akzent || '#C8885A' }}>
                        Abbrechen
                      </div>
                    </div>
                  </div>
                </div>

                <Divider label="Logo" />

                {logoPreview && (
                  <div style={{ padding: 12, background: C.gray2, borderRadius: 6, border: `1px solid ${C.border}`, display: 'inline-block' }}>
                    <img src={logoPreview} alt="Logo-Vorschau" style={{ maxHeight: 60, maxWidth: 200, display: 'block' }} />
                  </div>
                )}
                <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleLogoUpload} />
                <div>
                  <button
                    onClick={() => fileRef.current?.click()}
                    disabled={logoUploading}
                    style={{ background: C.gray2, border: `1px solid ${C.border}`, color: C.white, borderRadius: 5, padding: '9px 16px', fontSize: 13, cursor: 'pointer', fontFamily: 'Helvetica Neue,sans-serif' }}
                  >
                    {logoUploading ? 'Wird hochgeladen …' : logoPreview ? 'Logo ersetzen' : 'Logo hochladen'}
                  </button>
                  <div style={{ fontSize: 11, color: C.textMid, marginTop: 6 }}>PNG, SVG oder WebP, max. 2 MB. Erscheint im PDF-Angebot.</div>
                </div>
              </div>
              <SaveRow saving={profilSaving} msg={profilMsg} onSave={saveProfil} />
            </div>
          )}

          {/* BEREICH 3 — KOSTENSTELLEN */}
          {section === 'kostenstellen' && (
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4, color: C.white }}>Kostenstellen</h2>
              <p style={{ fontSize: 12, color: C.textMid, marginBottom: 20 }}>Stundensatz direkt editieren — wird sofort gespeichert. Toggle ✓/○ aktiviert oder deaktiviert die Kostenstelle.</p>

              {allGruppen.map(gruppe => {
                const items = groups[gruppe]
                if (!items || items.length === 0) return null
                return (
                  <div key={gruppe} style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 10, letterSpacing: 2, color: C.textMid, textTransform: 'uppercase', marginBottom: 8 }}>{gruppe}</div>
                    {items.map(ks => (
                      <div key={ks.id}>
                        <div style={{
                          display: 'grid', gridTemplateColumns: '1fr 100px 44px 28px',
                          alignItems: 'center', gap: 8, marginBottom: 6,
                          padding: '8px 10px', background: C.gray1,
                          borderRadius: 4, border: `1px solid ${C.border}`,
                          opacity: ks.aktiv ? 1 : 0.45,
                        }}>
                          <div>
                            <div style={{ fontSize: 13, color: C.white }}>{ks.bezeichnung}</div>
                            <div style={{ fontSize: 10, color: C.textMid }}>{ks.code}</div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <input
                              type="number"
                              defaultValue={ks.stundensatz}
                              onBlur={e => {
                                const v = parseFloat(e.target.value) || 0
                                if (v !== ks.stundensatz) saveKs(ks, 'stundensatz', v)
                              }}
                              style={{ ...inp({ padding: '5px 7px', fontSize: 13, textAlign: 'right' }), width: '100%' }}
                            />
                            <span style={{ fontSize: 11, color: C.textMid, whiteSpace: 'nowrap' }}>€/h</span>
                          </div>
                          <button
                            onClick={() => saveKs(ks, 'aktiv', !ks.aktiv)}
                            style={{
                              background: ks.aktiv ? 'rgba(90,190,106,.15)' : C.gray2,
                              border: `1px solid ${ks.aktiv ? C.ok : C.border}`,
                              borderRadius: 4, color: ks.aktiv ? C.ok : C.textMid,
                              fontSize: 14, cursor: 'pointer', padding: '5px 0', width: '100%',
                            }}
                          >{ks.aktiv ? '✓' : '○'}</button>
                          {!STANDARD_CODES.includes(ks.code) ? (
                            <button
                              onClick={() => deleteKs(ks.id)}
                              style={{ background: 'none', border: 'none', color: C.err, fontSize: 16, cursor: 'pointer', padding: 0, lineHeight: 1 }}
                            >×</button>
                          ) : <div />}
                        </div>
                        {ksMsg[ks.id] && (
                          <div style={{ fontSize: 11, color: C.ok, marginTop: -4, marginBottom: 4, paddingLeft: 10 }}>{ksMsg[ks.id]}</div>
                        )}
                      </div>
                    ))}
                  </div>
                )
              })}

              {showNewKs ? (
                <div style={{ background: C.gray1, border: `1px solid ${C.border}`, borderRadius: 6, padding: 14, marginTop: 12 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 10, marginBottom: 10 }}>
                    <Field label="Code (z.B. 07_Sonstiges)" value={newKs.code} onChange={v => setNewKs(p => ({ ...p, code: v }))} />
                    <Field label="Bezeichnung" value={newKs.bezeichnung} onChange={v => setNewKs(p => ({ ...p, bezeichnung: v }))} />
                    <Field label="Stundensatz (€/h)" value={String(newKs.stundensatz)} onChange={v => setNewKs(p => ({ ...p, stundensatz: parseFloat(v) || 0 }))} type="number" />
                    <Field label="Gruppe" value={newKs.gruppe} onChange={v => setNewKs(p => ({ ...p, gruppe: v }))} />
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={addKs} style={{ background: C.copper, color: C.black, border: 'none', borderRadius: 5, padding: '8px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'Helvetica Neue,sans-serif' }}>Hinzufügen</button>
                    <button onClick={() => setShowNewKs(false)} style={{ background: C.gray2, border: `1px solid ${C.border}`, color: C.textMid, borderRadius: 5, padding: '8px 14px', fontSize: 13, cursor: 'pointer', fontFamily: 'Helvetica Neue,sans-serif' }}>Abbrechen</button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowNewKs(true)}
                  style={{ marginTop: 8, background: 'none', border: `1px dashed ${C.border}`, color: C.textMid, borderRadius: 5, padding: '9px 16px', fontSize: 13, cursor: 'pointer', width: '100%', fontFamily: 'Helvetica Neue,sans-serif' }}
                >+ Neue Kostenstelle</button>
              )}
            </div>
          )}

          {/* BEREICH 4 — WARENAUFSCHLÄGE */}
          {section === 'warenaufschlaege' && (
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4, color: C.white }}>Warenaufschläge</h2>
              <p style={{ fontSize: 12, color: C.textMid, marginBottom: 20 }}>Aufschlag auf den Materialeinkaufspreis — deckt Beschaffung, Lager und Verschnitt ab.</p>

              {materialgruppen.map(mg => (
                <MgRow
                  key={mg.id}
                  mg={mg}
                  msg={mgMsg[mg.id]}
                  isDefault={DEFAULT_MATERIALGRUPPEN.includes(mg.name)}
                  onSave={(name, aufschlag) => saveMg(mg.id, name, aufschlag)}
                  onDelete={() => deleteMg(mg.id, mg.name)}
                />
              ))}

              {materialgruppen.length === 0 && (
                <div style={{ color: C.textMid, fontSize: 13, marginBottom: 16 }}>Noch keine Gruppen angelegt.</div>
              )}

              {showNewMg ? (
                <div style={{ background: C.gray1, border: `1px solid ${C.border}`, borderRadius: 6, padding: 14, marginTop: 12 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: 10, marginBottom: 10 }}>
                    <Field label="Gruppenname" value={newMg.name} onChange={v => setNewMg(p => ({ ...p, name: v }))} />
                    <Field label="Aufschlag %" value={String(newMg.aufschlag_prozent)} onChange={v => setNewMg(p => ({ ...p, aufschlag_prozent: parseFloat(v) || 0 }))} type="number" />
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={addMg} style={{ background: C.copper, color: C.black, border: 'none', borderRadius: 5, padding: '8px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'Helvetica Neue,sans-serif' }}>Hinzufügen</button>
                    <button onClick={() => setShowNewMg(false)} style={{ background: C.gray2, border: `1px solid ${C.border}`, color: C.textMid, borderRadius: 5, padding: '8px 14px', fontSize: 13, cursor: 'pointer', fontFamily: 'Helvetica Neue,sans-serif' }}>Abbrechen</button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowNewMg(true)}
                  style={{ marginTop: 8, background: 'none', border: `1px dashed ${C.border}`, color: C.textMid, borderRadius: 5, padding: '9px 16px', fontSize: 13, cursor: 'pointer', width: '100%', fontFamily: 'Helvetica Neue,sans-serif' }}
                >+ Neue Gruppe</button>
              )}
            </div>
          )}

          {/* BEREICH 5 — LIEFERANTEN */}
          {section === 'lieferanten' && (
            <PlanGate minPlan="starter">
              <LieferantenSettings />
            </PlanGate>
          )}

          {/* BEREICH 6 — E-MAIL & VERSAND */}
          {section === 'email' && (
            <EmailSettings />
          )}

          {/* BEREICH — BUCHHALTUNG */}
          {section === 'buchhaltung' && (
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20, color: C.white }}>Buchhaltung</h2>
              <div style={{ display: 'grid', gap: 14 }}>

                <Divider label="Steuerdaten" />

                <Field label="USt-IdNr." value={profil.ust_id ?? ''} onChange={v => setP('ust_id', v)} placeholder="DE123456789" />
                <Field label="Steuernummer" value={profil.steuernummer ?? ''} onChange={v => setP('steuernummer', v)} />

                <Divider label="Bankverbindung" />

                <Field label="IBAN" value={profil.iban ?? ''} onChange={v => setP('iban', v)} placeholder="DE00 0000 0000 0000 0000 00" />
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 10 }}>
                  <Field label="BIC" value={profil.bic ?? ''} onChange={v => setP('bic', v)} />
                  <Field label="Bank" value={profil.bank_name ?? ''} onChange={v => setP('bank_name', v)} />
                </div>

                <Divider label="Angebotsnummern" />

                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={lbl}>Präfix</label>
                    <input
                      style={inp()}
                      value={profil.angebotsnummer_prefix ?? 'AN'}
                      onChange={e => setP('angebotsnummer_prefix', e.target.value)}
                      placeholder="AN"
                      maxLength={6}
                    />
                  </div>
                  <div>
                    <label style={lbl}>Nächste Nummer</label>
                    <input
                      style={inp()}
                      type="number"
                      min={1}
                      value={profil.angebotsnummer_naechste ?? 1}
                      onChange={e => setP('angebotsnummer_naechste', e.target.value)}
                    />
                  </div>
                </div>
                <p style={{ fontSize: 11, color: C.textMid, margin: '4px 0 0' }}>
                  Nächstes Angebot erhält z.B. die Nummer <strong style={{ color: C.white }}>{(profil.angebotsnummer_prefix ?? 'AN')}-{profil.angebotsnummer_naechste ?? 1}</strong>
                </p>

              </div>
              <SaveRow saving={profilSaving} msg={profilMsg} onSave={saveProfil} />
            </div>
          )}

          {/* BEREICH — DOKUMENTE */}
          {section === 'dokumente' && (
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 6, color: C.white }}>Dokumente</h2>
              <p style={{ fontSize: 12, color: C.textMid, marginBottom: 24 }}>
                Diese Texte erscheinen in deinen Angeboten und Rechnungen. Du kannst sie hier zentral festlegen.
              </p>
              <div style={{ display: 'grid', gap: 20 }}>

                <Divider label="Anrede" />
                <div>
                  <label style={lbl}>Anrede-Vorlage</label>
                  <input
                    style={inp()}
                    value={profil.anrede_vorlage ?? ''}
                    onChange={e => setP('anrede_vorlage', e.target.value)}
                    placeholder="Liebe/r {name},"
                  />
                  <p style={{ fontSize: 11, color: C.textMid, margin: '4px 0 0' }}>
                    <code style={{ background: C.gray2, padding: '1px 4px', borderRadius: 3, fontSize: 10 }}>{'{name}'}</code> wird durch den Kundennamen ersetzt.
                  </p>
                </div>

                <Divider label="Anschreiben" />
                <div>
                  <label style={lbl}>Einleitungstext (Anschreiben)</label>
                  <textarea
                    style={{ ...inp(), height: 90, resize: 'vertical' as const }}
                    value={profil.angebot_einleitung ?? ''}
                    onChange={e => setP('angebot_einleitung', e.target.value)}
                    placeholder="vielen Dank für Ihre Anfrage. Wir unterbreiten Ihnen gerne folgendes Angebot:"
                  />
                </div>

                <Divider label="Nachtext" />
                <div>
                  <label style={lbl}>Abschlusstext (nach Positionen)</label>
                  <textarea
                    style={{ ...inp(), height: 80, resize: 'vertical' as const }}
                    value={profil.angebot_abschluss ?? ''}
                    onChange={e => setP('angebot_abschluss', e.target.value)}
                    placeholder="Mit freundlichen Grüßen"
                  />
                </div>

                <Divider label="Zahlungskonditionen" />
                <div>
                  <label style={lbl}>Zahlungskonditionen-Text</label>
                  <textarea
                    style={{ ...inp(), height: 70, resize: 'vertical' as const }}
                    value={profil.zahlungskonditionen_text ?? ''}
                    onChange={e => setP('zahlungskonditionen_text', e.target.value)}
                    placeholder="50% Anzahlung nach Auftragserteilung, 50% nach Abnahme, zahlbar innerhalb von 7 Tagen netto."
                  />
                </div>

                <Divider label="Widerrufsbelehrung" />
                <div>
                  <label style={lbl}>Widerrufsbelehrung-Text</label>
                  <textarea
                    style={{ ...inp(), height: 120, resize: 'vertical' as const, fontSize: 12 }}
                    value={profil.widerrufsbelehrung_text ?? ''}
                    onChange={e => setP('widerrufsbelehrung_text', e.target.value)}
                    placeholder="Sie haben das Recht, binnen 14 Tagen ohne Angabe von Gründen diesen Vertrag zu widerrufen. Um Ihr Widerrufsrecht auszuüben, wenden Sie sich an uns per E-Mail oder Post."
                  />
                  <p style={{ fontSize: 11, color: C.textMid, margin: '4px 0 0' }}>
                    Wird nur eingefügt wenn die Option „Widerrufsbelehrung einfügen" im Angebot aktiviert ist.
                  </p>
                </div>

              </div>
              <SaveRow saving={profilSaving} msg={profilMsg} onSave={saveProfil} />
            </div>
          )}

          {/* BEREICH — AUSWERTUNG */}
          {section === 'auswertung' && <AuswertungSection isMobile={isMobile} />}

          {/* BEREICH 7 — MEIN PLAN */}
          {section === 'plan' && (
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4, color: C.white }}>Mein Plan</h2>
              <p style={{ fontSize: 12, color: C.textMid, marginBottom: 16 }}>Aktuelles Abonnement und Upgrade-Optionen.</p>

              {isInTrial && (
                <div style={{ background: `${C.copper}15`, border: `1px solid ${C.copper}55`, borderRadius: 8, padding: '14px 16px', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 22 }}>🎁</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: C.copper }}>
                      {trialDaysLeft} {trialDaysLeft === 1 ? 'Tag' : 'Tage'} Testversion verbleiben
                    </div>
                    <div style={{ fontSize: 12, color: C.textMid, marginTop: 2 }}>
                      Du hast aktuell Zugriff auf alle Enterprise-Funktionen. Wähle jetzt einen Plan, um nach dem Test weiterzumachen.
                    </div>
                  </div>
                </div>
              )}

              {stripeMsg && (
                <div style={{
                  marginBottom: 20, padding: '12px 16px', borderRadius: 6,
                  background: stripeMsg.type === 'ok' ? 'rgba(90,190,106,.1)' : 'rgba(224,90,90,.1)',
                  border: `1px solid ${stripeMsg.type === 'ok' ? '#5ABE6A' : C.err}`,
                  fontSize: 13, color: stripeMsg.type === 'ok' ? '#5ABE6A' : C.err,
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  {stripeMsg.text}
                  <button onClick={() => setStripeMsg(null)} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: 16, padding: 0, lineHeight: 1 }}>×</button>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: 16, marginBottom: 24 }}>
                {PLANS.map(plan => {
                  const isCurrent = isInTrial ? plan.id === 'enterprise' : plan.id === userPlan
                  const isTrialEnterprise = isInTrial && plan.id === 'enterprise'
                  const isLoading = checkoutLoading === plan.priceId
                  return (
                    <div
                      key={plan.id}
                      style={{
                        background: isCurrent ? C.gray2 : C.gray1,
                        border: `2px solid ${isCurrent ? C.copper : C.border}`,
                        borderRadius: 10, padding: '22px 20px',
                        display: 'flex', flexDirection: 'column', gap: 14,
                        position: 'relative',
                        opacity: isCurrent ? 1 : 0.45,
                      }}
                    >
                      {isCurrent && (
                        <div style={{
                          position: 'absolute', top: -11, left: 20,
                          background: C.copper, color: C.black, fontSize: 9, fontWeight: 800,
                          letterSpacing: 1.5, padding: '3px 10px', borderRadius: 20, whiteSpace: 'nowrap',
                        }}>AKTIV</div>
                      )}
                      {isTrialEnterprise && (
                        <div style={{
                          position: 'absolute', top: 14, right: 14,
                          background: C.copper, color: C.black, fontSize: 10, fontWeight: 800,
                          letterSpacing: 0.5, padding: '4px 10px', borderRadius: 20,
                          whiteSpace: 'nowrap', boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
                        }}>🎁 {trialDaysLeft} Tage</div>
                      )}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 16, fontWeight: 700, color: C.white, marginBottom: 2 }}>{plan.name}</div>
                          <div style={{ fontSize: 26, fontWeight: 800, color: isCurrent ? C.copper : C.white, lineHeight: 1 }}>
                            {plan.price} €<span style={{ fontSize: 13, fontWeight: 400, color: C.textMid }}> / Monat</span>
                          </div>
                          {/* Angebots-Highlight */}
                          <div style={{
                            marginTop: 10,
                            display: 'inline-flex', alignItems: 'baseline', gap: 5,
                            background: plan.id === 'enterprise' ? `${C.copper}22` : plan.id === 'pro' ? `${C.copper}15` : 'transparent',
                            border: plan.id === 'enterprise' || plan.id === 'pro' ? `1px solid ${C.copper}55` : 'none',
                            borderRadius: 6, padding: plan.id === 'enterprise' || plan.id === 'pro' ? '5px 10px' : '0',
                          }}>
                            <span style={{
                              fontSize: plan.id === 'enterprise' ? 22 : plan.id === 'pro' ? 20 : 15,
                              fontWeight: 800,
                              color: plan.id === 'enterprise' || plan.id === 'pro' ? C.copper : C.textMid,
                              lineHeight: 1,
                            }}>
                              {plan.id === 'enterprise' ? '∞' : plan.angebote.split(' ')[0]}
                            </span>
                            <span style={{ fontSize: 11, color: C.textMid }}>
                              {plan.id === 'enterprise' ? 'Angebote – unbegrenzt' : plan.id === 'pro' ? 'Angebote / Monat' : `Angebote / Monat`}
                            </span>
                          </div>
                        </div>
                      </div>
                      <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 7, flex: 1 }}>
                        {plan.features.map(f => (
                          <li key={f} style={{ fontSize: 12, color: C.textMid, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                            <span style={{ color: C.copper, flexShrink: 0, fontWeight: 700 }}>✓</span>{f}
                          </li>
                        ))}
                      </ul>
                      <button
                        onClick={() => selectPlan(plan.priceId, plan.id)}
                        disabled={isCurrent || !!checkoutLoading}
                        style={{
                          background: isCurrent ? 'transparent' : C.copper,
                          color: isCurrent ? '#5ABE6A' : C.black,
                          border: `1px solid ${isCurrent ? '#5ABE6A' : C.copper}`,
                          borderRadius: 6, padding: '10px 0', fontSize: 13, fontWeight: 700,
                          cursor: isCurrent || checkoutLoading ? 'not-allowed' : 'pointer',
                          fontFamily: 'Helvetica Neue, sans-serif', width: '100%',
                          opacity: checkoutLoading && !isLoading ? 0.4 : 1,
                        }}
                      >
                        {isLoading ? '…' : isTrialEnterprise ? 'Testversion aktiv' : isCurrent ? 'Aktueller Plan' : 'Auswählen'}
                      </button>
                    </div>
                  )
                })}
              </div>

              {profil.stripe_customer_id && (
                <button
                  onClick={openPortal}
                  disabled={loadingPortal}
                  style={{
                    background: C.gray2, border: `1px solid ${C.border}`,
                    color: C.white, borderRadius: 6, padding: '9px 16px',
                    fontSize: 13, cursor: loadingPortal ? 'not-allowed' : 'pointer',
                    fontFamily: 'Helvetica Neue, sans-serif', marginBottom: 12,
                  }}
                >{loadingPortal ? '…' : 'Abonnement verwalten'}</button>
              )}

              <p style={{ fontSize: 11, color: C.textMid }}>
                Du hast einen BETA-Gutschein? Klicke auf Auswählen und gib ihn im Checkout ein.
              </p>

              {/* ── Dev-Panel: nur für Owner ── */}
              {userEmail === 'l.m.p.1@gmx.de' && (
                <div style={{ marginTop: 32, borderTop: `1px dashed ${C.border}`, paddingTop: 20 }}>
                  <div style={{ fontSize: 10, letterSpacing: 2, color: '#555', textTransform: 'uppercase', marginBottom: 12 }}>
                    🛠 Entwickler — Plan-Override
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {(['solo', 'starter', 'pro', 'enterprise'] as const).map(p => (
                      <button
                        key={p}
                        onClick={async () => {
                          await fetch('/api/settings/betriebsprofil', {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ plan: p }),
                          })
                          setProfil(prev => ({ ...prev, plan: p }))
                        }}
                        style={{
                          padding: '8px 16px', borderRadius: 6, fontSize: 12, fontWeight: 700,
                          cursor: 'pointer', fontFamily: 'Helvetica Neue, sans-serif',
                          background: profil.plan === p ? C.copper : C.gray2,
                          color: profil.plan === p ? C.black : C.textMid,
                          border: `1px solid ${profil.plan === p ? C.copper : C.border}`,
                        }}
                      >
                        {p.charAt(0).toUpperCase() + p.slice(1)}
                      </button>
                    ))}
                  </div>
                  <div style={{ fontSize: 11, color: '#444', marginTop: 8 }}>
                    Wechselt sofort — kein Stripe, kein Reload nötig.
                  </div>
                </div>
              )}
            </div>
          )}

        </div>
        )}
      </div>

    </div>
  )
}

/* ── Hilfs-Komponenten ─────────────────────────────── */

function Field({ label, value, onChange, type = 'text', placeholder }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string
}) {
  return (
    <div>
      <label style={lbl}>{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={inp()} />
    </div>
  )
}

function Divider({ label }: { label?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '4px 0' }}>
      {label && <span style={{ fontSize: 10, letterSpacing: 2, color: C.textMid, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{label}</span>}
      <div style={{ flex: 1, height: 1, background: C.border }} />
    </div>
  )
}

function SaveRow({ saving, msg, onSave }: { saving: boolean; msg: string; onSave: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 24, paddingTop: 16, borderTop: `1px solid ${C.border}` }}>
      <button
        onClick={onSave}
        disabled={saving}
        style={{
          background: saving ? '#7a5535' : C.copper,
          color: C.black, border: 'none', borderRadius: 6,
          padding: '10px 22px', fontSize: 13, fontWeight: 700,
          cursor: saving ? 'not-allowed' : 'pointer',
          fontFamily: 'Helvetica Neue,sans-serif',
        }}
      >{saving ? 'Wird gespeichert …' : 'Speichern'}</button>
      {msg && <span style={{ fontSize: 12, color: msg.includes('Fehler') ? C.err : C.ok }}>{msg}</span>}
    </div>
  )
}

function MgRow({ mg, msg, isDefault, onSave, onDelete }: {
  mg: Materialgruppe; msg?: string; isDefault: boolean
  onSave: (name: string, aufschlag: number) => void
  onDelete: () => void
}) {
  const [name, setName] = useState(mg.name)
  const [aufschlag, setAufschlag] = useState(mg.aufschlag_prozent)

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '1fr 100px 52px 28px',
      alignItems: 'center', gap: 8, marginBottom: 6,
      padding: '8px 10px', background: C.gray1,
      borderRadius: 4, border: `1px solid ${C.border}`,
    }}>
      <input value={name} onChange={e => setName(e.target.value)} style={inp({ padding: '5px 8px', fontSize: 13 })} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
        <input
          type="number"
          value={aufschlag}
          onChange={e => setAufschlag(parseFloat(e.target.value) || 0)}
          style={{ ...inp({ padding: '5px 7px', fontSize: 13, textAlign: 'right' }), width: '100%' }}
        />
        <span style={{ fontSize: 11, color: C.textMid }}>%</span>
      </div>
      <button
        onClick={() => onSave(name, aufschlag)}
        style={{ background: C.gray2, border: `1px solid ${msg === '✓' ? C.ok : C.border}`, color: msg === '✓' ? C.ok : C.textMid, borderRadius: 4, fontSize: 12, cursor: 'pointer', padding: '5px 0', fontFamily: 'Helvetica Neue,sans-serif' }}
      >{msg ?? 'OK'}</button>
      {!isDefault ? (
        <button onClick={onDelete} style={{ background: 'none', border: 'none', color: C.err, fontSize: 16, cursor: 'pointer', padding: 0, lineHeight: 1 }}>×</button>
      ) : <div />}
    </div>
  )
}

// ── AUSWERTUNG ────────────────────────────────────────────────────────────────

type Zeitraum = 'woche' | 'monat' | 'quartal' | 'jahr' | 'gesamt'

interface AnalyticsStats {
  anzahl: number; volumen: number; durchschnitt: number; max: number
}
interface AnalyticsData {
  gesamt: AnalyticsStats
  woche: AnalyticsStats
  monat: AnalyticsStats
  quartal: AnalyticsStats
  jahr: AnalyticsStats
  monatlich: Record<string, { anzahl: number; volumen: number }>
  nachTyp: Record<string, { anzahl: number; volumen: number }>
  topKunden: { name: string; volumen: number; anzahl: number }[]
  letzte: { id: string; title: string; docTyp: string; netto: number; created_at: string }[]
}

function eur2(n: number) {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)
}

function monatLabel(key: string) {
  const [y, m] = key.split('-')
  return new Date(Number(y), Number(m) - 1).toLocaleDateString('de-DE', { month: 'short', year: '2-digit' })
}

function AuswertungSection({ isMobile = false }: { isMobile?: boolean }) {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [zeitraum, setZeitraum] = useState<Zeitraum>('monat')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/analytics')
      if (res.ok) setData(await res.json())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const zeitraeume: { id: Zeitraum; label: string }[] = [
    { id: 'woche', label: 'Diese Woche' },
    { id: 'monat', label: 'Dieser Monat' },
    { id: 'quartal', label: 'Dieses Quartal' },
    { id: 'jahr', label: 'Dieses Jahr' },
    { id: 'gesamt', label: 'Gesamt' },
  ]

  const stats = data ? data[zeitraum] : null

  const kpiCard = (label: string, value: string, sub?: string) => (
    <div style={{ background: C.gray1, border: `1px solid ${C.border}`, borderRadius: 8, padding: '16px 18px' }}>
      <div style={{ fontSize: 11, color: C.textMid, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: C.white, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: C.textMid, marginTop: 4 }}>{sub}</div>}
    </div>
  )

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: C.textMid, fontSize: 13 }}>
      Lade Auswertung…
    </div>
  )

  if (!data) return (
    <div style={{ color: C.textMid, fontSize: 13 }}>Keine Daten verfügbar.</div>
  )

  return (
    <div>
      <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20, color: C.white }}>Auswertung</h2>

      {/* Zeitraum-Filter */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 24, flexWrap: 'wrap' }}>
        {zeitraeume.map(z => (
          <button key={z.id} onClick={() => setZeitraum(z.id)} style={{
            padding: '7px 14px', borderRadius: 6, border: `1px solid ${zeitraum === z.id ? C.copper : C.border}`,
            background: zeitraum === z.id ? `${C.copper}22` : 'transparent',
            color: zeitraum === z.id ? C.copper : C.textMid,
            fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'Helvetica Neue,sans-serif',
          }}>{z.label}</button>
        ))}
      </div>

      {/* KPI-Karten */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: 10, marginBottom: 28 }}>
        {kpiCard('Angebote', String(stats?.anzahl ?? 0))}
        {kpiCard('Gesamtvolumen', eur2(stats?.volumen ?? 0), 'netto')}
        {kpiCard('Ø Angebotswert', eur2(stats?.durchschnitt ?? 0), 'netto')}
        {kpiCard('Größtes Angebot', eur2(stats?.max ?? 0), 'netto')}
      </div>

      {/* Monatliche Übersicht */}
      <div style={{ background: C.gray1, border: `1px solid ${C.border}`, borderRadius: 8, padding: '18px', marginBottom: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: C.white, marginBottom: 14, letterSpacing: 0.5 }}>MONATLICHER VERLAUF (12 MONATE)</div>
        {(() => {
          const entries = Object.entries(data.monatlich)
          const maxVol = Math.max(...entries.map(([, v]) => v.volumen), 1)
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {entries.map(([key, v]) => (
                <div key={key} style={{ display: 'grid', gridTemplateColumns: isMobile ? '44px 1fr 72px' : '52px 1fr 80px 44px', gap: 8, alignItems: 'center' }}>
                  <div style={{ fontSize: 11, color: C.textMid }}>{monatLabel(key)}</div>
                  <div style={{ height: 6, borderRadius: 3, background: C.gray2, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${(v.volumen / maxVol) * 100}%`, background: C.copper, borderRadius: 3, transition: 'width .3s' }} />
                  </div>
                  <div style={{ fontSize: 11, color: C.white, textAlign: 'right' }}>{eur2(v.volumen)}</div>
                  {!isMobile && <div style={{ fontSize: 11, color: C.textMid, textAlign: 'right' }}>{v.anzahl} Stk.</div>}
                </div>
              ))}
            </div>
          )
        })()}
      </div>

      {/* Nach Dokumenttyp */}
      {Object.keys(data.nachTyp).length > 0 && (
        <div style={{ background: C.gray1, border: `1px solid ${C.border}`, borderRadius: 8, padding: '18px', marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.white, marginBottom: 14, letterSpacing: 0.5 }}>NACH DOKUMENTTYP</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {Object.entries(data.nachTyp).map(([typ, v]) => (
              <div key={typ} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: typ === 'Angebot' ? C.copper : typ === 'Auftragsbestätigung' ? '#5ABE6A' : C.textMid }} />
                  <span style={{ fontSize: 13, color: C.white }}>{typ}</span>
                </div>
                <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: C.textMid }}>{v.anzahl} Stk.</span>
                  <span style={{ fontSize: 12, color: C.white, minWidth: 80, textAlign: 'right' }}>{eur2(v.volumen)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top-Kunden */}
      {data.topKunden.length > 0 && (
        <div style={{ background: C.gray1, border: `1px solid ${C.border}`, borderRadius: 8, padding: '18px', marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.white, marginBottom: 14, letterSpacing: 0.5 }}>TOP-KUNDEN (VOLUMEN)</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {data.topKunden.map((k, i) => (
              <div key={k.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 11, color: C.textMid, width: 16 }}>#{i + 1}</span>
                  <span style={{ fontSize: 13, color: C.white }}>{k.name}</span>
                </div>
                <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: C.textMid }}>{k.anzahl} Stk.</span>
                  <span style={{ fontSize: 12, color: C.copper, minWidth: 80, textAlign: 'right', fontWeight: 700 }}>{eur2(k.volumen)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Letzte Angebote */}
      {data.letzte.length > 0 && (
        <div style={{ background: C.gray1, border: `1px solid ${C.border}`, borderRadius: 8, padding: '18px' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.white, marginBottom: 14, letterSpacing: 0.5 }}>LETZTE 10 ANGEBOTE</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {data.letzte.map(p => (
              <div key={p.id} style={{ display: 'grid', gridTemplateColumns: '1fr 100px 90px', gap: 8, alignItems: 'center', padding: '6px 0', borderBottom: `1px solid ${C.border}` }}>
                <div>
                  <div style={{ fontSize: 12, color: C.white }}>{p.title}</div>
                  <div style={{ fontSize: 10, color: C.textMid }}>{new Date(p.created_at).toLocaleDateString('de-DE')}</div>
                </div>
                <div style={{ fontSize: 11, color: C.textMid, textAlign: 'center' }}>{p.docTyp}</div>
                <div style={{ fontSize: 12, color: C.white, textAlign: 'right', fontWeight: 600 }}>{eur2(p.netto)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {data.gesamt.anzahl === 0 && (
        <div style={{ textAlign: 'center', color: C.textMid, fontSize: 13, padding: '40px 0' }}>
          Noch keine gespeicherten Angebote vorhanden.
        </div>
      )}
    </div>
  )
}
