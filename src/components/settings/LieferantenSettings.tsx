'use client'
import { useState, useEffect, useRef } from 'react'

const C = {
  black: '#0D0D0D', dark: '#141414', gray1: '#1A1A1A', gray2: '#222222',
  border: '#2E2E2E', copper: '#C8885A', white: '#F5F2EE',
  textMid: '#8A8A8A', ok: '#5ABE6A', err: '#E05A5A',
}

const inp = (extra?: React.CSSProperties): React.CSSProperties => ({
  width: '100%', boxSizing: 'border-box', padding: '8px 10px',
  background: C.gray2, border: `1px solid ${C.border}`, borderRadius: 4,
  fontSize: 13, color: C.white, fontFamily: 'Helvetica Neue,sans-serif', outline: 'none',
  ...extra,
})

const lbl: React.CSSProperties = {
  fontSize: 10, letterSpacing: 2, textTransform: 'uppercase',
  color: C.textMid, marginBottom: 4, display: 'block',
}

const KATEGORIEN_FALLBACK = [
  'Massivholz', 'Spanplatte / MDF', 'Beschläge',
  'Furnier / HPL', 'Oberfläche / Lack', 'Sonstiges',
]

type Supplier = {
  id: string
  company_name: string
  ansprechpartner: string | null
  general_email: string | null
  phone: string | null
  website: string | null
  lieferant_nr: string | null
  kategorien: string[] | null
  notes: string | null
  aktiv: boolean
  street: string | null
  zip: string | null
  city: string | null
}

const emptyForm = () => ({
  company_name: '',
  ansprechpartner: null as string | null,
  general_email: null as string | null,
  phone: null as string | null,
  website: null as string | null,
  lieferant_nr: null as string | null,
  kategorien: [] as string[],
  notes: null as string | null,
  aktiv: true,
  street: null as string | null,
  zip: null as string | null,
  city: null as string | null,
})

function parseCsvRow(row: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < row.length; i++) {
    const ch = row[i]
    if (ch === '"') { inQuotes = !inQuotes }
    else if (ch === ',' && !inQuotes) { result.push(current.trim()); current = '' }
    else { current += ch }
  }
  result.push(current.trim())
  return result
}

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim())
  if (lines.length < 2) return []
  const headers = parseCsvRow(lines[0]).map(h => h.replace(/^"|"$/g, '').toLowerCase().trim())
  return lines.slice(1).map(line => {
    const vals = parseCsvRow(line).map(v => v.replace(/^"|"$/g, ''))
    const row: Record<string, string> = {}
    headers.forEach((h, i) => { row[h] = vals[i] ?? '' })
    return row
  })
}

