import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'
import { createClient } from '@/utils/supabase/server'

type ReqMaterial = { id: number; bezeichnung: string; menge: number; einheit: string }

type SupplierRow = {
  id: string
  company_name: string
  general_email: string | null
  supplier_contacts: Array<{
    first_name: string
    last_name: string
    email: string | null
    is_primary: boolean
  }>
}

function getGmailClient() {
  const clientId = process.env.GMAIL_CLIENT_ID
  const clientSecret = process.env.GMAIL_CLIENT_SECRET
  const refreshToken = process.env.GMAIL_REFRESH_TOKEN
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('Gmail-Umgebungsvariablen fehlen')
  }
  const auth = new google.auth.OAuth2(clientId, clientSecret)
  auth.setCredentials({ refresh_token: refreshToken })
  return google.gmail({ version: 'v1', auth })
}

function fill(template: string, vars: Record<string, string>): string {
  return template
    .replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? `{{${k}}}`)
    .replace(/\[([A-Z_]+)\]/g, (_, k) => vars[k] ?? `[${k}]`)
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
      model: 'claude-haiku-4-5',
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
    }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(`Claude ${res.status}: ${(data as { error?: { message?: string } }).error?.message ?? 'Fehler'}`)
  const content = (data as { content?: Array<{ text?: string }> }).content?.[0]?.text
  return (content ?? '').replace(/```json\n?|```/g, '').trim()
}

