import { Suspense } from 'react'
import { createStaticClient } from '@/lib/supabase/static'
import { ListingTabs } from '@/components/listings/ListingTabs'
import { MerchandiseSortFilterBar } from '@/components/listings/MerchandiseSortFilterBar'
import { FilteredListingList } from '@/components/listings/FilteredListingList'
import type { Listing } from '@/types'

export const metadata = {
  title: '周邊專區',
  description: '中華職棒周邊商品交易：球衣、應援毛巾、球員卡等球迷收藏',
  alternates: { canonical: '/merchandise' },
}

// ISR 快取一天：刊登增刪改與售出/下架時由寫入點打 /api/revalidate 主動刷新。
// 篩選/排序/分頁全在客端做（FilteredListingList），server 不讀 searchParams 保持靜態。
export const revalidate = 86400

const MAX_LISTINGS = 500

export default async function MerchandisePage() {
  const supabase = createStaticClient()

  const select =
    '*, profile:profiles!listings_user_id_fkey(id, username, avatar_url, rating, rating_count, deal_count), comment_count:comments(count)'

  const [merchRes, ticketCountRes] = await Promise.all([
    supabase
      .from('listings')
      .select(select)
      .eq('status', 'active')
      .eq('type', 'merchandise')
      .order('created_at', { ascending: false })
      .limit(MAX_LISTINGS),
    supabase
      .from('listings')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active')
      .eq('type', 'ticket'),
  ])

  const merchandise = (merchRes.data?.map(listing => ({
    ...listing,
    comment_count: Array.isArray(listing.comment_count)
      ? (listing.comment_count[0]?.count ?? 0)
      : 0,
  })) ?? []) as Listing[]

  return (
    <div className="mx-auto max-w-6xl px-4 pb-8 pt-3 sm:pt-8">
      <Suspense>
        <ListingTabs ticketCount={ticketCountRes.count ?? 0} merchCount={merchandise.length} />
        <MerchandiseSortFilterBar />
        <FilteredListingList listings={merchandise} type="merchandise" basePath="/merchandise" />
      </Suspense>
    </div>
  )
}
