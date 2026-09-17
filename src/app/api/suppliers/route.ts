import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { kontoIdFuer, kontoGesperrt } from '@/lib/kontoserver'
import { pruefeFunktion } from '@/lib/planpruefung'

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })
    const konto = await kontoIdFuer(supabase, user)
    const kontoSperre = kontoGesperrt(konto); if (kontoSperre) return kontoSperre
    const kontoId = konto.kontoId

    // Lieferantenverwaltung ist ab Starter (src/lib/plaene.ts) — geprueft wurde das
    // bisher nur in settings/suppliers und suppliers/inquiry* (Audit 2026-09-17, I3).
    const sperre = await pruefeFunktion(supabase, kontoId, 'lieferanten')
    if (sperre) return sperre

    const category = req.nextUrl.searchParams.get('category')
    let supplierIds: string[] | null = null

    if (category) {
      const { data: cat, error: catErr } = await supabase
        .from('product_categories')
        .select('id')
        .eq('user_id', kontoId)
        .eq('name', category)
        .single()

      if (catErr || !cat) return NextResponse.json({ suppliers: [] })

      const { data: links, error: linksErr } = await supabase
        .from('supplier_categories')
        .select('supplier_id')
        .eq('category_id', cat.id)

      if (linksErr) throw linksErr

      supplierIds = (links ?? []).map(l => l.supplier_id as string)
      if (supplierIds.length === 0) return NextResponse.json({ suppliers: [] })
    }

    let query = supabase
      .from('suppliers')
      .select(`
        id, company_name, street, zip, city, country,
        website, general_email, phone, notes,
        supplier_contacts(id, first_name, last_name, email, phone, mobile, position, is_primary)
      `)
      .eq('user_id', kontoId)
      .order('company_name')

    if (supplierIds) query = query.in('id', supplierIds)

    const { data, error } = await query
    if (error) throw error

    return NextResponse.json({ suppliers: data })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unbekannter Fehler'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
