import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

function getTagText(xml: string, tag: string): string {
  const m = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'))
  return m?.[1]?.trim() ?? ''
}

function xmlEscape(s: string) {
  return s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
}

function parseGaebXMLServer(xml: string) {
  const items: { titel: string; beschreibung: string; menge: number; einheit: string; up: number }[] = []
  const itemRegex = /<Item\b[^>]*>([\s\S]*?)<\/Item>/gi
  let m: RegExpExecArray | null
  while ((m = itemRegex.exec(xml)) !== null) {
    const body = m[1]
    const shortText = xmlEscape(getTagText(body, 'ShortText'))
    const detailText = xmlEscape(getTagText(body, 'Text'))
    const qty = parseFloat(getTagText(body, 'Qty').replace(',', '.')) || 1
    const unit = getTagText(body, 'QU') || 'Psch'
    const up = parseFloat(getTagText(body, 'UP').replace(',', '.')) || 0
    items.push({ titel: shortText || 'Position', beschreibung: detailText, menge: qty, einheit: unit, up })
  }
  return items
}

function parseGaebTextServer(text: string) {
  const lines = text.split(/\r?\n/)
  const items: { titel: string; beschreibung: string; menge: number; einheit: string; up: number }[] = []
  let current: (typeof items)[0] | null = null
  let ltLines: string[] = []
  for (const line of lines) {
    const code = line.substring(0, 2)
    if (code === 'P0') {
      if (current) { current.beschreibung = ltLines.join('\n'); items.push(current); ltLines = [] }
      const parts = line.substring(3).trim().split(/\s+/)
      const einheit = parts[1] ?? 'Stk'
      const menge = parseFloat((parts[2] ?? '1').replace(',', '.')) || 1
      const titel = parts.slice(3).join(' ').trim() || `Position ${parts[0]}`
      current = { titel, beschreibung: '', menge, einheit, up: 0 }
    } else if ((code === 'L1' || code === 'L2') && current) {
      const t = line.substring(2).trim()
      if (t) ltLines.push(t)
    }
  }
  if (current) { current.beschreibung = ltLines.join('\n'); items.push(current) }
  return items
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const body = await req.json() as { xml?: string }
  if (!body.xml) return NextResponse.json({ error: 'xml fehlt' }, { status: 400 })

  const xmlText = body.xml
  const isXML = xmlText.trimStart().startsWith('<') || xmlText.includes('<GAEB') || xmlText.includes('<BoQ')
  const rawItems = isXML ? parseGaebXMLServer(xmlText) : parseGaebTextServer(xmlText)

  const positionen = rawItems.map((item, i) => ({
    id: Date.now() + i * 3,
    titel: item.titel,
    beschreibung: item.beschreibung,
    material: item.up > 0 ? [{ id: Date.now() + i * 3 + 1, bezeichnung: item.titel, menge: item.menge, einheit: item.einheit, ekPreis: item.up, aufschlag: 0 }] : [],
    arbeitszeit: [],
  }))

  return NextResponse.json({ positionen })
}
