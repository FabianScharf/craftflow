import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

    const category = req.nextUrl.searchParams.get('category')
    let supplierIds: string[] | null = null

    if (category) {
      const { data: cat, error: catErr } = await supabase
        .from('product_categories')
        .select('id')
        .eq('user_id', user.id)
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
      .eq('user_id', user.id)
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