export function LieferantenSettings() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [kategorienOptions, setKategorienOptions] = useState<string[]>(KATEGORIEN_FALLBACK)

  const [panelOpen, setPanelOpen] = useState(false)
  const [editing, setEditing] = useState<Supplier | null>(null)
  const [form, setForm] = useState(emptyForm())
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')

  const [csvOpen, setCsvOpen] = useState(false)
  const [csvPreview, setCsvPreview] = useState<Record<string, string>[]>([])
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [csvImporting, setCsvImporting] = useState(false)
  const [csvMsg, setCsvMsg] = useState('')
  const csvRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    loadSuppliers()
    fetch('/api/settings/materialgruppen')
      .then(r => r.json())
      .then(d => {
        const names = (d?.materialgruppen ?? []).map((g: { name: string }) => g.name).filter(Boolean)
        if (names.length) setKategorienOptions(names)
      })
      .catch(() => {})
  }, [])

  async function loadSuppliers() {
    setLoading(true)
    const res = await fetch('/api/settings/suppliers').catch(() => null)
    const d = await res?.json().catch(() => null)
    setSuppliers(d?.suppliers ?? [])
    setLoading(false)
  }

  function openNew() {
    setEditing(null)
    setForm(emptyForm())
    setSaveMsg('')
    setPanelOpen(true)
  }

  function openEdit(s: Supplier) {
    setEditing(s)
    setForm({
      company_name: s.company_name,
      ansprechpartner: s.ansprechpartner,
      general_email: s.general_email,
      phone: s.phone,
      website: s.website,
      lieferant_nr: s.lieferant_nr,
      kategorien: s.kategorien ?? [],
      notes: s.notes,
      aktiv: s.aktiv,
      street: s.street,
      zip: s.zip,
      city: s.city,
    })
    setSaveMsg('')
    setPanelOpen(true)
  }

  function setF<K extends keyof ReturnType<typeof emptyForm>>(key: K, val: ReturnType<typeof emptyForm>[K]) {
    setForm(p => ({ ...p, [key]: val }))
  }

  function toggleKat(kat: string) {
    const current = form.kategorien ?? []
    setF('kategorien', current.includes(kat) ? current.filter(k => k !== kat) : [...current, kat])
  }

  async function save() {
    if (!form.company_name.trim()) { setSaveMsg('Firmenname ist Pflicht.'); return }
    setSaving(true)
    setSaveMsg('')
    const method = editing ? 'PUT' : 'POST'
    const body = editing ? { ...form, id: editing.id } : form
    const res = await fetch('/api/settings/suppliers', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const d = await res.json()
    setSaving(false)
    if (d.supplier) {
      if (editing) {
        setSuppliers(prev => prev.map(s => s.id === editing.id ? d.supplier : s))
      } else {
        setSuppliers(prev => [d.supplier, ...prev])
      }
      setPanelOpen(false)
    } else {
      setSaveMsg(d.error ?? 'Fehler beim Speichern.')
    }
  }

  async function deleteSupplier(id: string) {
    if (!confirm('Lieferant wirklich löschen?')) return
    await fetch('/api/settings/suppliers', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    setSuppliers(prev => prev.filter(s => s.id !== id))
    if (editing?.id === id) setPanelOpen(false)
  }

  function handleCsvFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setCsvFile(file)
    const reader = new FileReader()
    reader.onload = ev => {
      const text = ev.target?.result as string
      setCsvPreview(parseCsv(text).slice(0, 5))
      setCsvMsg('')
    }
    reader.readAsText(file, 'UTF-8')
    e.target.value = ''
  }

  async function importCsv() {
    if (!csvFile) { setCsvMsg('Bitte zuerst eine Datei auswählen.'); return }
    const text = await csvFile.text()
    const rows = parseCsv(text)
    if (rows.length === 0) { setCsvMsg('Keine gültigen Zeilen gefunden.'); return }

    setCsvImporting(true)
    setCsvMsg('')
    const mapped = rows
      .map(row => ({
        company_name: row['firma'] || row['company_name'] || row['firmaname'] || '',
        ansprechpartner: row['ansprechpartner'] || null,
        general_email: row['email'] || null,
        phone: row['telefon'] || row['phone'] || null,
        website: row['website'] || null,
        kategorien: row['kategorien'] ? row['kategorien'].split(';').map(k => k.trim()).filter(Boolean) : [],
        notes: row['notizen'] || row['notes'] || null,
        aktiv: true,
      }))
      .filter(r => r.company_name)

    const res = await fetch('/api/settings/suppliers/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ suppliers: mapped }),
    })
    const d = await res.json()
    setCsvImporting(false)
    if (d.ok) {
      setCsvMsg(`${d.count ?? mapped.length} Lieferanten importiert.`)
      await loadSuppliers()
      setTimeout(() => { setCsvOpen(false); setCsvMsg(''); setCsvPreview([]); setCsvFile(null) }, 1800)
    } else {
      setCsvMsg(d.error ?? 'Fehler beim Import.')
    }
  }

  const filtered = suppliers.filter(s =>
    !search
    || s.company_name.toLowerCase().includes(search.toLowerCase())
    || s.ansprechpartner?.toLowerCase().includes(search.toLowerCase())
    || s.general_email?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4, color: C.white }}>Lieferanten</h2>
      <p style={{ fontSize: 12, color: C.textMid, marginBottom: 16 }}>Kontakte und Kategorien deiner Materiallieferanten.</p>

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Suche nach Firma, Ansprechpartner …"
          style={{ ...inp(), flex: 1 }}
        />
        <button
          onClick={() => { setCsvPreview([]); setCsvMsg(''); setCsvFile(null); setCsvOpen(true) }}
          style={{ background: C.gray2, border: `1px solid ${C.border}`, color: C.textMid, borderRadius: 5, padding: '8px 12px', fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'Helvetica Neue,sans-serif' }}
        >CSV</button>
        <button
          onClick={openNew}
          style={{ background: C.copper, border: 'none', color: C.black, borderRadius: 5, padding: '8px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'Helvetica Neue,sans-serif' }}
        >+ Lieferant</button>
      </div>

      {/* Tabelle */}
      {loading ? (
        <div style={{ color: C.textMid, fontSize: 13 }}>Wird geladen …</div>
      ) : filtered.length === 0 ? (
        <div style={{ color: C.textMid, fontSize: 13, padding: '24px 0', textAlign: 'center', borderTop: `1px solid ${C.border}` }}>
          {suppliers.length === 0 ? 'Noch keine Lieferanten angelegt.' : 'Keine Treffer.'}
        </div>
      ) : (
        <div style={{ border: `1px solid ${C.border}`, borderRadius: 6, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px 160px 70px 36px', padding: '7px 10px', background: C.gray2, borderBottom: `1px solid ${C.border}` }}>
            {['Firma', 'Ansprechpartner', 'E-Mail', 'Status', ''].map((h, i) => (
              <div key={i} style={{ fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', color: C.textMid }}>{h}</div>
            ))}
          </div>
          {filtered.map((s, idx) => (
            <div
              key={s.id}
              onClick={() => openEdit(s)}
              style={{
                display: 'grid', gridTemplateColumns: '1fr 140px 160px 70px 36px',
                padding: '10px 10px', alignItems: 'center',
                cursor: 'pointer',
                borderBottom: idx < filtered.length - 1 ? `1px solid ${C.border}` : 'none',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = C.gray1)}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <div>
                <div style={{ fontSize: 13, color: C.white }}>{s.company_name}</div>
                {s.lieferant_nr && <div style={{ fontSize: 10, color: C.textMid }}>Nr. {s.lieferant_nr}</div>}
              </div>
              <div style={{ fontSize: 12, color: C.textMid, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.ansprechpartner ?? '—'}</div>
              <div style={{ fontSize: 12, color: C.textMid, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.general_email ?? '—'}</div>
              <div style={{ fontSize: 11, color: s.aktiv ? C.ok : C.textMid }}>{s.aktiv ? 'Aktiv' : 'Inaktiv'}</div>
              <button
                onClick={e => { e.stopPropagation(); deleteSupplier(s.id) }}
                style={{ background: 'none', border: 'none', color: C.err, fontSize: 16, cursor: 'pointer', padding: 0, lineHeight: 1 }}
              >×</button>
            </div>
          ))}
        </div>
      )}

      {/* Slide-Over */}
      {panelOpen && (
        <>
          <div onClick={() => setPanelOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,.5)' }} />
          <div style={{
            position: 'fixed', top: 0, right: 0, bottom: 0, width: 420, maxWidth: '95vw',
            background: C.dark, zIndex: 51, borderLeft: `1px solid ${C.border}`,
            overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 14,
            fontFamily: 'Helvetica Neue,sans-serif',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: C.white, margin: 0 }}>
                {editing ? 'Lieferant bearbeiten' : 'Neuer Lieferant'}
              </h3>
              <button onClick={() => setPanelOpen(false)} style={{ background: 'none', border: 'none', color: C.textMid, fontSize: 22, cursor: 'pointer', lineHeight: 1 }}>×</button>
            </div>

            <div>
              <label style={lbl}>Firmenname *</label>
              <input value={form.company_name} onChange={e => setF('company_name', e.target.value)} style={inp()} placeholder="Muster GmbH" />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={lbl}>Lieferant-Nr.</label>
                <input value={form.lieferant_nr ?? ''} onChange={e => setF('lieferant_nr', e.target.value || null)} style={inp()} placeholder="L-001" />
              </div>
              <div>
                <label style={lbl}>Ansprechpartner</label>
                <input value={form.ansprechpartner ?? ''} onChange={e => setF('ansprechpartner', e.target.value || null)} style={inp()} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={lbl}>E-Mail</label>
                <input type="email" value={form.general_email ?? ''} onChange={e => setF('general_email', e.target.value || null)} style={inp()} />
              </div>
              <div>
                <label style={lbl}>Telefon</label>
                <input type="tel" value={form.phone ?? ''} onChange={e => setF('phone', e.target.value || null)} style={inp()} />
              </div>
            </div>

            <div>
              <label style={lbl}>Website</label>
              <input value={form.website ?? ''} onChange={e => setF('website', e.target.value || null)} style={inp()} placeholder="https://..." />
            </div>

            <div>
              <label style={lbl}>Kategorien</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {kategorienOptions.map(kat => {
                  const active = (form.kategorien ?? []).includes(kat)
                  return (
                    <button
                      key={kat}
                      onClick={() => toggleKat(kat)}
                      style={{
                        background: active ? `${C.copper}22` : C.gray2,
                        border: `1px solid ${active ? C.copper : C.border}`,
                        color: active ? C.copper : C.textMid,
                        borderRadius: 4, padding: '5px 10px', fontSize: 12,
                        cursor: 'pointer', fontFamily: 'Helvetica Neue,sans-serif',
                      }}
                    >{kat}</button>
                  )
                })}
              </div>
            </div>

            <div>
              <label style={lbl}>Notizen</label>
              <textarea
                value={form.notes ?? ''}
                onChange={e => setF('notes', e.target.value || null)}
                rows={3}
                style={{ ...inp(), resize: 'vertical', lineHeight: 1.5 }}
              />
            </div>

            <div>
              <button
                onClick={() => setF('aktiv', !form.aktiv)}
                style={{
                  background: form.aktiv ? 'rgba(90,190,106,.15)' : C.gray2,
                  border: `1px solid ${form.aktiv ? C.ok : C.border}`,
                  color: form.aktiv ? C.ok : C.textMid,
                  borderRadius: 4, padding: '6px 14px', fontSize: 12,
                  cursor: 'pointer', fontFamily: 'Helvetica Neue,sans-serif',
                }}
              >{form.aktiv ? '✓ Aktiv' : '○ Inaktiv'}</button>
            </div>

            {saveMsg && (
              <div style={{ fontSize: 12, color: saveMsg.includes('Fehler') || saveMsg.includes('Pflicht') ? C.err : C.ok }}>
                {saveMsg}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, paddingTop: 4 }}>
              <button
                onClick={save}
                disabled={saving}
                style={{
                  background: saving ? '#7a5535' : C.copper, color: C.black, border: 'none',
                  borderRadius: 6, padding: '10px 20px', fontSize: 13, fontWeight: 700,
                  cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'Helvetica Neue,sans-serif',
                }}
              >{saving ? 'Wird gespeichert …' : 'Speichern'}</button>
              {editing && (
                <button
                  onClick={() => deleteSupplier(editing.id)}
                  style={{ background: 'none', border: `1px solid ${C.err}`, color: C.err, borderRadius: 6, padding: '10px 14px', fontSize: 13, cursor: 'pointer', fontFamily: 'Helvetica Neue,sans-serif' }}
                >Löschen</button>
              )}
              <button
                onClick={() => setPanelOpen(false)}
                style={{ background: C.gray2, border: `1px solid ${C.border}`, color: C.textMid, borderRadius: 6, padding: '10px 14px', fontSize: 13, cursor: 'pointer', fontFamily: 'Helvetica Neue,sans-serif' }}
              >Abbrechen</button>
            </div>
          </div>
        </>
      )}

      {/* CSV-Import-Modal */}
      {csvOpen && (
        <>
          <div onClick={() => setCsvOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,.5)' }} />
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
            zIndex: 51, background: C.dark, borderRadius: 10, border: `1px solid ${C.border}`,
            padding: 24, width: '90%', maxWidth: 560, fontFamily: 'Helvetica Neue,sans-serif',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: C.white, margin: 0 }}>CSV importieren</h3>
              <button onClick={() => setCsvOpen(false)} style={{ background: 'none', border: 'none', color: C.textMid, fontSize: 22, cursor: 'pointer', lineHeight: 1 }}>×</button>
            </div>
            <p style={{ fontSize: 12, color: C.textMid, marginBottom: 14, lineHeight: 1.6 }}>
              Spalten: <span style={{ color: C.copper }}>firma, ansprechpartner, email, telefon, website, kategorien, notizen</span><br />
              Kategorien mit Semikolon trennen: <span style={{ color: C.copper }}>Massivholz;Beschläge</span>
            </p>

            <input ref={csvRef} type="file" accept=".csv,text/csv" style={{ display: 'none' }} onChange={handleCsvFile} />
            <div
              onClick={() => csvRef.current?.click()}
              style={{
                border: `2px dashed ${csvFile ? C.copper : C.border}`, borderRadius: 8,
                padding: '18px', textAlign: 'center', cursor: 'pointer', marginBottom: 14,
                color: csvFile ? C.copper : C.textMid, fontSize: 13,
              }}
            >
              {csvFile ? `📄 ${csvFile.name}` : '📄 CSV-Datei auswählen'}
            </div>

            {csvPreview.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 10, letterSpacing: 2, color: C.textMid, textTransform: 'uppercase', marginBottom: 8 }}>
                  Vorschau (erste {csvPreview.length} Zeilen)
                </div>
                <div style={{ overflowX: 'auto', border: `1px solid ${C.border}`, borderRadius: 6 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                    <thead>
                      <tr>
                        {Object.keys(csvPreview[0]).map(h => (
                          <th key={h} style={{ padding: '6px 8px', background: C.gray2, color: C.textMid, textAlign: 'left', borderBottom: `1px solid ${C.border}`, whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {csvPreview.map((row, i) => (
                        <tr key={i}>
                          {Object.values(row).map((v, j) => (
                            <td key={j} style={{ padding: '6px 8px', color: C.white, borderBottom: i < csvPreview.length - 1 ? `1px solid ${C.border}` : 'none', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{String(v)}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {csvMsg && (
              <div style={{ fontSize: 12, color: csvMsg.includes('Fehler') || csvMsg.includes('Bitte') ? C.err : C.ok, marginBottom: 12 }}>
                {csvMsg}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setCsvOpen(false)}
                style={{ background: C.gray2, border: `1px solid ${C.border}`, color: C.textMid, borderRadius: 6, padding: '9px 16px', fontSize: 13, cursor: 'pointer', fontFamily: 'Helvetica Neue,sans-serif' }}
              >Abbrechen</button>
              <button
                onClick={importCsv}
                disabled={csvImporting || !csvFile}
                style={{
                  background: csvImporting || !csvFile ? '#7a5535' : C.copper,
                  color: C.black, border: 'none', borderRadius: 6, padding: '9px 16px',
                  fontSize: 13, fontWeight: 700,
                  cursor: csvImporting || !csvFile ? 'not-allowed' : 'pointer',
                  fontFamily: 'Helvetica Neue,sans-serif',
                }}
              >{csvImporting ? 'Importiert …' : 'Importieren'}</button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
