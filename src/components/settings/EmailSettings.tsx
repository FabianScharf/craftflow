'use client'
import { useState, useEffect } from 'react'
import { usePlan } from '@/hooks/usePlan'

const C = {
  black: '#0D0D0D', dark: '#141414', gray1: '#1A1A1A', gray2: '#222222',
  border: '#2E2E2E', copper: '#C8885A', white: '#F5F2EE',
  textMid: '#8A8A8A', ok: '#5ABE6A', err: '#E05A5A',
}

const inp = (extra?: React.CSSProperties): React.CSSProperties => ({
  width: '100%', boxSizing: 'border-box', padding: '9px 11px',
  background: C.gray2, border: `1px solid ${C.border}`, borderRadius: 4,
  fontSize: 13, color: C.white, fontFamily: 'Helvetica Neue,sans-serif', outline: 'none',
  ...extra,
})

const lbl: React.CSSProperties = {
  fontSize: 10, letterSpacing: 2, textTransform: 'uppercase',
  color: C.textMid, marginBottom: 4, display: 'block',
}

type EmailConfig = {
  reply_to_email: string
  smtp_from_name: string
  smtp_host: string
  smtp_port: number
  smtp_user: string
  smtp_from_email: string
  email_signatur: string
  smtp_verified: boolean
  smtp_last_test_at: string | null
}

const defaultConfig = (): EmailConfig => ({
  reply_to_email: '', smtp_from_name: '',
  smtp_host: '', smtp_port: 587, smtp_user: '',
  smtp_from_email: '', email_signatur: '',
  smtp_verified: false, smtp_last_test_at: null,
})

