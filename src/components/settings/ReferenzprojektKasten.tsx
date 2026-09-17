'use client'
import { useState } from 'react'
import { akzentTon } from '@/lib/theme'
import {
  C, eur, calcAngebotspos, materialkostenPos, arbeitszeitPreisPos,
  stueckzahlVon, materialRabatt, zeitFaktorFuer, normalizeKsId, KOSTENSTELLEN_LABELS,
  serienHinweis,
} from '@/lib/types'
import type { ReferenzPosition } from '@/lib/referenzprojekte.ts'
import type { Referenzmoebel, Fragenschluessel, Anker } from '@/lib/kalibrierung'
import { RANDBAENDER, RANDHINWEIS } from '@/lib/kalibrierung'

// Task R4: die "Das Referenzprojekt"-Box in Mein Betrieb. Zeigt die ECHTE
// Kalkulation der Route (GET /api/settings/kalibrierung -> referenzprojekt),
// gerechnet mit den Saetzen und dem Materialaufschlag DIESES Betriebs — kein
// Preis kommt hier aus einer Formel, alles laeuft ueber calcAngebotspos &Co.
// aus types.ts (dieselbe Rechenstelle wie Angebot, PDF und Export).
//
// Die vier Betriebsfragen (grund/lack/massiv/montage) sind jetzt direkt bei
// der Position platziert, die sie betreffen — nicht mehr gesammelt am Ende.

export type ReferenzprojektDaten = {
  schluessel: string
  name: string
  kunde: { name: string; strasse: string; ort: string; projekt: string }
  text: string
  positionen: ReferenzPosition[]
  summen: { netto: number; material: number; arbeit: number; stunden: number }
  faustregel: { imRahmen: boolean; text: string; anzeigen?: boolean }
  /** Task R2 Fix Runde 2: EINE Quelle fuer den Anker-Text, aus der Route (ankerFuer). */
  anker: Partial<Record<Fragenschluessel, Anker>>
}

type GruppeFn = (
  titel: string, hinweis: string, werte: Array<{ wert: string; text: string }>,
  aktuell: string, setzen: (w: string) => void, fussnote?: string,
) => React.ReactElement

type Props = {
  daten: ReferenzprojektDaten
  referenzmoebel: Referenzmoebel
  antwort: (frage: string) => string
  setzeAntwort: (frage: string, w: string) => void
  gruppe: GruppeFn
  /** true, wenn der gewaehlte Schwerpunkt eine EIGENE Referenz hat (kein Einbauschrank-Fallback). */
  eigeneReferenz: boolean
}

const thStyle: React.CSSProperties = {
  fontSize: 10, letterSpacing: 0.5, textTransform: 'uppercase',
  color: C.textMid, padding: '4px 6px', textAlign: 'left', fontWeight: 600, whiteSpace: 'nowrap',
}
const tdStyle: React.CSSProperties = { padding: '4px 6px', fontSize: 12, color: C.white }

function Chip({ text }: { text: string }) {
  return (
    <span style={{
      background: akzentTon('22'), border: `1px solid ${C.copper}`, borderRadius: 999,
      padding: '2px 8px', fontSize: 10, fontWeight: 700, color: C.copper,
      textTransform: 'uppercase', letterSpacing: 0.5, whiteSpace: 'nowrap',
    }}>{text}</span>
  )
}

