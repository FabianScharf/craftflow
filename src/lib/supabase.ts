import { createClient } from '@supabase/supabase-js'

export type Supplier = {
  id: string
  company_name: string
  street: string | null
  zip: string | null
  city: string | null
  country: string | null
  website: string | null
  general_email: string | null
  phone: string | null
  notes: string | null
  supplier_contacts?: SupplierContact[]
}

export type SupplierContact = {
  id: string
  supplier_id: string
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  mobile: string | null
  position: string | null
  is_primary: boolean
}

export type ProductCategory = {
  id: string
  name: string
  description: string | null
}

export type EmailTemplate = {
  id: string
  name: string
  subject: string
  body: string
  is_default: boolean
}

export function getSupabaseClient() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase-Konfiguration fehlt (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)')
  return createClient(url, key, {
    global: {
      headers: { apikey: key },
    },
  })
}
