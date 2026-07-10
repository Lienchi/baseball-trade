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

const DISMISS_KEY = 'dismissed_announcement'

export function AnnouncementBanner() {
  const supabase = createClient()
  const [announcement, setAnnouncement] = useState<Announcement | null>(null)

  useEffect(() => {
    supabase
      .from('announcements')
      .select('id, message, link_url')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data && localStorage.getItem(DISMISS_KEY) !== data.id) {
          setAnnouncement(data)
        }
      })
  }, [supabase])

  if (!announcement) return null

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, announcement.id)
    setAnnouncement(null)
  }

  const content = (
    <span className="flex items-center gap-2 min-w-0">
      <Megaphone size={16} className="shrink-0" />
      <span className="truncate">{announcement.message}</span>
    </span>
  )

  return (
    <div className="bg-banner text-white text-sm">
      <div className="max-w-6xl mx-auto px-4 py-2 flex items-center justify-between gap-3">
        {announcement.link_url ? (
          <Link href={announcement.link_url} className="hover:underline min-w-0">
            {content}
          </Link>
        ) : content}
        <button onClick={dismiss} aria-label="關閉公告" className="shrink-0 p-1 rounded hover:bg-white/15">
          <X size={16} />
        </button>
      </div>
    </div>
  )
}
