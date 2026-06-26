import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

function calcNetto(pos: { material?: { menge: number; ekPreis: number; aufschlag: number }[]; arbeitszeit?: { minuten: number; vkStunde: number }[] }[]): number {
  return (pos || []).reduce((sum, p) => {
    const mat = (p.material || []).reduce((s, m) => s + (m.menge || 0) * (m.ekPreis || 0) * (1 + (m.aufschlag || 0)), 0)
    const arb = (p.arbeitszeit || []).reduce((s, a) => s + ((a.minuten || 0) / 60) * (a.vkStunde || 0), 0)
    return sum + mat + arb
  }, 0)
}

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

    const { data: projects, error } = await supabase
      .from('projects')
      .select('id, title, status, created_at, data')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const enriched = (projects || []).map(p => {
      const d = p.data as { pos?: Parameters<typeof calcNetto>[0]; docTyp?: string; kunde?: { name?: string } } | null
      return {
        id: p.id,
        title: p.title,
        status: p.status,
        created_at: p.created_at,
        docTyp: d?.docTyp ?? 'Angebot',
        kunde: d?.kunde?.name ?? p.title,
        netto: calcNetto(d?.pos ?? []),
      }
    })

    // ── Zeitraum-Helfer
    const now = new Date()
    const startOf = (unit: 'week' | 'month' | 'quarter' | 'year') => {
      const d = new Date(now)
      if (unit === 'week') { d.setDate(d.getDate() - d.getDay() + 1); d.setHours(0, 0, 0, 0) }
      if (unit === 'month') { d.setDate(1); d.setHours(0, 0, 0, 0) }
      if (unit === 'quarter') { d.setMonth(Math.floor(d.getMonth() / 3) * 3, 1); d.setHours(0, 0, 0, 0) }
      if (unit === 'year') { d.setMonth(0, 1); d.setHours(0, 0, 0, 0) }
      return d
    }

    const filter = (from: Date) => enriched.filter(p => new Date(p.created_at) >= from)

    const stats = (items: typeof enriched) => ({
      anzahl: items.length,
      volumen: items.reduce((s, p) => s + p.netto, 0),
      durchschnitt: items.length ? items.reduce((s, p) => s + p.netto, 0) / items.length : 0,
      max: items.length ? Math.max(...items.map(p => p.netto)) : 0,
    })

    // ── Monatliche Aufschlüsselung (letzte 12 Monate)
    const monatlich: Record<string, { anzahl: number; volumen: number }> = {}
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      monatlich[key] = { anzahl: 0, volumen: 0 }
    }
    enriched.forEach(p => {
      const d = new Date(p.created_at)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      if (monatlich[key]) {
        monatlich[key].anzahl++
        monatlich[key].volumen += p.netto
      }
    })

    // ── Nach Dokumenttyp
    const nachTyp: Record<string, { anzahl: number; volumen: number }> = {}
    enriched.forEach(p => {
      const t = p.docTyp || 'Angebot'
      if (!nachTyp[t]) nachTyp[t] = { anzahl: 0, volumen: 0 }
      nachTyp[t].anzahl++
      nachTyp[t].volumen += p.netto
    })

    // ── Top-Kunden (nach Volumen)
    const kundenMap: Record<string, { volumen: number; anzahl: number }> = {}
    enriched.forEach(p => {
      const k = p.kunde || '–'
      if (!kundenMap[k]) kundenMap[k] = { volumen: 0, anzahl: 0 }
      kundenMap[k].volumen += p.netto
      kundenMap[k].anzahl++
    })
    const topKunden = Object.entries(kundenMap)
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.volumen - a.volumen)
      .slice(0, 5)

    return NextResponse.json({
      gesamt: stats(enriched),
      woche: stats(filter(startOf('week'))),
      monat: stats(filter(startOf('month'))),
      quartal: stats(filter(startOf('quarter'))),
      jahr: stats(filter(startOf('year'))),
      monatlich,
      nachTyp,
      topKunden,
      letzte: enriched.slice(0, 10),
    })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Fehler' }, { status: 500 })
  }
}
