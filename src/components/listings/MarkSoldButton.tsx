'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { revalidatePaths } from '@/lib/revalidate'

interface Props {
  listingId: string
  ownerId: string
  listingType: 'ticket' | 'merchandise'
}

export function MarkSoldButton({ listingId, ownerId, listingType }: Props) {
  const supabase = createClient()
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleMarkSold = async () => {
    if (!confirm('確定要將此刊登標記為已售出嗎？')) return
    setLoading(true)
    await supabase
      .from('listings')
      .update({ status: 'sold' })
      .eq('id', listingId)
    // 售出後詳情頁、個人頁、首頁、列表頁都要刷；await 完再 refresh 才拿得到新頁
    await revalidatePaths(`/listings/${listingId}`, `/users/${ownerId}`, '/', listingType === 'ticket' ? '/tickets' : '/merchandise')
    router.refresh()
    setLoading(false)
  }

  return (
    <button
      onClick={handleMarkSold}
      disabled={loading}
      className="mt-2 w-full rounded-md border-2 border-dugout/20 px-5 py-2.5 text-sm font-bold text-dugout transition hover:border-clay hover:text-clay disabled:opacity-40"
    >
      {loading ? '處理中...' : '標記為已售出'}
    </button>
  )
}
