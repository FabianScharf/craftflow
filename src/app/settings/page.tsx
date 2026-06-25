'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'

const C = {
  black: '#0D0D0D', dark: '#141414', copper: '#C8885A',
  white: '#F5F2EE', gray: '#8A8A8A', border: '#2E2E2E',
  gray1: '#1E1E1E', gray2: '#2A2A2A', ok: '#5ABE6A', err: '#E05A5A',
}

const inputStyle = {
  width: '100%', background: C.gray2, border: `1px solid ${C.border}`,
  borderRadius: 6, padding: '10px 12px', color: C.white, fontSize: 13,
  fontFamily: 'Helvetica Neue,sans-serif', outline: 'none', boxSizing: 'border-box' as const,
}

const labelStyle = { color: C.gray, fontSize: 10, fontWeight: 600 as const, letterSpacing: 1, textTransform: 'uppercase' as const, display: 'block', marginBottom: 5 }

type Betriebsprofil = {
  firma_name: string; firma_zusatz: string; strasse: string; plz: string; ort: string
  telefon: string; email: string; website: string; ust_id: string; steuernummer: string
  farbe_akzent: string; angebotsnummer_prefix: string; angebotsnummer_naechste: number
  angebot_gueltig_tage: number; zahlungsziel_tage: number; mwst_satz: number
}

type Kostenstelle = { id: string; code: string; bezeichnung: string; stundensatz: number; gruppe: string | null }

const GRUPPEN_ORDER = ['Planung', 'Maschinenraum', 'Bankraum', 'Montage']

const defaultProfil: Betriebsprofil = {
  firma_name: '', firma_zusatz: '', strasse: '', plz: '', ort: '',
  telefon: '', email: '', website: '', ust_id: '', steuernummer: '',
  farbe_akzent: '#C8885A', angebotsnummer_prefix: 'AN', angebotsnummer_naechste: 1,
  angebot_gueltig_tage: 30, zahlungsziel_tage: 14, mwst_satz: 19,
}

