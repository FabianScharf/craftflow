'use client'
import { useEffect, useState } from 'react'
import { akzentTon } from '@/lib/theme'
import { C } from '@/lib/types'
import { STATUS_LABEL, WUNSCH_STATUS, TITEL_MAX, BESCHREIBUNG_MAX, type WunschStatus } from '@/lib/wuensche'

// Einstellungen -> Wünsche. Jeder Plan darf vorschlagen und abstimmen; wie viele
// Stimmen jemand hat, entscheidet sein Plan (1/3/10/30, src/lib/plaene.ts).
// Der Server setzt das durch — diese Anzeige spart nur den Fehlversuch.

type Wunsch = {
  id: string; titel: string; beschreibung: string; status: WunschStatus
  created_at: string; stimmen: number; eigeneStimmen: number; vonDir: boolean
  zusammengelegt_in?: string | null
}

const STATUS_FARBE: Record<WunschStatus, string> = {
  offen: C.textMid, geplant: C.copper, in_arbeit: C.warn, fertig: C.ok, ausgeblendet: C.err,
}

export default function WuenscheSettings() {
  const [wuensche, setWuensche] = useState<Wunsch[]>([])
  const [budget, setBudget] = useState({ gesamt: 0, benutzt: 0, ruhend: 0 })
  const [istAdmin, setIstAdmin] = useState(false)
  const [laedt, setLaedt] = useState(true)
  const [fehler, setFehler] = useState('')
  const [titel, setTitel] = useState('')
  const [beschreibung, setBeschreibung] = useState('')
  const [sendet, setSendet] = useState(false)
  const [meldung, setMeldung] = useState<{ ok: boolean; text: string; planLink?: boolean } | null>(null)
  // I-1: nur für den Admin — zeigt auch Ausgeblendetes und Zusammengelegtes, das
  // sonst (RLS + Routenfilter) unwiderruflich verschwunden wirkt.
  const [zeigeAlle, setZeigeAlle] = useState(false)

  useEffect(() => { void laden(zeigeAlle) }, [zeigeAlle])

  async function laden(alle = zeigeAlle) {
    const res = await fetch(alle ? '/api/wuensche?alle=1' : '/api/wuensche')
    const j = await res.json().catch(() => ({})) as {
      wuensche?: Wunsch[]; budget?: { gesamt: number; benutzt: number; ruhend: number }; istAdmin?: boolean; error?: string
    }
    // Supabase wirft nicht — der echte Grund gehoert auf den Bildschirm, nicht ins Log.
    if (!res.ok) { setFehler(j.error ?? `Laden fehlgeschlagen (${res.status})`); setLaedt(false); return }
    setWuensche(j.wuensche ?? [])
    setBudget(j.budget ?? { gesamt: 0, benutzt: 0, ruhend: 0 })
    setIstAdmin(j.istAdmin === true)
    setLaedt(false)
  }

  async function vorschlagen() {
    setMeldung(null); setSendet(true)
    const res = await fetch('/api/wuensche', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ titel, beschreibung }),
    })
    const j = await res.json().catch(() => ({})) as { error?: string }
    setSendet(false)
    if (!res.ok) { setMeldung({ ok: false, text: j.error ?? 'Vorschlag konnte nicht gespeichert werden.' }); return }
    setTitel(''); setBeschreibung('')
    setMeldung({ ok: true, text: 'Danke — dein Vorschlag steht in der Liste.' })
    await laden()
  }

  async function stimmeHinzufuegen(w: Wunsch) {
    setMeldung(null)
    const res = await fetch(`/api/wuensche/${w.id}/stimme`, { method: 'POST' })
    const j = await res.json().catch(() => ({})) as { error?: string; minPlan?: string | null }
    if (!res.ok) {
      setMeldung({ ok: false, text: j.error ?? 'Das hat nicht geklappt.', planLink: !!j.minPlan })
      return
    }
    await laden()
  }

  async function stimmeZurueck(w: Wunsch) {
    setMeldung(null)
    const res = await fetch(`/api/wuensche/${w.id}/stimme`, { method: 'DELETE' })
    const j = await res.json().catch(() => ({})) as { error?: string }
    if (!res.ok) { setMeldung({ ok: false, text: j.error ?? 'Das hat nicht geklappt.' }); return }
    await laden()
  }

  async function statusSetzen(w: Wunsch, status: WunschStatus) {
    const res = await fetch(`/api/admin/wuensche/${w.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    const j = await res.json().catch(() => ({})) as { error?: string }
    if (!res.ok) { setMeldung({ ok: false, text: j.error ?? 'Status nicht geändert.' }); return }
    await laden()
  }

  async function zusammenlegen(w: Wunsch, zielId: string) {
    if (!zielId) return
    const res = await fetch(`/api/admin/wuensche/${w.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ zusammengelegt_in: zielId }),
    })
    const j = await res.json().catch(() => ({})) as { error?: string }
    if (!res.ok) { setMeldung({ ok: false, text: j.error ?? 'Zusammenlegen fehlgeschlagen.' }); return }
    await laden()
  }

  if (laedt) return <div style={{ color: C.textMid, fontSize: 13 }}>Lädt …</div>

  const kannNochStimmen = budget.benutzt < budget.gesamt
  const titelRest = TITEL_MAX - titel.length
  const beschreibungRest = BESCHREIBUNG_MAX - beschreibung.length

  return (
    <div>
      <div style={{ color: C.white, fontSize: 15, fontWeight: 700, marginBottom: 6 }}>Wünsche</div>
      <p style={{ color: C.textMid, fontSize: 13, lineHeight: 1.6, marginBottom: 8 }}>
        Was fehlt dir in CraftFlow? Schreib es auf und stimm über die Vorschläge der
        anderen ab. Was die meisten Stimmen hat, wird als Nächstes gebaut.
      </p>
      <p style={{ color: C.textMid, fontSize: 13, lineHeight: 1.6, marginBottom: 16 }}>
        Du kannst alle Stimmen auf ein Thema legen. Ist ein Wunsch fertig, bekommst du
        die Stimmen zurück. Es gibt keinen monatlichen Nachschub — dein Konto ist ein
        fester Vorrat je Plan.{' '}
        {/* Fabian, 16.09.: Von hier direkt zur öffentlichen Roadmap — was geplant, in Arbeit und fertig ist. */}
        Was daraus geplant, in Arbeit oder fertig ist, steht auf der{' '}
        <a href="https://www.getcraftflow.de/roadmap" target="_blank" rel="noreferrer"
          style={{ color: C.copper, textDecoration: 'underline' }}>Roadmap</a>.
      </p>

      {fehler && <div style={{ color: C.err, fontSize: 13, marginBottom: 14 }}>{fehler}</div>}

      <div style={{ background: akzentTon('0D'), border: `1px solid ${akzentTon('44')}`,
        borderRadius: 8, padding: '12px 14px', marginBottom: 18, fontSize: 13, color: C.white }}>
        Du hast {budget.benutzt} von {budget.gesamt} Stimmen vergeben.
        {!kannNochStimmen && (
          <span style={{ color: C.textMid }}> Nimm eine zurück oder wechsle den Plan, um weiter abzustimmen.</span>
        )}
        {budget.ruhend > 0 && (
          <div style={{ color: C.textMid, marginTop: 4 }}>
            {budget.ruhend} weitere {budget.ruhend === 1 ? 'ruht' : 'ruhen'}, weil dein Plan
            weniger Stimmen hat — {budget.ruhend === 1 ? 'sie zählt' : 'sie zählen'} wieder,
            sobald du hochstufst.
          </div>
        )}
      </div>

      <div style={{ background: C.gray1, borderRadius: 8, padding: 14, marginBottom: 22 }}>
        <input value={titel} maxLength={TITEL_MAX} placeholder="Kurz und klar, z. B. „Serienbrief an alle Kunden“"
          onChange={e => { setMeldung(null); setTitel(e.target.value) }}
          style={{ width: '100%', background: C.gray2, border: `1px solid ${C.border}`, borderRadius: 6,
            color: C.white, padding: '9px 11px', fontSize: 13, marginBottom: 4, boxSizing: 'border-box' }} />
        <div style={{ textAlign: 'right', fontSize: 11, color: C.textMid, marginBottom: 6 }}>
          {titelRest} Zeichen übrig
        </div>
        <textarea value={beschreibung} maxLength={BESCHREIBUNG_MAX} rows={4}
          placeholder="Was soll es können? Wobei würde es dir helfen?"
          onChange={e => { setMeldung(null); setBeschreibung(e.target.value) }}
          style={{ width: '100%', background: C.gray2, border: `1px solid ${C.border}`, borderRadius: 6,
            color: C.white, padding: '9px 11px', fontSize: 13, marginBottom: 4, boxSizing: 'border-box',
            fontFamily: 'Helvetica Neue,sans-serif', resize: 'vertical' }} />
        <div style={{ textAlign: 'right', fontSize: 11, color: C.textMid, marginBottom: 6 }}>
          {beschreibungRest} Zeichen übrig
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <button onClick={() => void vorschlagen()} disabled={!titel.trim() || sendet} style={{
            background: titel.trim() ? C.copper : 'transparent',
            border: titel.trim() ? 'none' : `1px solid ${C.border}`, borderRadius: 8,
            color: titel.trim() ? C.black : C.textMid, fontWeight: titel.trim() ? 700 : 400,
            padding: '10px 18px', fontSize: 13, cursor: titel.trim() ? 'pointer' : 'default',
            opacity: sendet ? 0.6 : 1 }}>
            {sendet ? 'Sendet …' : 'Wunsch vorschlagen'}
          </button>
          {meldung && (
            <span style={{ fontSize: 13, color: meldung.ok ? C.ok : C.err }}>
              {meldung.text}
              {meldung.planLink && (
                <>
                  {' '}
                  <a href="/settings#plan" style={{ color: C.copper, textDecoration: 'underline' }}>
                    Plan wechseln
                  </a>
                </>
              )}
            </span>
          )}
        </div>
      </div>

      {istAdmin && (
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14,
          fontSize: 12.5, color: C.textMid, cursor: 'pointer' }}>
          <input type="checkbox" checked={zeigeAlle} onChange={e => setZeigeAlle(e.target.checked)} />
          Ausgeblendete und zusammengelegte anzeigen
        </label>
      )}

      {wuensche.length === 0 && (
        <div style={{ color: C.textMid, fontSize: 13 }}>Noch kein Vorschlag. Mach den ersten.</div>
      )}

      {wuensche.map(w => {
        const versteckt = w.status === 'ausgeblendet' || !!w.zusammengelegt_in
        const fertig = w.status === 'fertig'
        const kannAbstimmen = !versteckt && !fertig
        return (
        <div key={w.id} style={{ display: 'flex', gap: 14, alignItems: 'flex-start',
          background: C.gray1, borderRadius: 8, padding: '12px 14px', marginBottom: 10,
          opacity: versteckt ? 0.5 : 1 }}>
          <div style={{ minWidth: 56, display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 2 }}>
            {kannAbstimmen && (
              <button onClick={() => void stimmeHinzufuegen(w)} title="Eine Stimme dazu"
                disabled={!kannNochStimmen}
                style={{
                  background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 6,
                  color: C.white, fontWeight: 700, fontSize: 13, padding: '3px 6px',
                  cursor: kannNochStimmen ? 'pointer' : 'default', opacity: kannNochStimmen ? 1 : 0.4 }}>
                ▲
              </button>
            )}
            <div style={{ textAlign: 'center', fontWeight: 700, fontSize: 18, padding: '2px 0',
              color: w.eigeneStimmen > 0 ? C.copper : C.white }}>
              {w.stimmen}
            </div>
            {kannAbstimmen && w.eigeneStimmen > 0 && (
              <button onClick={() => void stimmeZurueck(w)} title="Eine eigene Stimme zurück"
                style={{
                  background: 'transparent', border: `1px solid ${C.copper}`, borderRadius: 6,
                  color: C.copper, fontWeight: 700, fontSize: 13, padding: '3px 6px', cursor: 'pointer' }}>
                ▼
              </button>
            )}
            {w.eigeneStimmen > 0 && (
              <div style={{ textAlign: 'center', fontSize: 10, color: C.copper, marginTop: 2 }}>
                deine {w.eigeneStimmen}
              </div>
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ color: C.white, fontSize: 13.5, fontWeight: 700 }}>{w.titel}</span>
              <span style={{ fontSize: 10, letterSpacing: 1, textTransform: 'uppercase',
                color: STATUS_FARBE[w.status], border: `1px solid ${C.border}`,
                borderRadius: 4, padding: '2px 6px' }}>{STATUS_LABEL[w.status]}</span>
              {w.vonDir && <span style={{ fontSize: 11, color: C.copper }}>von dir</span>}
            </div>
            {w.beschreibung && (
              <div style={{ color: C.textMid, fontSize: 12.5, lineHeight: 1.6, marginTop: 4, whiteSpace: 'pre-wrap' }}>
                {w.beschreibung}
              </div>
            )}
            <div style={{ color: C.textMid, fontSize: 11, marginTop: 6 }}>
              {new Date(w.created_at).toLocaleDateString('de-DE')}
              {w.zusammengelegt_in && ' · zusammengelegt'}
            </div>
            {istAdmin && (
              <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                <select value={w.status} onChange={e => void statusSetzen(w, e.target.value as WunschStatus)}
                  style={{ background: C.gray2, border: `1px solid ${C.border}`, borderRadius: 6,
                    color: C.white, fontSize: 12, padding: '5px 8px' }}>
                  {WUNSCH_STATUS.map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                </select>
                <select defaultValue="" onChange={e => void zusammenlegen(w, e.target.value)}
                  style={{ background: C.gray2, border: `1px solid ${C.border}`, borderRadius: 6,
                    color: C.white, fontSize: 12, padding: '5px 8px' }}>
                  <option value="">Zusammenlegen in …</option>
                  {wuensche.filter(z => z.id !== w.id).map(z => (
                    <option key={z.id} value={z.id}>{z.titel}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
        )
      })}
    </div>
  )
}
