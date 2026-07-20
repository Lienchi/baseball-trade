import { Suspense } from 'react'
import { createStaticClient } from '@/lib/supabase/static'
import { MerchandiseSortFilterBar } from '@/components/listings/MerchandiseSortFilterBar'
import { FilteredListingList, FilteredListingCount } from '@/components/listings/FilteredListingList'
import { Shirt } from 'lucide-react'
import type { Listing } from '@/types'

export const metadata = {
  title: '周邊專區',
  description: '中華職棒周邊商品交易：球衣、應援毛巾、球員卡等球迷收藏',
}

// ISR 快取一天：刊登增刪改與售出/下架時由寫入點打 /api/revalidate 主動刷新。
// 篩選/排序/分頁全在客端做（FilteredListingList），server 不讀 searchParams 保持靜態。
export const revalidate = 86400

const MAX_LISTINGS = 500

export default async function MerchandisePage() {
  const supabase = createStaticClient()

  const { data: rawListings } = await supabase
    .from('listings')
    .select(`
      *,
      profile:profiles!listings_user_id_fkey(id, username, avatar_url, rating, rating_count, deal_count),
      comment_count:comments(count)
    `)
    .eq('status', 'active')
    .eq('type', 'merchandise')
    .order('created_at', { ascending: false })
    .limit(MAX_LISTINGS)

  const listings = (rawListings?.map(listing => ({
    ...listing,
    comment_count: Array.isArray(listing.comment_count)
      ? (listing.comment_count[0]?.count ?? 0)
      : 0,
  })) ?? []) as Listing[]

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between border-b-2 border-scoreboard/10 pb-6">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl text-scoreboard">
            <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-clay/10 text-clay dark:bg-blue-300/15 dark:text-blue-300">
              <Shirt size={18} strokeWidth={2} />
            </span>
            周邊商品
          </h1>
          <p className="mt-1 text-sm text-dugout">
            <Suspense fallback={<>{listings.length}</>}>
              <FilteredListingCount listings={listings} type="merchandise" />
            </Suspense>{' '}
            件周邊商品刊登中
          </p>
        </div>
      </div>

      <Suspense>
        <MerchandiseSortFilterBar />
        <FilteredListingList listings={listings} type="merchandise" />
      </Suspense>
    </div>
  )
}
