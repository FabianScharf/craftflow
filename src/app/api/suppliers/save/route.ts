import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseClient } from '@/lib/supabase'

// POST /api/suppliers/save
// Saves an AI-suggested supplier to the database and links it to a category.
// Body: { company_name: string, email: string, category_name: string }
export async function POST(req: NextRequest) {
  try {
    const { company_name, email, category_name } = await req.json() as {
      company_name: string
      email: string
      category_name: string
    }

    if (!company_name || !category_name) {
      return NextResponse.json(
        { error: 'company_name und category_name sind Pflichtfelder' },
        { status: 400 }
      )
    }

    const supabase = getSupabaseClient()

    // Find category
    const { data: cat, error: catErr } = await supabase
      .from('product_categories')
      .select('id')
      .eq('name', category_name)
      .single()

    if (catErr || !cat) {
      return NextResponse.json(
        { error: `Kategorie "${category_name}" nicht gefunden` },
        { status: 404 }
      )
    }

    // Create supplier
    const { data: supplier, error: supplierErr } = await supabase
      .from('suppliers')
      .insert({ company_name, general_email: email || null })
      .select('id')
      .single()

    if (supplierErr || !supplier) {
      return NextResponse.json(
        { error: 'Fehler beim Anlegen des Lieferanten' },
        { status: 500 }
      )
    }

    // Link supplier to category
    const { error: linkErr } = await supabase
      .from('supplier_categories')
      .insert({ supplier_id: supplier.id, category_id: cat.id })

    if (linkErr) {
      return NextResponse.json(
        { error: 'Fehler beim Verknüpfen mit Kategorie' },
        { status: 500 }
      )
    }

    return NextResponse.json({ supplierId: supplier.id })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unbekannter Fehler'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
