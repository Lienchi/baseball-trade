'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { ListingDetail } from '@/components/listings/ListingDetail'
import type { Listing } from '@/types'

// ISR 頁面用匿名 client 查不到刊登時（已售出/下架/過期或根本不存在）的後備：
// 瀏覽器帶登入身分再查一次——RLS 允許擁有者與管理員讀非 active 的刊登，
// 查得到就照常渲染（含下架原因、編輯按鈕），查不到才顯示找不到。

export function ListingClientFallback({ listingId }: { listingId: string }) {
  const [listing, setListing] = useState<Listing | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    let cancelled = false
    supabase
      .from('listings')
      .select('*, profile:profiles!listings_user_id_fkey(username, avatar_url, rating, rating_count, deal_count)')
      .eq('id', listingId)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return
        setListing((data as Listing) ?? null)
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [listingId])

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 text-center text-sm text-dugout">
        載入中...
      </div>
    )
  }

  if (!listing) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 text-center">
        <p className="text-lg font-semibold text-scoreboard">找不到這則刊登</p>
        <p className="mt-1 text-sm text-dugout">可能已售出、下架或被刪除</p>
        <Link href="/" className="btn-primary mt-6 inline-flex">回到首頁</Link>
      </div>
    )
  }

  return <ListingDetail listing={listing} />
}
