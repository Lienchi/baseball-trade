'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { formatRelativeTime } from '@/lib/utils'
import { MessageCircle } from 'lucide-react'
import type { Conversation } from '@/types'

export default function MessagesListPage() {
  const supabase = createClient()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }

      // 找出我參與的所有對話 ID
      const { data: participating } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', user.id)

      if (!participating || participating.length === 0) {
        setLoading(false)
        return
      }

      const conversationIds = participating.map(p => p.conversation_id)

      // 取得對話詳情 + 關聯的貼文 + 對話參與者
      const { data: convos } = await supabase
        .from('conversations')
        .select(`
          *,
          listing:listings(id, title, images),
          conversation_participants(user_id, profiles(id, username, avatar_url))
        `)
        .in('id', conversationIds)
        .order('created_at', { ascending: false })

      if (!convos) { setLoading(false); return }

      // 對每個對話取得最後一筆訊息 + 未讀數
      const enriched = await Promise.all(
        convos.map(async (c) => {
          const { data: lastMsg } = await supabase
            .from('messages')
            .select('*')
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

          // 找出對話另一方（排除自己）
          const otherParticipant = (c.conversation_participants as any[])
            ?.find((p) => p.user_id !== user.id)?.profiles

          return {
            ...c,
            last_message: lastMsg,
            unread_count: unreadCount ?? 0,
            participants: otherParticipant ? [otherParticipant] : [],
          }
        })
      )

      setConversations(enriched as Conversation[])
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
          {conversations.map(conv => {
            const other = conv.participants?.[0]
            return (
              <Link
                key={conv.id}
                href={`/messages/${conv.id}`}
                className="card flex items-center gap-3 p-3 transition hover:bg-dugout/5"
              >
                <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-field text-sm font-bold text-chalk">
                  {other?.username?.slice(0, 2).toUpperCase() ?? '?'}
                </div>
                <div className="flex-1 overflow-hidden">
                  <div className="flex items-center justify-between">
                    <p className="truncate text-sm font-semibold text-scoreboard">
                      {other?.username ?? '未知用戶'}
                    </p>
                    {conv.last_message && (
                      <span className="flex-shrink-0 text-xs text-dugout/60">
                        {formatRelativeTime(conv.last_message.created_at)}
                      </span>
                    )}
                  </div>
                  {conv.listing && (
                    <p className="truncate text-xs text-clay">關於：{conv.listing.title}</p>
                  )}
                  <p className="truncate text-xs text-dugout">
                    {conv.last_message?.content ?? '尚無訊息'}
                  </p>
                </div>
                {conv.unread_count! > 0 && (
                  <span className="flex h-5 min-w-5 flex-shrink-0 items-center justify-center rounded-full bg-clay px-1 text-[11px] font-bold text-chalk">
                    {conv.unread_count}
                  </span>
                )}
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
