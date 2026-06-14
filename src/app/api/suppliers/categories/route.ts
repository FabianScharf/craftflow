import { NextResponse } from 'next/server'
import { getSupabaseClient } from '@/lib/supabase'

// GET /api/suppliers/categories
// Returns all product categories ordered by name.
export async function GET() {
  try {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('product_categories')
      .select('id, name')
      .order('name')
    if (error) throw error
    return NextResponse.json({ categories: data })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unbekannter Fehler'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
