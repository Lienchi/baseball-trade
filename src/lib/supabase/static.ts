import { createClient as createSupabaseClient } from '@supabase/supabase-js'

// 不帶 cookie 的唯讀 client：給只查公開資料的靜態頁（如首頁 ISR）用。
// server.ts 的 client 會呼叫 cookies()，讓頁面被迫 dynamic rendering、revalidate 失效。
export function createStaticClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  )
}