export default function ReferenzprojektKasten({ daten, referenzmoebel, antwort, setzeAntwort, gruppe, eigeneReferenz }: Props) {
  const [offen, setOffen] = useState(false)
  const [aufgeklappt, setAufgeklappt] = useState<Set<number>>(new Set())
  const [oeffnenLaeuft, setOeffnenLaeuft] = useState(false)
  const [oeffnenMeldung, setOeffnenMeldung] = useState<{ ok: boolean; text: string } | null>(null)

  const toggle = (id: number) => setAufgeklappt(prev => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id); else next.add(id)
    return next
  })

  async function alsProjektOeffnen() {
    setOeffnenLaeuft(true); setOeffnenMeldung(null)
    const res = await fetch('/api/settings/kalibrierung/als-projekt', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ schluessel: daten.schluessel }),
    })
    const j = await res.json().catch(() => ({})) as { title?: string; error?: string }
    setOeffnenLaeuft(false)
    if (!res.ok) { setOeffnenMeldung({ ok: false, text: j.error ?? 'Anlegen fehlgeschlagen' }); return }
    setOeffnenMeldung({ ok: true, text: `Projekt „${j.title}“ angelegt — du findest es unter Meine Projekte.` })
  }

  const grundPositionen = daten.positionen.filter(p => !p.alternativ)
  const varianten: Fragenschluessel[] = ['lack', 'massiv', 'montage']
  const frageZu = (schluessel: string) => referenzmoebel.fragenliste.find(f => f.schluessel === schluessel)

  const positionsZeile = (pos: ReferenzPosition) => {
    const n = stueckzahlVon(pos)
    const preis = calcAngebotspos(pos)
    const matTotal = materialkostenPos(pos)
    const arbTotal = arbeitszeitPreisPos(pos)
    const auf = aufgeklappt.has(pos.id)
    return (
      <div key={pos.id} style={{ borderBottom: `1px solid ${C.border}` }}>
        <div onClick={() => toggle(pos.id)} style={{
          display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer', padding: '8px 4px',
        }}>
          <span style={{ fontSize: 11, color: C.textMid, flexShrink: 0, transition: 'transform 0.15s',
            transform: auf ? 'rotate(90deg)' : 'rotate(0deg)', lineHeight: 1 }}>▶</span>
          <span style={{ flex: 1, color: C.white, fontSize: 13, fontWeight: 600 }}>{pos.titel}</span>
          {pos.alternativ && <Chip text="Alternative" />}
          <span style={{ fontSize: 12, color: C.textMid, flexShrink: 0 }}>{n} Stk</span>
          <span style={{ fontWeight: 700, fontSize: 13, flexShrink: 0,
            color: pos.alternativ ? C.textMid : C.copper }}>
            {pos.alternativ ? `(${eur(preis)})` : eur(preis)}
          </span>
        </div>
        {auf && (
          <div style={{ padding: '0 4px 12px 24px' }}>
            {/* Fabian 2026-09-17: "5 Minuten Verpacken? Ist das jetzt für ein Schrank,
                oder für alle 5?" — Mengen und Minuten gelten JE STUECK, die Preise
                rechts sind fuer alle Stueck. Das stand nirgends dran. */}
            {n > 1 && (
              <div style={{ fontSize: 11, color: C.textMid, marginBottom: 8, lineHeight: 1.5 }}>
                Mengen und Minuten gelten <b style={{ color: C.white }}>je Stück</b>, die Preise für alle {n} Stück.
                {' '}{serienHinweis(n)}.
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 11, color: C.textMid, fontWeight: 700 }}>Material{n > 1 ? ' je Stück' : ''}</span>
              <span style={{ fontSize: 11, color: C.textMid }}>{n > 1 ? `${n} Stück: ` : ''}{eur(matTotal)}</span>
            </div>
            <div style={{ overflowX: 'auto', marginBottom: 12 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 420 }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                    <th style={thStyle}>Bezeichnung</th>
                    <th style={thStyle}>Menge{n > 1 ? ' / Stk' : ''}</th>
                    <th style={thStyle}>Einheit</th>
                    <th style={thStyle}>EK</th>
                    <th style={thStyle}>Aufschlag</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Preis{n > 1 ? ` (${n} Stk)` : ''}</th>
                  </tr>
                </thead>
                <tbody>
                  {pos.material.map(mp => {
                    const zeilenPreis = mp.menge * mp.ekPreis * (1 + mp.aufschlag) * n * (1 - materialRabatt(n))
                    return (
                      <tr key={mp.id}>
                        <td style={tdStyle}>{mp.bezeichnung}</td>
                        <td style={tdStyle}>{mp.menge.toLocaleString('de-DE')}</td>
                        <td style={tdStyle}>{mp.einheit}</td>
                        <td style={tdStyle}>{eur(mp.ekPreis)}</td>
                        <td style={tdStyle}>{Math.round(mp.aufschlag * 100)} %</td>
                        <td style={{ ...tdStyle, textAlign: 'right' }}>{eur(zeilenPreis)}</td>
                      </tr>
                    )
                  })}
                  {pos.material.length === 0 && (
                    <tr><td style={{ ...tdStyle, color: C.textMid }} colSpan={6}>Kein Material.</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 11, color: C.textMid, fontWeight: 700 }}>Arbeitszeit{n > 1 ? ' je Stück' : ''}</span>
              <span style={{ fontSize: 11, color: C.textMid }}>{n > 1 ? `${n} Stück: ` : ''}{eur(arbTotal)}</span>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 380 }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                    <th style={thStyle}>Kostenstelle</th>
                    <th style={thStyle}>Minuten{n > 1 ? ' / Stk' : ''}</th>
                    <th style={thStyle}>Satz</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Betrag{n > 1 ? ` (${n} Stk)` : ''}</th>
                  </tr>
                </thead>
                <tbody>
                  {pos.arbeitszeit.map(a => {
                    const ks = normalizeKsId(a.kostenstelle)
                    const betrag = (a.minuten / 60) * a.vkStunde * zeitFaktorFuer(ks, n)
                    return (
                      <tr key={a.id}>
                        <td style={tdStyle}>{KOSTENSTELLEN_LABELS[ks] ?? a.kostenstelle}</td>
                        <td style={tdStyle}>{a.minuten.toLocaleString('de-DE')} min</td>
                        <td style={tdStyle}>{eur(a.vkStunde)}/h</td>
                        <td style={{ ...tdStyle, textAlign: 'right' }}>{eur(betrag)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    )
  }

  const frageBlock = (schluessel: Fragenschluessel, anker: string) => {
    const f = frageZu(schluessel)
    if (!f) return null
    return (
      <div style={{ margin: '10px 0 20px 24px' }}>
        <div style={{ color: C.white, fontSize: 12, fontWeight: 600, marginBottom: 6 }}>{anker}</div>
        {gruppe(f.text, f.hinweis, f.baender.map(b => ({ wert: b.schluessel, text: b.text })),
          antwort(schluessel), w => setzeAntwort(schluessel, w),
          RANDBAENDER.includes(antwort(schluessel)) ? RANDHINWEIS : '')}
      </div>
    )
  }

  return (
    <div style={{ background: C.gray1, borderRadius: 8, padding: 16, marginBottom: 22 }}>
      <div style={{ color: C.white, fontSize: 13, fontWeight: 700, marginBottom: 8 }}>
        Das Referenzprojekt: {daten.name}
      </div>
      <div style={{ color: C.textMid, fontSize: 12, marginBottom: 10 }}>
        {daten.kunde.name} — {daten.kunde.projekt} · {daten.kunde.strasse}, {daten.kunde.ort}
      </div>
      <div style={{ color: C.white, fontSize: 13, lineHeight: 1.7 }}>{daten.text}</div>

      {!eigeneReferenz && (
        <div style={{ color: C.textMid, fontSize: 12, marginTop: 10, lineHeight: 1.6 }}>
          Kalibriert am Einbauschrank — er steht deiner Arbeit am nächsten.
        </div>
      )}

      <button onClick={() => setOffen(o => !o)} style={{
        background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 8,
        color: C.white, padding: '8px 14px', fontSize: 12, cursor: 'pointer', marginTop: 12,
      }}>
        {offen ? '▾' : '▸'} So rechnet CraftFlow dieses Projekt
      </button>

      {offen && (
        <div style={{ marginTop: 14 }}>
          <div style={{ display: 'flex', gap: 8, padding: '4px 4px', borderBottom: `1px solid ${C.border}` }}>
            <span style={{ width: 11 }} />
            <span style={{ ...thStyle, flex: 1, padding: 0 }}>Titel</span>
            <span style={{ ...thStyle, padding: 0 }}>Stk</span>
            <span style={{ ...thStyle, padding: 0 }}>Preis</span>
          </div>
          {grundPositionen.map(positionsZeile)}

          {varianten.map(schluessel => {
            const pos = daten.positionen.find(q => q.variante === schluessel)
            if (!pos) return null
            const anker = daten.anker[schluessel]?.text ?? ''
            return (
              <div key={schluessel}>
                {positionsZeile(pos)}
                {frageBlock(schluessel, anker)}
              </div>
            )
          })}

          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', padding: '12px 4px',
            borderTop: `1px solid ${C.border}`, marginTop: 4 }}>
            <div><span style={{ color: C.textMid, fontSize: 11 }}>Material</span><br />
              <b style={{ color: C.white, fontSize: 14 }}>{eur(daten.summen.material)}</b></div>
            <div><span style={{ color: C.textMid, fontSize: 11 }}>Arbeit</span><br />
              <b style={{ color: C.white, fontSize: 14 }}>{eur(daten.summen.arbeit)}</b></div>
            <div><span style={{ color: C.textMid, fontSize: 11 }}>Netto</span><br />
              <b style={{ color: C.copper, fontSize: 14 }}>{eur(daten.summen.netto)}</b></div>
          </div>

          {frageBlock('grund', daten.anker.grund?.text ?? '')}

          {daten.faustregel.anzeigen !== false && (
            <div style={{ color: daten.faustregel.imRahmen ? C.ok : C.warn, fontSize: 12, marginBottom: 14 }}>
              {daten.faustregel.text}
            </div>
          )}

          <button onClick={() => void alsProjektOeffnen()} disabled={oeffnenLaeuft} style={{
            background: C.copper, border: 'none', borderRadius: 8, color: C.onAccent,
            padding: '10px 18px', fontSize: 13, fontWeight: 700,
            cursor: oeffnenLaeuft ? 'default' : 'pointer', opacity: oeffnenLaeuft ? 0.6 : 1,
          }}>
            {oeffnenLaeuft ? 'Legt an …' : 'Als Projekt öffnen'}
          </button>
          {oeffnenMeldung && (
            <span style={{ fontSize: 13, marginLeft: 12, color: oeffnenMeldung.ok ? C.ok : C.err }}>
              {oeffnenMeldung.text}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