async function createGmailDraft(toEmail: string, toName: string, subject: string, body: string): Promise<string | null> {
  try {
    const toHeader = toName ? `"${toName}" <${toEmail}>` : toEmail
    const encodedSubject = `=?utf-8?B?${Buffer.from(subject).toString('base64')}?=`
    const raw = Buffer.from([
      `To: ${toHeader}`,
      `Subject: ${encodedSubject}`,
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset=utf-8',
      '',
      body,
    ].join('\r\n')).toString('base64url')
    const { data } = await getGmailClient().users.drafts.create({
      userId: 'me',
      requestBody: { message: { raw } },
    })
    return data.id ?? null
  } catch (err) {
    console.error('[inquiry] Gmail draft failed:', err instanceof Error ? err.message : err)
    return null
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

    // Nur eigene Kategorien
    const { data: allCats } = await supabase
      .from('product_categories')
      .select('id, name')
      .eq('user_id', user.id)

    const catNames = (allCats ?? []).map(c => c.name)

    if (!catNames.length) {
      const suggestions = await Promise.all(materials.map(async m => {
        const json = await callAnthropic(
          `Schlage für das Material "${m.bezeichnung}" einen deutschen B2B-Lieferanten im Schreinerbereich vor.
Antworte NUR mit JSON: { "name": "...", "email": "..." }`, 200
        )
        try {
          const s = JSON.parse(json)
          return { category: m.bezeichnung, mats: [`${m.bezeichnung} (${m.menge} ${m.einheit})`], aiName: s.name ?? '', aiEmail: s.email ?? '' }
        } catch {
          return { category: m.bezeichnung, mats: [`${m.bezeichnung} (${m.menge} ${m.einheit})`], aiName: '', aiEmail: '' }
        }
      }))
      return NextResponse.json({ drafts: [], suggestions, uncategorized: [] })
    }

    // KI: Materialien kategorisieren
    const catJson = await callAnthropic(
      `Ordne folgende Materialien den passenden Produktkategorien zu.
Kategorien: ${catNames.join(', ')}
Materialien:
${materials.map(m => `ID ${m.id}: "${m.bezeichnung}"`).join('\n')}
Antworte NUR mit JSON: { "results": [{ "id": <number>, "category": "<kategorie oder null>" }] }`, 700
    )

    let catData: { results: { id: number; category: string | null }[] }
    try { catData = JSON.parse(catJson) }
    catch { return NextResponse.json({ error: 'KI-Kategorisierung fehlgeschlagen' }, { status: 502 }) }

    const matCatMap = new Map(
      (catData.results ?? []).filter(r => r.category).map(r => [r.id, r.category!])
    )
    const uncategorized = materials.filter(m => !matCatMap.has(m.id)).map(m => m.bezeichnung)

    // Materialien nach Kategorie gruppieren → Lieferant suchen
    const catGroups = new Map<string, ReqMaterial[]>()
    for (const mat of materials) {
      const cat = matCatMap.get(mat.id)
      if (!cat) continue
      const existing = catGroups.get(cat)
      if (existing) existing.push(mat)
      else catGroups.set(cat, [mat])
    }

    const supplierGroups = new Map<string, { supplier: SupplierRow; mats: ReqMaterial[] }>()
    const missing: { category: string; mats: ReqMaterial[] }[] = []

    for (const [catName, mats] of catGroups) {
      const cat = (allCats ?? []).find(c => c.name === catName)
      if (!cat) { missing.push({ category: catName, mats }); continue }

      const { data: links } = await supabase
        .from('supplier_categories')
        .select('supplier_id')
        .eq('category_id', cat.id)

      const ids = (links ?? []).map(l => l.supplier_id as string)
      if (!ids.length) { missing.push({ category: catName, mats }); continue }

      const { data: suppliers } = await supabase
        .from('suppliers')
        .select('id, company_name, general_email, supplier_contacts(first_name, last_name, email, is_primary)')
        .eq('user_id', user.id)
        .in('id', ids)

      if (!suppliers?.length) { missing.push({ category: catName, mats }); continue }

      const supplier = suppliers[0] as SupplierRow
      const existing = supplierGroups.get(supplier.id)
      if (existing) existing.mats.push(...mats)
      else supplierGroups.set(supplier.id, { supplier, mats: [...mats] })
    }

    // E-Mail-Template laden (nur eigenes)
    const { data: tmpl } = await supabase
      .from('email_templates')
      .select('subject, body')
      .eq('is_default', true)
      .eq('user_id', user.id)
      .single()

    // Gmail-Drafts erstellen
    const drafts: { supplierName: string; email: string; draftId: string | null; materialCount: number }[] = []

    if (tmpl) {
      for (const { supplier, mats } of supplierGroups.values()) {
        const contact = supplier.supplier_contacts?.find(c => c.is_primary) ?? supplier.supplier_contacts?.[0] ?? null
        const toEmail = contact?.email ?? supplier.general_email
        if (!toEmail) continue

        const contactName = contact ? `${contact.first_name} ${contact.last_name}`.trim() : ''
        const artikelListe = mats.map(m => `• ${m.bezeichnung}: ${m.menge} ${m.einheit}`).join('\n')
        const vars: Record<string, string> = {
          lieferant_name: supplier.company_name,
          ansprechpartner: contactName,
          NACHNAME: contact?.last_name ?? '',
          ARTIKEL_LISTE: artikelListe,
          position: positionTitel,
        }

        const draftId = await createGmailDraft(toEmail, contactName, fill(tmpl.subject, vars), fill(tmpl.body, vars))
        drafts.push({ supplierName: supplier.company_name, email: toEmail, draftId, materialCount: mats.length })
      }
    }

    // KI-Vorschläge für fehlende Lieferanten
    const suggestions: { category: string; mats: string[]; aiName: string; aiEmail: string }[] = []
    if (missing.length) {
      const suggestJson = await callAnthropic(
        `Schlage für jede Produktkategorie einen deutschen B2B-Lieferanten im Schreinerbereich vor.
Kategorien: ${missing.map(m => m.category).join(', ')}
Antworte NUR mit JSON: { "results": [{ "category": "...", "name": "...", "email": "..." }] }`, 400
      )
      let suggestData: { results: { category: string; name: string; email: string }[] }
      try { suggestData = JSON.parse(suggestJson) }
      catch { suggestData = { results: [] } }

      for (const m of missing) {
        const s = (suggestData.results ?? []).find(r => r.category === m.category)
        suggestions.push({
          category: m.category,
          mats: m.mats.map(mat => `${mat.bezeichnung} (${mat.menge} ${mat.einheit})`),
          aiName: s?.name ?? '',
          aiEmail: s?.email ?? '',
        })
      }
    }

    return NextResponse.json({ drafts, suggestions, uncategorized })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unbekannter Fehler'
    console.error('[inquiry] unhandled error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
