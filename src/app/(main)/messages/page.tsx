'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
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
  last_message: string | null
  last_message_at: string | null
  unread_count: number
}

const PAGE_SIZE = 10

export default function MessagesListPage() {
  const supabase = createClient()
  const [conversations, setConversations] = useState<ConversationRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const sentinelRef = useRef<HTMLDivElement>(null)
  // 用 ref 追蹤 offset / 載入狀態，讓 IntersectionObserver 的 callback 不用重綁
  const offsetRef = useRef(0)
  const busyRef = useRef(false)

  const loadPage = useCallback(async () => {
    if (busyRef.current) return
    busyRef.current = true

    const { data } = await supabase.rpc('get_my_conversations', {
      p_limit: PAGE_SIZE,
      p_offset: offsetRef.current,
    })
    const rows: ConversationRow[] = data ?? []

    setConversations(prev => {
      // 去重：新訊息進來可能讓對話跨頁重複出現
      const seen = new Set(prev.map(c => c.id))
      return [...prev, ...rows.filter(r => !seen.has(r.id))]
    })
    offsetRef.current += rows.length
    setHasMore(rows.length === PAGE_SIZE)

    busyRef.current = false
    setLoading(false)
    setLoadingMore(false)
  }, [supabase])

  useEffect(() => {
    loadPage()
  }, [loadPage])

  // 滑到底部 sentinel 時載入下一頁
  useEffect(() => {
    if (!hasMore || !sentinelRef.current) return
    const observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) {
        setLoadingMore(true)
        loadPage()
      }
    }, { rootMargin: '200px' })
    observer.observe(sentinelRef.current)
    return () => observer.disconnect()
  }, [hasMore, loadPage])

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <p className="text-sm text-dugout">載入中...</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="flex items-center gap-2 font-display text-xl text-scoreboard">
        <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-clay/10 text-clay">
          <MessageCircle size={18} strokeWidth={2} />
        </span>
        我的私訊
      </h1>

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
                  <p className="truncate text-xs text-clay dark:text-clay-light">關於：{conv.listing_title}</p>
                )}
                <p className="truncate text-xs text-dugout">
                  {conv.last_message ?? '尚無訊息'}
                </p>
              </div>
              {conv.unread_count > 0 && (
                <span className="flex h-5 min-w-5 flex-shrink-0 items-center justify-center rounded-full bg-clay px-1 text-[11px] font-bold text-white">
                  {conv.unread_count}
                </span>
              )}
            </Link>
          ))}

          {hasMore && (
            <div ref={sentinelRef} className="py-3 text-center text-xs text-dugout/60">
              {loadingMore ? '載入中...' : ''}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
