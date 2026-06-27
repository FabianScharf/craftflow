import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

type ReqMaterial = { id: number; bezeichnung: string; menge: number; einheit: string }

type SupplierRow = {
  id: string
  company_name: string
  general_email: string | null
  ansprechpartner: string | null
  phone: string | null
  website: string | null
  kategorien: string[] | null
}

export type SuggestedSupplier = {
  name: string
  website: string | null
  email: string | null
  phone: string | null
  gruppe: string
  materialien: string[]
}

async function callAnthropic(prompt: string, maxTokens = 600): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY fehlt')
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
    }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(`Claude ${res.status}: ${(data as { error?: { message?: string } }).error?.message ?? 'Fehler'}`)
  const content = (data as { content?: Array<{ text?: string }> }).content?.[0]?.text
  return (content ?? '').replace(/```json\n?|```/g, '').trim()
}

type AnthropicContent = { type: string; id?: string; text?: string; name?: string; input?: unknown }
type AnthropicResponse = { stop_reason: string; content: AnthropicContent[] }

async function callAnthropicWithWebSearch(prompt: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return ''

  const messages: Array<{ role: string; content: unknown }> = [
    { role: 'user', content: prompt }
  ]

  // Tool-use-Loop: max 4 Iterationen (Suche → Ergebnis → Antwort)
  for (let i = 0; i < 4; i++) {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages,
      }),
    })

    if (!res.ok) return ''
    const data = await res.json() as AnthropicResponse

    if (data.stop_reason === 'end_turn') {
      return data.content.find(c => c.type === 'text')?.text ?? ''
    }

    if (data.stop_reason === 'tool_use') {
      messages.push({ role: 'assistant', content: data.content })
      // Server-side tools: Anthropic führt die Suche aus, wir bestätigen nur
      const toolResults = data.content
        .filter(c => c.type === 'tool_use')
        .map(c => ({
          type: 'tool_result' as const,
          tool_use_id: c.id!,
          content: '',
        }))
      if (toolResults.length) {
        messages.push({ role: 'user', content: toolResults })
      }
    }
  }

  return ''
}

