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
  const clientId = process.env.GMAIL_CLIENT_ID
  const clientSecret = process.env.GMAIL_CLIENT_SECRET
  const refreshToken = process.env.GMAIL_REFRESH_TOKEN
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('Gmail-Umgebungsvariablen fehlen (GMAIL_CLIENT_ID / GMAIL_CLIENT_SECRET / GMAIL_REFRESH_TOKEN)')
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
  if (!res.ok) {
    console.error('[inquiry] Groq HTTP error:', res.status, JSON.stringify(data))
    throw new Error(`Groq ${res.status}: ${(data as { error?: { message?: string } }).error?.message ?? 'unbekannter Fehler'}`)
  }
  const content = (data as { choices?: Array<{ message?: { content?: string } }> }).choices?.[0]?.message?.content
  if (!content) {
    console.error('[inquiry] Groq response has no content:', JSON.stringify(data))
    return ''
  }
  return content.replace(/```json\n?|```/g, '').trim()
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
  } catch (err) {
    console.error('[inquiry] Gmail draft creation failed for', toEmail, ':', err instanceof Error ? err.message : err)
    return null
  }
}

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

// When no categories exist in DB, ask Groq to suggest suppliers per material name.
async function aiSuggestDirect(materials: ReqMaterial[]): Promise<{ category: string; mats: string[]; aiName: string; aiEmail: string }[]> {
  const suggestJson = await callGroq(
    `Schlage für jede der folgenden Materialien einen deutschen B2B-Lieferanten im Schreiner/Tischlerbereich vor.
Materialien: ${materials.map(m => `"${m.bezeichnung}"`).join(', ')}
Antworte NUR mit JSON: { "results": [{ "material": "...", "name": "...", "email": "..." }] }`,
    600
  )
  let suggestData: { results: { material: string; name: string; email: string }[] }
  try {
    suggestData = JSON.parse(suggestJson)
  } catch {
    console.error('[inquiry] aiSuggestDirect: non-JSON from Groq:', suggestJson)
    suggestData = { results: [] }
  }
  return materials.map(m => {
    const s = (suggestData.results ?? []).find(r => r.material === m.bezeichnung)
    return {
      category: m.bezeichnung,
      mats: [`${m.bezeichnung} (${m.menge} ${m.einheit})`],
      aiName: s?.name ?? '',
      aiEmail: s?.email ?? '',
    }
  })
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

    // Diagnostics: log which Supabase project and key type is being used
    const supabaseUrl = process.env.SUPABASE_URL ?? ''
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
    console.log('[inquiry] SUPABASE_URL:', supabaseUrl.substring(0, 50) || 'MISSING')
    console.log('[inquiry] KEY_LENGTH:', supabaseKey.length)
    try {
      const payload = JSON.parse(Buffer.from(supabaseKey.split('.')[1] ?? '', 'base64').toString())
      console.log('[inquiry] KEY_ROLE:', payload.role ?? 'unknown')
    } catch { console.log('[inquiry] KEY_ROLE: JWT decode failed') }

    // 1. Load all product categories
    const { data: allCats, error: catsErr } = await supabase.from('product_categories').select('id, name')
    console.log('[inquiry] categories query: count=', allCats?.length ?? 'null', 'error=', catsErr?.message ?? 'none', 'code=', catsErr?.code ?? 'none')
    if (catsErr) {
      console.error('[inquiry] Supabase product_categories query failed:', catsErr.message)
    }
    const catNames = (allCats ?? []).map(c => c.name)

    // If no categories in DB: skip DB lookup entirely, go straight to AI suggestions.
    if (!catNames.length) {
      console.error('[inquiry] product_categories table is empty or blocked — falling back to direct AI suggestions')
      const suggestions = await aiSuggestDirect(materials)
      return NextResponse.json({
        drafts: [],
        suggestions,
        uncategorized: [],
      })
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

    let catData: { results: { id: number; category: string | null }[] }
    try {
      catData = JSON.parse(catJson)
    } catch {
      console.error('[inquiry] material categorization non-JSON from Groq:', catJson)
      return NextResponse.json(
        { error: 'KI-Kategorisierung fehlgeschlagen – bitte erneut versuchen.' },
        { status: 502 }
      )
    }

    const matCatMap = new Map(
      (catData.results ?? []).filter(r => r.category).map(r => [r.id, r.category!])
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

      const { data: links, error: linksErr } = await supabase
        .from('supplier_categories')
        .select('supplier_id')
        .eq('category_id', cat.id)
      if (linksErr) console.error('[inquiry] supplier_categories query error:', linksErr.message)

      const ids = (links ?? []).map(l => l.supplier_id as string)
      if (!ids.length) { missing.push({ category: catName, mats }); continue }

      const { data: suppliers, error: suppErr } = await supabase
        .from('suppliers')
        .select('id, company_name, general_email, supplier_contacts(first_name, last_name, email, is_primary)')
        .in('id', ids)
      if (suppErr) console.error('[inquiry] suppliers query error:', suppErr.message)

      if (!suppliers?.length) { missing.push({ category: catName, mats }); continue }

      const supplier = suppliers[0] as SupplierRow
      const existing = supplierGroups.get(supplier.id)
      if (existing) {
        existing.mats.push(...mats)
      } else {
        supplierGroups.set(supplier.id, { supplier, mats: [...mats] })
      }
    }

    // 4. Load default email template — degrade gracefully if missing
    const { data: tmpl, error: tmplErr } = await supabase
      .from('email_templates')
      .select('subject, body')
      .eq('is_default', true)
      .single()
    if (tmplErr || !tmpl) {
      console.error('[inquiry] email_templates: no is_default template found —', tmplErr?.message ?? 'null result')
    }

    // 5. Create one Gmail draft per supplier (skip if no template)
    const drafts: { supplierName: string; email: string; draftId: string | null; materialCount: number }[] = []

    if (tmpl) {
      for (const { supplier, mats } of supplierGroups.values()) {
        const contact =
          supplier.supplier_contacts?.find(c => c.is_primary) ??
          supplier.supplier_contacts?.[0] ??
          null
        const toEmail = contact?.email ?? supplier.general_email
        if (!toEmail) {
          console.error('[inquiry] no email for supplier', supplier.company_name, '— skipping draft')
          continue
        }

        const contactName = contact ? `${contact.first_name} ${contact.last_name}`.trim() : ''
        const artikelListe = mats.map(m => `• ${m.bezeichnung}: ${m.menge} ${m.einheit}`).join('\n')
        const vars: Record<string, string> = {
          lieferant_name: supplier.company_name,
          ansprechpartner: contactName,
          NACHNAME: contact?.last_name ?? '',
          ARTIKEL_LISTE: artikelListe,
          position: positionTitel,
        }

        const draftId = await createGmailDraft(
          toEmail, contactName,
          fill(tmpl.subject, vars),
          fill(tmpl.body, vars)
        )
        drafts.push({ supplierName: supplier.company_name, email: toEmail, draftId, materialCount: mats.length })
      }
    }

    // 6. AI suggestions for categories with no supplier in DB
    const suggestions: { category: string; mats: string[]; aiName: string; aiEmail: string }[] = []

    if (missing.length) {
      const suggestJson = await callGroq(
        `Schlage für jede folgende Produktkategorie einen deutschen B2B-Lieferanten im Schreiner/Tischlerbereich vor.
Kategorien: ${missing.map(m => m.category).join(', ')}
Antworte NUR mit JSON: { "results": [{ "category": "...", "name": "...", "email": "..." }] }`,
        400
      )
      let suggestData: { results: { category: string; name: string; email: string }[] }
      try {
        suggestData = JSON.parse(suggestJson)
      } catch {
        console.error('[inquiry] supplier suggestion non-JSON from Groq:', suggestJson)
        suggestData = { results: [] }
      }

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
