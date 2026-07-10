'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Megaphone, X } from 'lucide-react'

type Announcement = {
  id: string
  message: string
  link_url: string | null
}

// 關閉是整條橫幅一起關；記最新一則的 id，之後發新公告（id 變了）橫幅會重新出現
const DISMISS_KEY = 'dismissed_announcement'
const ROTATE_MS = 10000

export function AnnouncementBanner() {
  const supabase = createClient()
  const [items, setItems] = useState<Announcement[]>([])
  const [index, setIndex] = useState(0)

  useEffect(() => {
    supabase
      .from('announcements')
      .select('id, message, link_url')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(3)
      .then(({ data }) => {
        if (data && data.length > 0 && localStorage.getItem(DISMISS_KEY) !== data[0].id) {
          setItems(data)
        }
      })
  }, [supabase])

  // 多則時每 5 秒輪換
  useEffect(() => {
    if (items.length < 2) return
    const timer = setInterval(() => {
      setIndex(prev => (prev + 1) % items.length)
    }, ROTATE_MS)
    return () => clearInterval(timer)
  }, [items.length])

  if (items.length === 0) return null

  const current = items[index]

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, items[0].id)
    setItems([])
  }

  const content = (
    <span className="flex items-center gap-2 min-w-0">
      <Megaphone size={16} className="shrink-0" />
      <span className="truncate">{current.message}</span>
    </span>
  )

  return (
    <div className="bg-banner text-white text-sm">
      <div className="max-w-6xl mx-auto px-4 py-2 flex items-center justify-between gap-3">
        {current.link_url ? (
          <Link href={current.link_url} className="hover:underline min-w-0">
            {content}
          </Link>
        ) : content}
        <span className="flex items-center gap-2 shrink-0">
          {items.length > 1 && (
            <span className="text-xs text-white/70 tabular-nums">{index + 1}/{items.length}</span>
          )}
          <button onClick={dismiss} aria-label="關閉公告" className="p-1 rounded hover:bg-white/15">
            <X size={16} />
          </button>
        </span>
      </div>
    </div>
  )
}