export function EmailSettings() {
  const { plan, loading: planLoading } = usePlan()
  const [cfg, setCfg] = useState<EmailConfig>(defaultConfig())
  const [smtpPassword, setSmtpPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')
  const [testing, setTesting] = useState(false)
  const [testMsg, setTestMsg] = useState('')

  useEffect(() => { loadConfig() }, [])

  async function loadConfig() {
    const res = await fetch('/api/settings/email-config').catch(() => null)
    const d = await res?.json().catch(() => null)
    if (d?.config) setCfg({ ...defaultConfig(), ...d.config })
  }

  function setC<K extends keyof EmailConfig>(key: K, val: EmailConfig[K]) {
    setCfg(p => ({ ...p, [key]: val }))
  }

  async function save() {
    setSaving(true)
    setSaveMsg('')
    const body: Record<string, unknown> = { ...cfg }
    if (smtpPassword) body.smtp_password_encrypted = smtpPassword
    const res = await fetch('/api/settings/email-config', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    setSaving(false)
    setSaveMsg(res.ok ? 'Gespeichert.' : 'Fehler beim Speichern.')
    if (res.ok) setSmtpPassword('')
    setTimeout(() => setSaveMsg(''), 3000)
  }

  async function testSmtp() {
    setTesting(true)
    setTestMsg('')
    const res = await fetch('/api/settings/email-test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        host: cfg.smtp_host, port: cfg.smtp_port,
        user: cfg.smtp_user, password: smtpPassword || undefined,
        fromEmail: cfg.smtp_from_email, fromName: cfg.smtp_from_name,
      }),
    })
    const d = await res.json()
    setTesting(false)
    setTestMsg(d.success ? '✓ Verbindung erfolgreich — Test-E-Mail versendet.' : `Fehler: ${d.error ?? 'Unbekannter Fehler'}`)
    if (d.success) setCfg(p => ({ ...p, smtp_verified: true, smtp_last_test_at: new Date().toISOString() }))
  }

  const isStarter = plan !== 'solo'
  const isPro = plan === 'pro' || plan === 'enterprise'

  const bannerText = {
    solo: 'E-Mail-Versand ist ab dem Starter-Plan verfügbar.',
    starter: 'E-Mails werden über anfragen@craftflow.de versendet. Antworten landen in deiner Inbox (Reply-To).',
    pro: 'E-Mails werden über dein eigenes Postfach versendet (SMTP).',
    enterprise: 'E-Mails werden über dein eigenes Postfach versendet (SMTP).',
  }[plan]

  if (planLoading) return null

  return (
    <div style={{ fontFamily: 'Helvetica Neue,sans-serif' }}>
      <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4, color: C.white }}>E-Mail & Versand</h2>
      <p style={{ fontSize: 12, color: C.textMid, marginBottom: 20 }}>Absendereinstellungen und Signatur für deine Angebote.</p>

      {/* Info-Banner */}
      <div style={{
        background: plan === 'solo' ? C.gray1 : `${C.copper}10`,
        border: `1px solid ${plan === 'solo' ? C.border : `${C.copper}50`}`,
        borderRadius: 6, padding: '10px 14px',
        fontSize: 12, color: plan === 'solo' ? C.textMid : C.copper,
        marginBottom: 24, lineHeight: 1.6,
      }}>
        {bannerText}
      </div>

      {/* Starter-Bereich */}
      <div style={{ opacity: isStarter ? 1 : 0.4, pointerEvents: isStarter ? 'auto' : 'none' }}>
        <div style={{ display: 'grid', gap: 14, marginBottom: 24 }}>
          <div>
            <label style={lbl}>Absendername</label>
            <input value={cfg.smtp_from_name} onChange={e => setC('smtp_from_name', e.target.value)} style={inp()} placeholder="FS Crafted" />
          </div>
          <div>
            <label style={lbl}>Reply-To E-Mail</label>
            <input type="email" value={cfg.reply_to_email} onChange={e => setC('reply_to_email', e.target.value)} style={inp()} placeholder="anfrage@fscrafted.de" />
            <div style={{ fontSize: 11, color: C.textMid, marginTop: 5 }}>
              Antworten der Kunden landen in diesem Postfach.
            </div>
          </div>
          {!isPro && isStarter && (
            <div style={{ fontSize: 12, color: C.textMid, background: C.gray1, border: `1px solid ${C.border}`, borderRadius: 4, padding: '8px 12px' }}>
              Absenderadresse: <strong style={{ color: C.white }}>anfragen@craftflow.de</strong>
            </div>
          )}
        </div>

        {/* Pro-SMTP */}
        {isPro ? (
          <div style={{ display: 'grid', gap: 14, marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '4px 0' }}>
              <div style={{ height: 1, flex: 1, background: C.border }} />
              <span style={{ fontSize: 10, letterSpacing: 2, color: C.textMid, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>SMTP-Konfiguration</span>
              <div style={{ height: 1, flex: 1, background: C.border }} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px', gap: 10 }}>
              <div>
                <label style={lbl}>SMTP-Host</label>
                <input value={cfg.smtp_host} onChange={e => setC('smtp_host', e.target.value)} style={inp()} placeholder="smtp.gmail.com" />
              </div>
              <div>
                <label style={lbl}>Port</label>
                <input type="number" value={cfg.smtp_port} onChange={e => setC('smtp_port', parseInt(e.target.value) || 587)} style={inp()} />
              </div>
            </div>

            <div>
              <label style={lbl}>SMTP-Benutzer</label>
              <input value={cfg.smtp_user} onChange={e => setC('smtp_user', e.target.value)} style={inp()} placeholder="deine@email.de" />
            </div>

            <div>
              <label style={lbl}>App-Passwort</label>
              <input type="password" value={smtpPassword} onChange={e => setSmtpPassword(e.target.value)} style={inp()} placeholder="Neues Passwort (leer = unverändert)" />
            </div>

            <div>
              <label style={lbl}>Absender-E-Mail</label>
              <input type="email" value={cfg.smtp_from_email} onChange={e => setC('smtp_from_email', e.target.value)} style={inp()} />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <button
                onClick={testSmtp}
                disabled={testing || !cfg.smtp_host || !cfg.smtp_user}
                style={{
                  background: C.gray2, border: `1px solid ${C.border}`, color: C.white,
                  borderRadius: 6, padding: '8px 16px', fontSize: 12,
                  cursor: testing || !cfg.smtp_host ? 'not-allowed' : 'pointer',
                  fontFamily: 'Helvetica Neue,sans-serif',
                }}
              >{testing ? 'Teste …' : 'Verbindung testen'}</button>
              {cfg.smtp_verified && cfg.smtp_last_test_at && (
                <span style={{ fontSize: 11, color: C.ok }}>
                  ✓ {new Date(cfg.smtp_last_test_at).toLocaleString('de-DE')}
                </span>
              )}
            </div>
            {testMsg && (
              <div style={{ fontSize: 12, color: testMsg.startsWith('✓') ? C.ok : C.err }}>
                {testMsg}
              </div>
            )}
          </div>
        ) : (
          <div style={{ border: `1px dashed ${C.border}`, borderRadius: 6, padding: '16px 20px', marginBottom: 24, textAlign: 'center' }}>
            <div style={{ fontSize: 12, color: C.textMid }}>
              SMTP-Konfiguration ist ab dem <strong style={{ color: C.copper }}>Pro-Plan</strong> verfügbar.
            </div>
          </div>
        )}

        {/* Signatur */}
        <div style={{ marginBottom: 8 }}>
          <label style={lbl}>E-Mail-Signatur</label>
          <textarea
            value={cfg.email_signatur}
            onChange={e => setC('email_signatur', e.target.value)}
            rows={4}
            placeholder="Mit freundlichen Grüßen&#10;Fabian Scharf — FS Crafted"
            style={{ ...inp(), resize: 'vertical', lineHeight: 1.6 }}
          />
          <div style={{ fontSize: 11, color: C.textMid, marginTop: 5 }}>Wird automatisch unter jede E-Mail gesetzt.</div>
        </div>
      </div>

      {/* Speichern */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 24, paddingTop: 16, borderTop: `1px solid ${C.border}` }}>
        <button
          onClick={save}
          disabled={saving || !isStarter}
          style={{
            background: saving || !isStarter ? '#7a5535' : C.copper,
            color: C.black, border: 'none', borderRadius: 6,
            padding: '10px 22px', fontSize: 13, fontWeight: 700,
            cursor: saving || !isStarter ? 'not-allowed' : 'pointer',
            fontFamily: 'Helvetica Neue,sans-serif',
          }}
        >{saving ? 'Wird gespeichert …' : 'Speichern'}</button>
        {saveMsg && <span style={{ fontSize: 12, color: saveMsg.includes('Fehler') ? C.err : C.ok }}>{saveMsg}</span>}
      </div>
    </div>
  )
}
