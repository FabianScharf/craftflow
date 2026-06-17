import { NextResponse } from 'next/server'
import { getSupabaseClient } from '@/lib/supabase'

// Temporary diagnostic endpoint — remove after Supabase issue is resolved
export async function GET() {
  const url = process.env.SUPABASE_URL ?? ''
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''

  let keyRole = 'decode-failed'
  try {
    const payload = JSON.parse(Buffer.from(key.split('.')[1] ?? '', 'base64').toString())
    keyRole = payload.role ?? 'no-role-claim'
  } catch { /* ignore */ }

  const supabase = getSupabaseClient()
  const { data, error } = await supabase.from('product_categories').select('id, name')

  return NextResponse.json({
    supabase_url_prefix: url.substring(0, 50),
    key_length: key.length,
    key_role: keyRole,
    categories_count: data?.length ?? null,
    categories_error_message: error?.message ?? null,
    categories_error_code: error?.code ?? null,
    categories_sample: (data ?? []).slice(0, 3).map(c => c.name),
  })
}
