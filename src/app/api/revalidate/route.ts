import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

// ISR 主動刷新：寫入點（客端）在資料變動後 fire-and-forget 呼叫，
// pg_cron 過期排程也會在午夜打（Bearer CRON_SECRET）刷球票列表。
// 僅接受白名單路徑，revalidatePath 只作廢快取、不觸發重算，濫用風險低，
// 但仍要求登入或 cron secret，避免匿名者惡意打快取。

const STATIC_PATHS = new Set(['/', '/tickets', '/merchandise'])
const USER_PATH = /^\/users\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

export async function POST(request: Request) {
  let paths: unknown
  try {
    ({ paths } = await request.json())
  } catch {
    return NextResponse.json({ error: 'bad request' }, { status: 400 })
  }
  if (!Array.isArray(paths) || paths.length === 0 || paths.length > 5) {
    return NextResponse.json({ error: 'bad request' }, { status: 400 })
  }

  const cronSecret = process.env.CRON_SECRET
  const isCron = !!cronSecret && request.headers.get('authorization') === `Bearer ${cronSecret}`
  if (!isCron) {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const revalidated: string[] = []
  for (const p of paths) {
    if (typeof p !== 'string') continue
    if (STATIC_PATHS.has(p) || USER_PATH.test(p)) {
      revalidatePath(p)
      revalidated.push(p)
    }
  }
  return NextResponse.json({ revalidated })
}
