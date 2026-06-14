import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'
import { getSupabaseClient } from '@/lib/supabase'

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
  const auth = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET
  )
  auth.setCredentials({ refresh_token: process.env.GMAIL_REFRESH_TOKEN })
  return google.gmail({ version: 'v1', auth })
}

// Supports both {{variable}} and [VARIABLE] placeholder formats.
function fill(template: string, vars: Record<string, string>): string {
  return template
    .replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? `{{${k}}}`)
    .replace(/\[([A-Z_]+)\]/g, (_, k) => vars[k] ?? `[${k}]`)
}

async function callGroq(prompt: string, maxTokens = 600): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) throw new Error('GROQ_API_KEY fehlt')
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0,
      max_tokens: maxTokens,
    }),
  })
  const data = await res.json()
  return data.choices?.[0]?.message?.content?.replace(/```json\n?|```/g, '').trim() ?? ''
}

async function createGmailDraft(
  toEmail: string,
  toName: string,
  subject: string,
  body: string
): Promise<string | null> {
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
  } catch {
    return null
  }
}

// Groups materials by their assigned category.
function groupByCategory(
  matCatMap: Map<number, string>,
  materials: ReqMaterial[]
): Map<string, ReqMaterial[]> {
  const result = new Map<string, ReqMaterial[]>()
  for (const mat of materials) {
    const cat = matCatMap.get(mat.id)
    if (!cat) continue
    const existing = result.get(cat)
    if (existing) existing.push(mat)
    else result.set(cat, [mat])
  }
  return result
}

// POST /api/suppliers/inquiry
// Body: { positionTitel: string, materials: ReqMaterial[] }
// Returns: { drafts, suggestions, uncategorized }
export async function POST(req: NextRequest) {
  try {
    const { positionTitel, materials } = await req.json() as {
      positionTitel: string
      materials: ReqMaterial[]
    }

    if (!materials?.length) {
      return NextResponse.json({ error: 'Keine Materialien übergeben' }, { status: 400 })
    }

    const supabase = getSupabaseClient()

    // 1. Load all product categories
    const { data: allCats } = await supabase.from('product_categories').select('id, name')
    const catNames = (allCats ?? []).map(c => c.name)

    if (!catNames.length) {
      return NextResponse.json({ error: 'Keine Produktkategorien in der Datenbank' }, { status: 404 })
    }

    // 2. AI: categorize each material
    const catJson = await callGroq(
      `Ordne folgende Materialien den passenden Produktkategorien zu.
Verfügbare Kategorien: ${catNames.join(', ')}
Materialien:
${materials.map(m => `ID ${m.id}: "${m.bezeichnung}"`).join('\n')}
Antworte NUR mit gültigem JSON (keine Backticks):
{ "results": [{ "id": <number>, "category": "<kategorie oder null>" }] }`,
      700
    )

    const catData: { results: { id: number; category: string | null }[] } = JSON.parse(catJson)
    const matCatMap = new Map(
      catData.results.filter(r => r.category).map(r => [r.id, r.category!])
    )

    const uncategorized = materials
      .filter(m => !matCatMap.has(m.id))
      .map(m => m.bezeichnung)

    // 3. Group materials by category, then find suppliers
    const catGroups = groupByCategory(matCatMap, materials)
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
        .in('id', ids)

      if (!suppliers?.length) { missing.push({ category: catName, mats }); continue }

      // Group all materials for a supplier into one draft
      const supplier = suppliers[0] as SupplierRow
      const existing = supplierGroups.get(supplier.id)
      if (existing) {
        existing.mats.push(...mats)
      } else {
        supplierGroups.set(supplier.id, { supplier, mats: [...mats] })
      }
    }

    // 4. Load default email template
    const { data: tmpl, error: tmplErr } = await supabase
      .from('email_templates')
      .select('subject, body')
      .eq('is_default', true)
      .single()

    if (tmplErr || !tmpl) {
      return NextResponse.json({ error: 'Kein Standard-E-Mail-Template gefunden' }, { status: 404 })
    }

    // 5. Create one Gmail draft per supplier
    const drafts: {
      supplierName: string
      email: string
      draftId: string | null
      materialCount: number
    }[] = []

    for (const { supplier, mats } of supplierGroups.values()) {
      const contact =
        supplier.supplier_contacts?.find(c => c.is_primary) ??
        supplier.supplier_contacts?.[0] ??
        null
      const toEmail = contact?.email ?? supplier.general_email
      if (!toEmail) continue

      const contactName = contact
        ? `${contact.first_name} ${contact.last_name}`.trim()
        : ''
      const artikelListe = mats
        .map(m => `• ${m.bezeichnung}: ${m.menge} ${m.einheit}`)
        .join('\n')

      const vars: Record<string, string> = {
        lieferant_name: supplier.company_name,
        ansprechpartner: contactName,
        NACHNAME: contact?.last_name ?? '',
        ARTIKEL_LISTE: artikelListe,
        position: positionTitel,
      }

      const draftId = await createGmailDraft(
        toEmail,
        contactName,
        fill(tmpl.subject, vars),
        fill(tmpl.body, vars)
      )
      drafts.push({
        supplierName: supplier.company_name,
        email: toEmail,
        draftId,
        materialCount: mats.length,
      })
    }

    // 6. AI suggestions for categories with no supplier in DB
    const suggestions: {
      category: string
      mats: string[]
      aiName: string
      aiEmail: string
    }[] = []

    if (missing.length) {
      const suggestJson = await callGroq(
        `Schlage für jede folgende Produktkategorie einen deutschen B2B-Lieferanten im Schreiner/Tischlerbereich vor.
Kategorien: ${missing.map(m => m.category).join(', ')}
Antworte NUR mit JSON: { "results": [{ "category": "...", "name": "...", "email": "..." }] }`,
        400
      )
      const suggestData: {
        results: { category: string; name: string; email: string }[]
      } = JSON.parse(suggestJson)

      for (const m of missing) {
        const s = suggestData.results?.find(r => r.category === m.category)
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
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