async function findSuppliersOnline(gruppe: string, matNames: string[]): Promise<SuggestedSupplier[]> {
  try {
    const text = await callAnthropicWithWebSearch(
      `Suche im Internet nach 2-3 deutschen Händlern oder Großhändlern für folgende Materialien aus dem Bereich "${gruppe}":
${matNames.slice(0, 4).join(', ')}

Antworte NUR mit JSON (kein weiterer Text):
{"suppliers": [{"name": "Firmenname", "website": "https://...", "email": "email@firma.de oder null", "phone": "Telefon oder null"}]}`
    )

    if (!text) return []
    const cleaned = text.replace(/```json\n?|```/g, '').trim()
    const jsonStart = cleaned.indexOf('{')
    if (jsonStart === -1) return []
    const parsed = JSON.parse(cleaned.slice(jsonStart)) as { suppliers: Array<{ name: string; website: string | null; email: string | null; phone: string | null }> }
    return (parsed.suppliers ?? []).slice(0, 3).map(s => ({
      name: s.name ?? '',
      website: s.website ?? null,
      email: s.email ?? null,
      phone: s.phone ?? null,
      gruppe,
      materialien: matNames.slice(0, 3),
    })).filter(s => s.name)
  } catch {
    return []
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

    const { positionTitel, materials } = await req.json() as {
      positionTitel: string
      materials: ReqMaterial[]
    }

    if (!materials?.length) return NextResponse.json({ error: 'Keine Materialien übergeben' }, { status: 400 })

    // Plan laden (für Internetrecherche-Feature)
    const { data: profileData } = await supabase
      .from('betriebsprofil')
      .select('plan')
      .eq('user_id', user.id)
      .single()
    const userPlan = (profileData as { plan?: string } | null)?.plan ?? 'solo'

    // Materialgruppen für diesen User laden
    const { data: matGruppen } = await supabase
      .from('materialgruppen')
      .select('name')
      .eq('user_id', user.id)
      .eq('aktiv', true)
      .order('name')

    const gruppenNamen = (matGruppen ?? []).map(g => g.name)

    // Alle aktiven Supplier laden
    const { data: allSuppliers } = await supabase
      .from('suppliers')
      .select('id, company_name, general_email, ansprechpartner, phone, website, kategorien')
      .eq('user_id', user.id)
      .eq('aktiv', true)

    const suppliers = (allSuppliers ?? []) as SupplierRow[]

    // KI: Jedes Material einer Materialgruppe zuordnen
    let matGroupMap = new Map<number, string>()
    if (gruppenNamen.length && materials.length) {
      const catJson = await callAnthropic(
        `Ordne folgende Materialien den passenden Materialgruppen zu.
Gruppen: ${gruppenNamen.join(', ')}
Materialien:
${materials.map(m => `ID ${m.id}: "${m.bezeichnung}"`).join('\n')}
Antworte NUR mit JSON: { "results": [{ "id": <number>, "gruppe": "<gruppenname oder null>" }] }`, 600
      )
      try {
        const parsed = JSON.parse(catJson) as { results: { id: number; gruppe: string | null }[] }
        for (const r of parsed.results ?? []) {
          if (r.gruppe) matGroupMap.set(r.id, r.gruppe)
        }
      } catch { /* keine Kategorisierung */ }
    }

    // Materialien nach Gruppe gruppieren → passenden Supplier suchen
    const gruppeToMats = new Map<string, ReqMaterial[]>()
    const ungrouped: ReqMaterial[] = []

    for (const mat of materials) {
      const gruppe = matGroupMap.get(mat.id)
      if (gruppe) {
        const existing = gruppeToMats.get(gruppe) ?? []
        existing.push(mat)
        gruppeToMats.set(gruppe, existing)
      } else {
        ungrouped.push(mat)
      }
    }

    // Gruppen → Supplier matchen (suppliers.kategorien[] enthält Gruppe)
    const supplierMatsMap = new Map<string, { supplier: SupplierRow; mats: ReqMaterial[]; gruppen: string[] }>()
    const missing: { gruppe: string; mats: ReqMaterial[] }[] = []

    for (const [gruppe, mats] of gruppeToMats) {
      const matched = suppliers.filter(s => (s.kategorien ?? []).includes(gruppe))
      if (!matched.length) {
        missing.push({ gruppe, mats })
        continue
      }
      const supplier = matched[0]
      const existing = supplierMatsMap.get(supplier.id)
      if (existing) {
        existing.mats.push(...mats)
        if (!existing.gruppen.includes(gruppe)) existing.gruppen.push(gruppe)
      } else {
        supplierMatsMap.set(supplier.id, { supplier, mats: [...mats], gruppen: [gruppe] })
      }
    }

    // E-Mail-Entwürfe (als Text) erstellen
    const drafts: {
      supplierId: string
      supplierName: string
      email: string
      phone: string | null
      website: string | null
      subject: string
      body: string
      materialCount: number
    }[] = []

    for (const { supplier, mats } of supplierMatsMap.values()) {
      const toEmail = supplier.general_email
      if (!toEmail) continue

      const artikelListe = mats.map(m => `• ${m.bezeichnung}: ${m.menge} ${m.einheit}`).join('\n')
      const anrede = supplier.ansprechpartner
        ? `Guten Tag ${supplier.ansprechpartner},`
        : `Guten Tag,`

      const subject = `Materialanfrage – ${positionTitel}`
      const body = `${anrede}

wir benötigen für unser Projekt "${positionTitel}" folgende Materialien:

${artikelListe}

Bitte senden Sie uns ein Angebot mit Preisen und Lieferzeiten.

Mit freundlichen Grüßen`

      drafts.push({
        supplierId: supplier.id,
        supplierName: supplier.company_name,
        email: toEmail,
        phone: supplier.phone,
        website: supplier.website,
        subject,
        body,
        materialCount: mats.length,
      })
    }

    // Fehlende Gruppen (kein Supplier vorhanden)
    const missingGroups = missing.map(m => ({
      gruppe: m.gruppe,
      mats: m.mats.map(mat => `${mat.bezeichnung} (${mat.menge} ${mat.einheit})`),
    }))

    // Nicht kategorisierte Materialien
    const uncategorized = ungrouped.map(m => m.bezeichnung)

    // Internetrecherche — nur für Enterprise
    let suggestedSuppliers: SuggestedSupplier[] = []
    if (missing.length > 0 && userPlan === 'enterprise') {
      const searchResults = await Promise.all(
        missing.map(m => findSuppliersOnline(m.gruppe, m.mats.map(mat => mat.bezeichnung)))
      )
      suggestedSuppliers = searchResults.flat()
    }

    return NextResponse.json({ drafts, missingGroups, uncategorized, suggestedSuppliers })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unbekannter Fehler'
    console.error('[inquiry] unhandled error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
