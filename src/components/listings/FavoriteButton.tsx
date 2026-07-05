'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Heart } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  listingId: string
  userId: string | null       // 未登入為 null，點擊導向登入頁
  initialFavorited: boolean
}

export function FavoriteButton({ listingId, userId, initialFavorited }: Props) {
  const supabase = createClient()
  const router = useRouter()
  const [favorited, setFavorited] = useState(initialFavorited)
  const [loading, setLoading] = useState(false)

  const toggle = async () => {
    if (!userId) {
      router.push('/login')
      return
    }
    setLoading(true)
    if (favorited) {
      const { error } = await supabase
        .from('favorites')
        .delete()
        .eq('user_id', userId)
        .eq('listing_id', listingId)
      if (!error) setFavorited(false)
    } else {
      const { error } = await supabase
        .from('favorites')
        .insert({ user_id: userId, listing_id: listingId })
      if (!error) setFavorited(true)
    }
    setLoading(false)
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className={cn(
        'mt-2 flex w-full items-center justify-center gap-2 rounded-md border-2 px-5 py-2.5 text-sm font-bold transition disabled:opacity-40',
        favorited
          ? 'border-clay text-clay hover:border-dugout/20 hover:text-dugout'
          : 'border-dugout/20 text-dugout hover:border-clay hover:text-clay'
      )}
    >
      <Heart size={16} className={favorited ? 'fill-clay' : undefined} />
      {favorited ? '已關注' : '關注球票'}
    </button>
  )
}