export default function SettingsPage() {
  const [profil, setProfil]           = useState<Betriebsprofil>(defaultProfil)
  const [kostenstellen, setKostenstellen] = useState<Kostenstelle[]>([])
  const [loading, setLoading]         = useState(true)
  const [saving, setSaving]           = useState(false)
  const [saveStatus, setSaveStatus]   = useState<'idle' | 'ok' | 'err'>('idle')
  const [ksStatus, setKsStatus]       = useState<Record<string, 'saving' | 'ok'>>({})
  const [userEmail, setUserEmail]     = useState('')

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data } = await supabase.auth.getUser()
      setUserEmail(data.user?.email ?? '')

      const [pRes, kRes] = await Promise.all([
        fetch('/api/settings/betriebsprofil').then(r => r.json()),
        fetch('/api/settings/kostenstellen').then(r => r.json()),
      ])
      if (pRes.profil) setProfil(p => ({ ...p, ...pRes.profil }))
      if (kRes.kostenstellen) setKostenstellen(kRes.kostenstellen)
      setLoading(false)
    }
    load().catch(() => setLoading(false))
  }, [])

  async function saveProfil() {
    setSaving(true)
    setSaveStatus('idle')
    const res = await fetch('/api/settings/betriebsprofil', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...profil, onboarding_abgeschlossen: true }),
    })
    setSaveStatus(res.ok ? 'ok' : 'err')
    setSaving(false)
    if (res.ok) setTimeout(() => setSaveStatus('idle'), 3000)
  }

  async function saveKostenstelle(ks: Kostenstelle) {
    setKsStatus(prev => ({ ...prev, [ks.id]: 'saving' }))
    await fetch('/api/settings/kostenstellen', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: ks.id, stundensatz: ks.stundensatz }),
    })
    setKsStatus(prev => ({ ...prev, [ks.id]: 'ok' }))
    setTimeout(() => setKsStatus(prev => { const n = { ...prev }; delete n[ks.id]; return n }), 2000)
  }

  function updKs(id: string, val: number) {
    setKostenstellen(prev => prev.map(k => k.id === id ? { ...k, stundensatz: val } : k))
  }

  const gruppen = GRUPPEN_ORDER.map(g => ({
    name: g,
    items: kostenstellen.filter(k => k.gruppe === g),
  })).filter(g => g.items.length > 0)
  const ungrouped = kostenstellen.filter(k => !k.gruppe || !GRUPPEN_ORDER.includes(k.gruppe))

  if (loading) {
    return (
      <div style={{ background: C.black, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Helvetica Neue,sans-serif' }}>
        <div style={{ color: C.gray, fontSize: 13 }}>Lädt…</div>
      </div>
    )
  }

  return (
    <div style={{ background: C.black, minHeight: '100vh', fontFamily: 'Helvetica Neue,sans-serif', color: C.white }}>

      {/* Header */}
      <div style={{ background: C.dark, borderBottom: `2px solid ${C.copper}`, padding: '13px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <a href="/" style={{ color: C.copper, fontSize: 20, textDecoration: 'none', fontWeight: 400 }}>←</a>
          <div>
            <div style={{ color: C.copper, fontSize: 14, fontWeight: 800, letterSpacing: 2 }}>CRAFTFLOW</div>
            <div style={{ color: C.gray, fontSize: 9, letterSpacing: 2 }}>EINSTELLUNGEN</div>
          </div>
        </div>
        <div style={{ color: C.gray, fontSize: 11 }}>{userEmail}</div>
      </div>

      <div style={{ maxWidth: 640, margin: '0 auto', padding: '24px 16px 60px' }}>

        {/* ── BETRIEBSPROFIL ── */}
        <section style={{ marginBottom: 36 }}>
          <div style={{ color: C.copper, fontSize: 10, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 16, fontWeight: 700 }}>Betriebsprofil</div>

          <div style={{ background: C.dark, border: `1px solid ${C.border}`, borderRadius: 10, padding: '20px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={labelStyle}>Firmenname *</label>
                <input style={inputStyle} value={profil.firma_name} onChange={e => setProfil(p => ({ ...p, firma_name: e.target.value }))} placeholder="z.B. Tischler Mustermann" />
              </div>
              <div>
                <label style={labelStyle}>Zusatz</label>
                <input style={inputStyle} value={profil.firma_zusatz} onChange={e => setProfil(p => ({ ...p, firma_zusatz: e.target.value }))} placeholder="z.B. GmbH" />
              </div>
            </div>

            <div>
              <label style={labelStyle}>Straße & Hausnummer</label>
              <input style={inputStyle} value={profil.strasse} onChange={e => setProfil(p => ({ ...p, strasse: e.target.value }))} placeholder="z.B. Musterstraße 12" />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', gap: 12 }}>
              <div>
                <label style={labelStyle}>PLZ</label>
                <input style={inputStyle} value={profil.plz} onChange={e => setProfil(p => ({ ...p, plz: e.target.value }))} placeholder="63517" />
              </div>
              <div>
                <label style={labelStyle}>Ort</label>
                <input style={inputStyle} value={profil.ort} onChange={e => setProfil(p => ({ ...p, ort: e.target.value }))} placeholder="z.B. Rodenbach" />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={labelStyle}>E-Mail</label>
                <input style={inputStyle} type="email" value={profil.email} onChange={e => setProfil(p => ({ ...p, email: e.target.value }))} placeholder="anfrage@firma.de" />
              </div>
              <div>
                <label style={labelStyle}>Telefon</label>
                <input style={inputStyle} value={profil.telefon} onChange={e => setProfil(p => ({ ...p, telefon: e.target.value }))} placeholder="+49 6185 ..." />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={labelStyle}>USt-IdNr.</label>
                <input style={inputStyle} value={profil.ust_id} onChange={e => setProfil(p => ({ ...p, ust_id: e.target.value }))} placeholder="DE123456789" />
              </div>
              <div>
                <label style={labelStyle}>Steuernummer</label>
                <input style={inputStyle} value={profil.steuernummer} onChange={e => setProfil(p => ({ ...p, steuernummer: e.target.value }))} placeholder="04 815 12345" />
              </div>
            </div>

            <div style={{ height: 1, background: C.border }} />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <div>
                <label style={labelStyle}>Angebots-Prefix</label>
                <input style={inputStyle} value={profil.angebotsnummer_prefix} onChange={e => setProfil(p => ({ ...p, angebotsnummer_prefix: e.target.value }))} placeholder="AN" />
              </div>
              <div>
                <label style={labelStyle}>Nächste Nr.</label>
                <input style={inputStyle} type="number" value={profil.angebotsnummer_naechste} onChange={e => setProfil(p => ({ ...p, angebotsnummer_naechste: parseInt(e.target.value) || 1 }))} />
              </div>
              <div>
                <label style={labelStyle}>Gültig (Tage)</label>
                <input style={inputStyle} type="number" value={profil.angebot_gueltig_tage} onChange={e => setProfil(p => ({ ...p, angebot_gueltig_tage: parseInt(e.target.value) || 30 }))} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={labelStyle}>Zahlungsziel (Tage)</label>
                <input style={inputStyle} type="number" value={profil.zahlungsziel_tage} onChange={e => setProfil(p => ({ ...p, zahlungsziel_tage: parseInt(e.target.value) || 14 }))} />
              </div>
              <div>
                <label style={labelStyle}>MwSt. (%)</label>
                <input style={inputStyle} type="number" value={profil.mwst_satz} onChange={e => setProfil(p => ({ ...p, mwst_satz: parseFloat(e.target.value) || 19 }))} />
              </div>
            </div>

            <div>
              <label style={labelStyle}>Akzentfarbe (CI)</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <input type="color" value={profil.farbe_akzent} onChange={e => setProfil(p => ({ ...p, farbe_akzent: e.target.value }))}
                  style={{ width: 44, height: 44, border: `1px solid ${C.border}`, borderRadius: 6, background: 'none', cursor: 'pointer', padding: 2 }} />
                <input style={{ ...inputStyle, flex: 1 }} value={profil.farbe_akzent} onChange={e => setProfil(p => ({ ...p, farbe_akzent: e.target.value }))} placeholder="#C8885A" />
              </div>
            </div>

            {saveStatus === 'err' && (
              <div style={{ color: C.err, fontSize: 12, background: 'rgba(224,90,90,0.08)', border: `1px solid rgba(224,90,90,0.2)`, borderRadius: 6, padding: '8px 12px' }}>
                Fehler beim Speichern. Bitte erneut versuchen.
              </div>
            )}

            <button
              onClick={saveProfil}
              disabled={saving}
              style={{ background: saveStatus === 'ok' ? '#1a3a1a' : saving ? '#7a5535' : C.copper, color: saveStatus === 'ok' ? '#90EE90' : C.black, border: saveStatus === 'ok' ? '1px solid #3a6a3a' : 'none', borderRadius: 8, padding: '13px', fontSize: 14, fontWeight: 800, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'Helvetica Neue,sans-serif', letterSpacing: 0.3 }}
            >
              {saving ? 'Wird gespeichert …' : saveStatus === 'ok' ? '✓ Gespeichert' : 'Betriebsprofil speichern'}
            </button>
          </div>
        </section>

        {/* ── KOSTENSTELLEN ── */}
        <section style={{ marginBottom: 36 }}>
          <div style={{ color: C.copper, fontSize: 10, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 4, fontWeight: 700 }}>Stundensätze</div>
          <div style={{ color: C.gray, fontSize: 12, marginBottom: 16, lineHeight: 1.55 }}>
            Diese Stundensätze werden bei jeder KI-Kalkulation verwendet. Ändere einzelne Werte und speichere direkt.
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {gruppen.map(g => (
              <div key={g.name} style={{ background: C.dark, border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden' }}>
                <div style={{ background: C.gray1, padding: '8px 14px', color: C.copper, fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase' }}>
                  {g.name}
                </div>
                {g.items.map((ks, i) => (
                  <div key={ks.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderTop: i > 0 ? `1px solid ${C.border}` : undefined }}>
                    <div style={{ flex: 1, fontSize: 13, color: C.white }}>{ks.bezeichnung}</div>
                    <div style={{ color: C.gray, fontSize: 10, minWidth: 60 }}>{ks.code}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <input
                        type="number"
                        value={ks.stundensatz}
                        onChange={e => updKs(ks.id, parseFloat(e.target.value) || 0)}
                        style={{ width: 70, padding: '6px 8px', background: C.gray2, border: `1px solid ${C.border}`, borderRadius: 5, color: C.white, fontSize: 13, fontFamily: 'Helvetica Neue,sans-serif', outline: 'none', textAlign: 'right' as const }}
                      />
                      <span style={{ color: C.gray, fontSize: 12 }}>€/h</span>
                      <button
                        onClick={() => saveKostenstelle(ks)}
                        disabled={ksStatus[ks.id] === 'saving'}
                        style={{ background: ksStatus[ks.id] === 'ok' ? '#1a3a1a' : 'transparent', color: ksStatus[ks.id] === 'ok' ? '#90EE90' : C.copper, border: `1px solid ${ksStatus[ks.id] === 'ok' ? '#3a6a3a' : C.copper}`, borderRadius: 5, padding: '6px 10px', cursor: 'pointer', fontSize: 11, fontFamily: 'Helvetica Neue,sans-serif', fontWeight: 600, minWidth: 40 }}
                      >
                        {ksStatus[ks.id] === 'saving' ? '…' : ksStatus[ks.id] === 'ok' ? '✓' : 'OK'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ))}

            {ungrouped.length > 0 && (
              <div style={{ background: C.dark, border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden' }}>
                <div style={{ background: C.gray1, padding: '8px 14px', color: C.gray, fontSize: 10, fontWeight: 700, letterSpacing: 2 }}>SONSTIGE</div>
                {ungrouped.map((ks, i) => (
                  <div key={ks.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderTop: i > 0 ? `1px solid ${C.border}` : undefined }}>
                    <div style={{ flex: 1, fontSize: 13, color: C.white }}>{ks.bezeichnung}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <input type="number" value={ks.stundensatz} onChange={e => updKs(ks.id, parseFloat(e.target.value) || 0)}
                        style={{ width: 70, padding: '6px 8px', background: C.gray2, border: `1px solid ${C.border}`, borderRadius: 5, color: C.white, fontSize: 13, fontFamily: 'Helvetica Neue,sans-serif', outline: 'none', textAlign: 'right' as const }} />
                      <span style={{ color: C.gray, fontSize: 12 }}>€/h</span>
                      <button onClick={() => saveKostenstelle(ks)} style={{ background: 'transparent', color: C.copper, border: `1px solid ${C.copper}`, borderRadius: 5, padding: '6px 10px', cursor: 'pointer', fontSize: 11, fontFamily: 'Helvetica Neue,sans-serif', fontWeight: 600 }}>OK</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {kostenstellen.length === 0 && (
              <div style={{ color: C.gray, fontSize: 13, fontStyle: 'italic', padding: '12px 0' }}>
                Keine Kostenstellen gefunden. Melde dich ab und wieder an, um sie zu initialisieren.
              </div>
            )}
          </div>
        </section>

        {/* ── KONTO ── */}
        <section>
          <div style={{ color: C.copper, fontSize: 10, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 16, fontWeight: 700 }}>Konto</div>
          <div style={{ background: C.dark, border: `1px solid ${C.border}`, borderRadius: 10, padding: '16px 18px' }}>
            <div style={{ color: C.gray, fontSize: 12, marginBottom: 4 }}>Eingeloggt als</div>
            <div style={{ color: C.white, fontSize: 14, fontWeight: 600, marginBottom: 16 }}>{userEmail}</div>
            <button
              onClick={async () => { const s = createClient(); await s.auth.signOut(); window.location.href = '/login' }}
              style={{ background: 'transparent', color: C.err, border: `1px solid ${C.err}`, borderRadius: 6, padding: '10px 18px', cursor: 'pointer', fontSize: 13, fontFamily: 'Helvetica Neue,sans-serif', fontWeight: 600 }}
            >
              Abmelden
            </button>
          </div>
        </section>

      </div>
    </div>
  )
}
