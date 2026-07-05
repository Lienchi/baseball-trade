import { createClient } from '@/lib/supabase/server'
import { ListingCard } from '@/components/listings/ListingCard'
import { MerchandiseSortFilterBar } from '@/components/listings/MerchandiseSortFilterBar'
import { Pagination } from '@/components/listings/Pagination'
import Link from 'next/link'
import { Shirt } from 'lucide-react'
import type { Listing } from '@/types'

const PAGE_SIZE = 20

interface SearchParams {
  page?: string
  team?: string
  q?: string
  sort?: string
}

export default async function MerchandisePage({
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
      profile:profiles!listings_user_id_fkey(id, username, avatar_url, rating_count),
      comment_count:comments(count)
    `, { count: 'exact' })
    .eq('status', 'active')
    .eq('type', 'merchandise')

  if (searchParams.team) query = query.eq('team', searchParams.team)
  if (searchParams.q) query = query.ilike('title', `%${searchParams.q}%`)

  query = query.order('created_at', { ascending: false })

  query = query.range(from, to)

  const { data: rawListings, count, error } = await query

  // 查詢失敗（如超出範圍的頁碼）要跟「真的沒資料」區分開
  if (error) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="mt-20 flex flex-col items-center text-center">
          <p className="text-lg font-semibold text-scoreboard">載入失敗</p>
          <p className="mt-1 text-sm text-dugout">請檢查篩選條件或稍後再試</p>
          <Link href="/merchandise" className="btn-primary mt-5 inline-flex">清除篩選重試</Link>
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
            {count ?? 0} 件周邊商品刊登中
          </p>
        </div>
        <Link href="/listings/new?type=merchandise" className="btn-primary">
          + 刊登商品
        </Link>
      </div>

      <MerchandiseSortFilterBar />

      {listings.length > 0 ? (
        <>
          <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-3">
            {listings.map(listing => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </div>
          <Pagination currentPage={currentPage} totalPages={totalPages} basePath="/merchandise" />
        </>
      ) : (
        <div className="mt-20 flex flex-col items-center text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-clay/10 text-clay dark:bg-blue-300/15 dark:text-blue-300">
            <Shirt size={26} strokeWidth={2} />
          </span>
          <p className="mt-3 text-lg font-semibold text-scoreboard">目前沒有符合條件的商品</p>
          <Link href="/listings/new?type=merchandise" className="btn-primary mt-5 inline-flex">
            成為第一個刊登者
          </Link>
        </div>
      )}
    </div>
  )
}
