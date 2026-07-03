'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { formatRelativeTime } from '@/lib/utils'
import { MessageCircle } from 'lucide-react'

interface ConversationRow {
  id: string
  listing_id: string | null
  created_at: string
  buyer_confirmed_at: string | null
  seller_confirmed_at: string | null
  listing_title: string | null
  listing_images: string[] | null
  other_user_id: string
  other_username: string
  other_avatar_url: string | null
  last_message?: string
  last_message_at?: string
  unread_count?: number
}

export default function MessagesListPage() {
  const supabase = createClient()
  const [conversations, setConversations] = useState<ConversationRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }

      const { data: convos } = await supabase.rpc('get_my_conversations')
      if (!convos || convos.length === 0) { setLoading(false); return }

      const enriched = await Promise.all(
        convos.map(async (c: ConversationRow) => {
          const { data: lastMsg } = await supabase
            .from('messages')
            .select('content, created_at')
            .eq('conversation_id', c.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()

          const { count: unreadCount } = await supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('conversation_id', c.id)
            .eq('is_read', false)
            .neq('sender_id', user.id)

          return {
            ...c,
            last_message: lastMsg?.content,
            last_message_at: lastMsg?.created_at,
            unread_count: unreadCount ?? 0,
          }
        })
      )

      setConversations(enriched)
      setLoading(false)
    }
    load()
  }, [supabase])

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <p className="text-sm text-dugout">載入中...</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="font-display text-xl text-scoreboard">私訊</h1>

      {conversations.length === 0 ? (
        <div className="mt-16 flex flex-col items-center text-center">
          <MessageCircle size={40} className="text-dugout/30" />
          <p className="mt-3 text-sm text-dugout">還沒有任何對話</p>
          <p className="mt-1 text-xs text-dugout/70">逛逛貼文，點「聯絡賣家」開始第一則訊息</p>
        </div>
      ) : (
        <div className="mt-6 space-y-2">
          {conversations.map(conv => (
            <Link
              key={conv.id}
              href={`/messages/${conv.id}`}
              className="card flex items-center gap-3 p-3 transition hover:bg-dugout/5"
            >
              <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-field text-sm font-bold text-white">
                {conv.other_username?.slice(0, 2).toUpperCase() ?? '?'}
              </div>
              <div className="flex-1 overflow-hidden">
                <div className="flex items-center justify-between">
                  <p className="truncate text-sm font-semibold text-scoreboard">
                    {conv.other_username ?? '未知用戶'}
                  </p>
                  {conv.last_message_at && (
                    <span className="flex-shrink-0 text-xs text-dugout/60">
                      {formatRelativeTime(conv.last_message_at)}
                    </span>
                  )}
                </div>
                {conv.listing_title && (
                  <p className="truncate text-xs text-clay">關於：{conv.listing_title}</p>
                )}
                <p className="truncate text-xs text-dugout">
                  {conv.last_message ?? '尚無訊息'}
                </p>
              </div>
              {(conv.unread_count ?? 0) > 0 && (
                <span className="flex h-5 min-w-5 flex-shrink-0 items-center justify-center rounded-full bg-clay px-1 text-[11px] font-bold text-white">
                  {conv.unread_count}
                </span>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
