import { createClient as createSupabaseClient } from '@supabase/supabase-js'

// service role client：繞過 RLS，只能在 server 端（API route）使用
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}
