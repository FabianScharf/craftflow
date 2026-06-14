import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseClient } from '@/lib/supabase'

// GET /api/suppliers?category=<name>
// Returns all suppliers with their contacts.
// If ?category is given, only suppliers linked to that product_categories.name are returned.
export async function GET(req: NextRequest) {
  try {
    const category = req.nextUrl.searchParams.get('category')
    const supabase = getSupabaseClient()

    let supplierIds: string[] | null = null

    if (category) {
      const { data: cat, error: catErr } = await supabase
        .from('product_categories')
        .select('id')
        .eq('name', category)
        .single()

      if (catErr || !cat) {
        return NextResponse.json({ suppliers: [] })
      }

      const { data: links, error: linksErr } = await supabase
        .from('supplier_categories')
        .select('supplier_id')
        .eq('category_id', cat.id)

      if (linksErr) throw linksErr

      supplierIds = (links ?? []).map(l => l.supplier_id as string)
      if (supplierIds.length === 0) {
        return NextResponse.json({ suppliers: [] })
      }
    }

    let query = supabase
      .from('suppliers')
      .select(`
        id, company_name, street, zip, city, country,
        website, general_email, phone, notes,
        supplier_contacts(id, first_name, last_name, email, phone, mobile, position, is_primary)
      `)
      .order('company_name')

    if (supplierIds) {
      query = query.in('id', supplierIds)
    }

    const { data, error } = await query
    if (error) throw error

    return NextResponse.json({ suppliers: data })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unbekannter Fehler'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
