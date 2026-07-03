import { createClient } from '@/lib/supabase/server'
import { TicketListRow } from '@/components/listings/TicketListRow'
import { TicketSortFilterBar } from '@/components/listings/TicketSortFilterBar'
import { Pagination } from '@/components/listings/Pagination'
import Link from 'next/link'
import { Ticket } from 'lucide-react'
import type { Listing } from '@/types'

const PAGE_SIZE = 20

interface SearchParams {
  page?: string
  team?: string
  q?: string
  deal_method?: string
  sort?: string
  date_from?: string
  date_to?: string
}

export default async function TicketsPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const supabase = createClient()
  const currentPage = Math.max(1, parseInt(searchParams.page ?? '1', 10) || 1)
  const from = (currentPage - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  let query = supabase
    .from('listings')
    .select(`
      *,
      profile:profiles(id, username, avatar_url, rating_count),
      comment_count:comments(count)
    `, { count: 'exact' })
    .eq('status', 'active')
    .eq('type', 'ticket')

  if (searchParams.team) query = query.eq('team', searchParams.team)
  if (searchParams.q) query = query.ilike('title', `%${searchParams.q}%`)
  if (searchParams.deal_method) {
    query = query.contains('deal_methods', [searchParams.deal_method])
  }
  // 場次日期範圍 [game_date, last_game_date] 與篩選範圍重疊即符合，
  // 避免多場次刊登因「最早場次在範圍外」被漏掉
  if (searchParams.date_from) query = query.gte('last_game_date', searchParams.date_from)
  if (searchParams.date_to) query = query.lte('game_date', searchParams.date_to)

  // 排序
  switch (searchParams.sort) {
    case 'game_date_asc':
      query = query.order('game_date', { ascending: true, nullsFirst: false })
      break
    default:
      query = query.order('created_at', { ascending: false })
  }

  query = query.range(from, to)

  const { data: rawListings, count, error } = await query

  // 查詢失敗（如亂填的日期參數、超出範圍的頁碼）要跟「真的沒資料」區分開
  if (error) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="mt-20 flex flex-col items-center text-center">
          <p className="text-lg font-semibold text-scoreboard">載入失敗</p>
          <p className="mt-1 text-sm text-dugout">請檢查篩選條件或稍後再試</p>
          <Link href="/tickets" className="btn-primary mt-5 inline-flex">清除篩選重試</Link>
        </div>
      </div>
    )
  }

  const listings = (rawListings?.map(listing => ({
    ...listing,
    comment_count: Array.isArray(listing.comment_count)
      ? (listing.comment_count[0]?.count ?? 0)
      : 0,
  })) ?? []) as Listing[]

  const totalPages = Math.ceil((count ?? 0) / PAGE_SIZE)

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
            {count ?? 0} 筆球票刊登中
          </p>
        </div>
        <Link href="/listings/new" className="btn-primary">
          + 刊登球票
        </Link>
      </div>

      <TicketSortFilterBar showGameDateSort />

      {listings.length > 0 ? (
        <>
          <div className="mt-6 space-y-2">
            {listings.map(listing => (
              <TicketListRow key={listing.id} listing={listing} />
            ))}
          </div>
          <Pagination currentPage={currentPage} totalPages={totalPages} basePath="/tickets" />
        </>
      ) : (
        <div className="mt-20 flex flex-col items-center text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-field/10 text-field dark:bg-blue-400/15 dark:text-blue-400">
            <Ticket size={26} strokeWidth={2} />
          </span>
          <p className="mt-3 text-lg font-semibold text-scoreboard">目前沒有符合條件的球票</p>
          <Link href="/listings/new" className="btn-primary mt-5 inline-flex">
            成為第一個刊登者
          </Link>
        </div>
      )}
    </div>
  )
}
