'use client'

import { useSearchParams } from 'next/navigation'
import type { ReadonlyURLSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Ticket, Shirt } from 'lucide-react'
import { TicketListRow } from '@/components/listings/TicketListRow'
import { ListingCard } from '@/components/listings/ListingCard'
import { Pagination } from '@/components/listings/Pagination'
import { todayTaipei } from '@/lib/utils'
import type { Listing } from '@/types'

// 列表頁 ISR 化後的客端篩選：server 端一次給全部 active 刊登（快取一天），
// 篩選/排序/分頁全在瀏覽器做，URL 參數維持原樣（SortFilterBar 不用改）。
// 過期場次用「瀏覽器當下的台北日期」過濾，快取放一天也不會殘留昨日場次。

const PAGE_SIZE = 20

type ListingType = 'ticket' | 'merchandise'

function filterListings(
  listings: Listing[],
  type: ListingType,
  searchParams: ReadonlyURLSearchParams
): Listing[] {
  const today = todayTaipei()
  const yearEnd = `${today.slice(0, 4)}-12-31`
  const team = searchParams.get('team') ?? ''
  const intents = new Set((searchParams.get('intent') ?? '').split(',').filter(Boolean))
  const q = (searchParams.get('q') ?? '').trim().toLowerCase()
  const clampDate = (d: string | null) =>
    d ? (d < today ? today : d > yearEnd ? yearEnd : d) : ''
  const dateFrom = clampDate(searchParams.get('date_from'))
  const dateTo = clampDate(searchParams.get('date_to'))

  return listings.filter(l => {
    // 場次全數過期的刊登即時消失（比賽當天仍顯示）；周邊無場次概念
    if (type === 'ticket' && l.last_game_date && l.last_game_date < today) return false
    if (team && l.team !== team) return false
    if (intents.size && !intents.has(l.intent)) return false
    if (q && !l.title.toLowerCase().includes(q)) return false

    if (dateFrom || dateTo) {
      // 有場次日期就逐場比對（多場次刊登的中間空檔不會被區間重疊誤含），
      // 沒有就退回 game_date / last_game_date 區間判斷
      const itemDates = (l.ticket_items ?? [])
        .map(i => i.date)
        .filter((d): d is string => !!d)
      if (itemDates.length > 0) {
        const hit = itemDates.some(
          d => (!dateFrom || d >= dateFrom) && (!dateTo || d <= dateTo)
        )
        if (!hit) return false
      } else {
        if (dateFrom && l.last_game_date && l.last_game_date < dateFrom) return false
        if (dateTo && l.game_date && l.game_date > dateTo) return false
        if (!l.game_date && !l.last_game_date) return false
      }
    }
    return true
  })
}

interface Props {
  listings: Listing[]
  type: ListingType
  /** 分頁連結的基底路徑；首頁 tab 版傳 '/' 才不會跳去 /tickets、/merchandise */
  basePath?: string
}

export function FilteredListingList({ listings, type, basePath: basePathProp }: Props) {
  const searchParams = useSearchParams()

  let filtered = filterListings(listings, type, searchParams)

  if (searchParams.get('sort') === 'game_date_asc') {
    filtered = [...filtered].sort((a, b) => {
      if (!a.game_date) return 1
      if (!b.game_date) return -1
      return a.game_date.localeCompare(b.game_date)
    })
  }
  // 預設維持 server 給的 created_at desc 順序

  const currentPage = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1)
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const pageItems = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  const basePath = basePathProp ?? (type === 'ticket' ? '/tickets' : '/merchandise')
  const Icon = type === 'ticket' ? Ticket : Shirt
  const iconClass =
    type === 'ticket'
      ? 'bg-field/10 text-field dark:bg-blue-400/15 dark:text-blue-400'
      : 'bg-clay/10 text-clay dark:bg-blue-300/15 dark:text-blue-300'

  if (pageItems.length === 0) {
    return (
      <div className="mt-20 flex flex-col items-center text-center">
        <span className={`flex h-14 w-14 items-center justify-center rounded-full ${iconClass}`}>
          <Icon size={26} strokeWidth={2} />
        </span>
        <p className="mt-3 text-lg font-semibold text-scoreboard">
          {type === 'ticket' ? '目前沒有符合條件的球票' : '目前沒有符合條件的商品'}
        </p>
        <Link
          href={type === 'ticket' ? '/listings/new' : '/listings/new?type=merchandise'}
          className="btn-primary mt-5 inline-flex"
        >
          成為第一個刊登者
        </Link>
      </div>
    )
  }

  return (
    <>
      {type === 'ticket' ? (
        <div className="mt-6 space-y-2">
          {pageItems.map(listing => (
            <TicketListRow key={listing.id} listing={listing} />
          ))}
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-3">
          {pageItems.map(listing => (
            <ListingCard key={listing.id} listing={listing} />
          ))}
        </div>
      )}
      <Pagination currentPage={currentPage} totalPages={totalPages} basePath={basePath} />
    </>
  )
}

// hero 的「N 筆刊登中」照篩選結果變動，抽成小元件給 server 頁嵌入
export function FilteredListingCount({ listings, type }: Props) {
  const searchParams = useSearchParams()
  return <>{filterListings(listings, type, searchParams).length}</>
}
