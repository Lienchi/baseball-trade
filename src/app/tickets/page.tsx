import { createClient } from '@/lib/supabase/server'
import { TicketListRow } from '@/components/listings/TicketListRow'
import { TicketSortFilterBar } from '@/components/listings/TicketSortFilterBar'
import { Pagination } from '@/components/listings/Pagination'
import Link from 'next/link'
import { Ticket } from 'lucide-react'
import type { Listing } from '@/types'
import { todayTaipei } from '@/lib/utils'

export const metadata = {
  title: '球票專區',
  description: '中華職棒球票讓票、換票資訊，依球隊、場次快速找票',
}

const PAGE_SIZE = 20

// 列舉範圍內每一天（YYYY-MM-DD），供 overlaps 篩選；日期無效或範圍過大時回傳 null，
// 交由 game_date / last_game_date 的區間條件把關
const MAX_RANGE_DAYS = 400
function enumerateDates(from: string, to: string): string[] | null {
  const start = new Date(`${from}T00:00:00Z`)
  const end = new Date(`${to}T00:00:00Z`)
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) return null
  const days = (end.getTime() - start.getTime()) / 86400000 + 1
  if (days > MAX_RANGE_DAYS) return null
  const dates: string[] = []
  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    dates.push(d.toISOString().slice(0, 10))
  }
  return dates
}

interface SearchParams {
  page?: string
  team?: string
  q?: string
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

  // 搜尋日期夾限在「今天 ~ 今年年底」（與篩選列的 min/max 一致），
  // 手動改 URL 超出範圍時直接夾回，避免無意義的大範圍查詢
  const today = todayTaipei()
  const yearEnd = `${today.slice(0, 4)}-12-31`
  const clampDate = (d: string | undefined) =>
    d ? (d < today ? today : d > yearEnd ? yearEnd : d) : undefined
  const dateFrom = clampDate(searchParams.date_from)
  const dateTo = clampDate(searchParams.date_to)

  let query = supabase
    .from('listings')
    .select(`
      *,
      profile:profiles!listings_user_id_fkey(id, username, avatar_url, rating, rating_count, deal_count),
      comment_count:comments(count)
    `, { count: 'exact' })
    .eq('status', 'active')
    .eq('type', 'ticket')
    // 場次全數過期的刊登即時消失，不等半夜 pg_cron 標記 expired（比賽當天仍顯示）
    .or(`last_game_date.is.null,last_game_date.gte.${todayTaipei()}`)

  if (searchParams.team) query = query.eq('team', searchParams.team)
  if (searchParams.q) query = query.ilike('title', `%${searchParams.q}%`)
  // 日期範圍篩選：單邊條件用 game_date / last_game_date 即為精準判斷；
  // 兩邊都有時改檢查 ticket_items 的實際場次日期（game_dates computed column），
  // 避免多場次刊登（如 7/10、9/17）的中間空檔（8/1~8/5）被區間重疊誤含
  if (dateFrom) query = query.gte('last_game_date', dateFrom)
  if (dateTo) query = query.lte('game_date', dateTo)
  if (dateFrom && dateTo) {
    const dates = enumerateDates(dateFrom, dateTo)
    if (dates) query = query.overlaps('game_dates', dates)
  }

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
      </div>

      <TicketSortFilterBar />

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
