import { Suspense } from 'react'
import { createStaticClient } from '@/lib/supabase/static'
import { ListingTabs } from '@/components/listings/ListingTabs'
import { TicketSortFilterBar } from '@/components/listings/TicketSortFilterBar'
import { FilteredListingList } from '@/components/listings/FilteredListingList'
import type { Listing } from '@/types'

export const metadata = {
  alternates: { canonical: '/' },
}

// ISR 快取一天：刊登增刪改與售出/下架時由寫入點打 /api/revalidate 主動刷新
export const revalidate = 86400

const MAX_LISTINGS = 500

export default async function HomePage() {
  const supabase = createStaticClient()

  // 只取列表卡片與客端篩選/排序實際會用到的欄位，避免把 description 等長欄位塞進
  // 500 筆的 ISR HTML（見 FilteredListingList / TicketListRow 用到的欄位）。
  const select =
    'id, title, type, status, intent, team, deal_methods, location, ticket_items, images, game_date, last_game_date, created_at, profile:profiles!listings_user_id_fkey(id, username, avatar_url, rating, rating_count), comment_count:comments(count)'

  const [ticketsRes, merchCountRes] = await Promise.all([
    supabase
      .from('listings')
      .select(select)
      .eq('status', 'active')
      .eq('type', 'ticket')
      .order('created_at', { ascending: false })
      .limit(MAX_LISTINGS),
    supabase
      .from('listings')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active')
      .eq('type', 'merchandise'),
  ])

  const tickets = (ticketsRes.data?.map(listing => ({
    ...listing,
    comment_count: Array.isArray(listing.comment_count)
      ? (listing.comment_count[0]?.count ?? 0)
      : 0,
  })) ?? []) as unknown as Listing[]

  return (
    <div className="mx-auto max-w-6xl px-4 pb-8 pt-3 sm:pt-8">
      <Suspense>
        <ListingTabs ticketCount={tickets.length} merchCount={merchCountRes.count ?? 0} />
        <TicketSortFilterBar />
        <FilteredListingList listings={tickets} type="ticket" basePath="/" />
      </Suspense>
    </div>
  )
}
