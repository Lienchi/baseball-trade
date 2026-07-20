import { Suspense } from 'react'
import { createStaticClient } from '@/lib/supabase/static'
import { TicketSortFilterBar } from '@/components/listings/TicketSortFilterBar'
import { FilteredListingList, FilteredListingCount } from '@/components/listings/FilteredListingList'
import { Ticket } from 'lucide-react'
import type { Listing } from '@/types'

export const metadata = {
  title: '球票專區',
  description: '中華職棒球票讓票、換票資訊，依球隊、場次快速找票',
}

// ISR 快取一天：刊登增刪改與售出/下架時由寫入點打 /api/revalidate 主動刷新，
// pg_cron 過期排程也會在午夜打一次清掉過期場次的資料。
// 篩選/排序/分頁全在客端做（FilteredListingList），server 不讀 searchParams
// 才能保持靜態；過期場次由客端以瀏覽器當下日期過濾，快取殘留也不會顯示。
export const revalidate = 86400

const MAX_LISTINGS = 500

export default async function TicketsPage() {
  const supabase = createStaticClient()

  const { data: rawListings } = await supabase
    .from('listings')
    .select(`
      *,
      profile:profiles!listings_user_id_fkey(id, username, avatar_url, rating, rating_count, deal_count),
      comment_count:comments(count)
    `)
    .eq('status', 'active')
    .eq('type', 'ticket')
    .order('created_at', { ascending: false })
    .limit(MAX_LISTINGS)

  const listings = (rawListings?.map(listing => ({
    ...listing,
    comment_count: Array.isArray(listing.comment_count)
      ? (listing.comment_count[0]?.count ?? 0)
      : 0,
  })) ?? []) as Listing[]

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {/* Hero */}
      <div className="mb-6 flex items-center justify-between border-b-2 border-scoreboard/10 pb-6">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl text-scoreboard">
            <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-field/10 text-field dark:bg-blue-400/15 dark:text-blue-400">
              <Ticket size={18} strokeWidth={2} />
            </span>
            球票交易
          </h1>
          <p className="mt-1 text-sm text-dugout">
            <Suspense fallback={<>{listings.length}</>}>
              <FilteredListingCount listings={listings} type="ticket" />
            </Suspense>{' '}
            筆球票刊登中
          </p>
        </div>
      </div>

      <Suspense>
        <TicketSortFilterBar />
        <FilteredListingList listings={listings} type="ticket" />
      </Suspense>
    </div>
  )
}
