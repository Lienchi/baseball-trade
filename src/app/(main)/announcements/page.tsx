import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Megaphone, ExternalLink } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '網站公告',
  description: '本質球迷交易所的最新功能與全站訊息',
}

// 公告歷史頁：RLS 只開放 is_active 的公告，下架的自然不會出現
export default async function AnnouncementsPage() {
  const supabase = createClient()
  const { data: announcements } = await supabase
    .from('announcements')
    .select('id, message, link_url, created_at')
    .order('created_at', { ascending: false })

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="flex items-center gap-2 font-display text-xl text-scoreboard">
        <Megaphone size={22} /> 網站公告
      </h1>
      <p className="mt-1 text-sm text-dugout">新功能與全站訊息都會發佈在這裡</p>

      <ul className="mt-6 space-y-3">
        {(announcements ?? []).map(item => (
          <li key={item.id} className="card p-4">
            <p className="text-xs text-dugout">{formatDate(item.created_at)}</p>
            <p className="mt-1 text-sm text-scoreboard break-words">{item.message}</p>
            {item.link_url && (
              <Link
                href={item.link_url}
                className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-clay hover:underline"
              >
                查看詳情 <ExternalLink size={13} />
              </Link>
            )}
          </li>
        ))}
        {(announcements ?? []).length === 0 && (
          <li className="py-10 text-center text-sm text-dugout">目前沒有公告</li>
        )}
      </ul>
    </div>
  )
}
