import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { kontoIdFuer, kontoGesperrt } from '@/lib/kontoserver'
import { pruefeFunktion } from '@/lib/planpruefung'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })
    const konto = await kontoIdFuer(supabase, user)
    const kontoSperre = kontoGesperrt(konto); if (kontoSperre) return kontoSperre
    const kontoId = konto.kontoId

    // Lieferantenverwaltung ist ab Starter (Audit 2026-09-17, I3).
    const sperre = await pruefeFunktion(supabase, kontoId, 'lieferanten')
    if (sperre) return sperre

    const { company_name, email, category_name } = await req.json() as {
      company_name: string; email: string; category_name: string
    }

    if (!company_name || !category_name) {
      return NextResponse.json({ error: 'company_name und category_name sind Pflichtfelder' }, { status: 400 })
    }

    let catId: string

    const { data: cat } = await supabase
      .from('product_categories')
      .select('id')
      .eq('user_id', kontoId)
      .eq('name', category_name)
      .single()

    if (!cat) {
      const { data: newCat, error: newCatErr } = await supabase
        .from('product_categories')
        .insert({ user_id: kontoId, name: category_name })
        .select('id')
        .single()
      if (newCatErr || !newCat) return NextResponse.json({ error: 'Kategorie konnte nicht angelegt werden' }, { status: 500 })
      catId = newCat.id
    } else {
      catId = cat.id
    }

    const { data: supplier, error: supplierErr } = await supabase
      .from('suppliers')
      .insert({ user_id: kontoId, company_name, general_email: email || null })
      .select('id')
      .single()

    if (supplierErr || !supplier) return NextResponse.json({ error: 'Fehler beim Anlegen des Lieferanten' }, { status: 500 })

    const { error: linkErr } = await supabase
      .from('supplier_categories')
      .insert({ supplier_id: supplier.id, category_id: catId })

    if (linkErr) return NextResponse.json({ error: 'Fehler beim Verknüpfen mit Kategorie' }, { status: 500 })

    return NextResponse.json({ supplierId: supplier.id })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unbekannter Fehler'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
