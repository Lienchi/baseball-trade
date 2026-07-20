import { cache } from 'react'
import { createStaticClient } from '@/lib/supabase/static'
import { ListingDetail } from '@/components/listings/ListingDetail'
import { ListingClientFallback } from '@/components/listings/ListingClientFallback'
import type { Listing } from '@/types'

interface Props {
  params: { id: string }
}

// ISR 快取一天：頁面本體用匿名 client 渲染（RLS 只回 active 刊登），
// 寫入點（編輯/售出/下架/刪除/場次售出）打 /api/revalidate 主動刷新。
// 登入者相關狀態（擁有者按鈕、關注、檢舉、瀏覽數）由 ListingViewerProvider
// 在瀏覽器端直連 Supabase 補齊，不經過 Vercel function。
// 匿名查不到時交給 ListingClientFallback，讓擁有者/管理員仍能看非 active 刊登。
export const revalidate = 86400

// 空陣列＝build 不預產任何頁，但宣告此路由為靜態候選：
// 每個刊登首次被訪問時渲染，之後照 revalidate 快取
export function generateStaticParams() {
  return []
}

// 同一次請求裡 generateMetadata 和 page 都要查 listing，用 cache() 去重
const getListing = cache(async (id: string) => {
  const supabase = createStaticClient()
  const { data } = await supabase
    .from('listings')
    .select('*, profile:profiles!listings_user_id_fkey(username, avatar_url, rating, rating_count, deal_count)')
    .eq('id', id)
    .maybeSingle()
  return data
})

export async function generateMetadata({ params }: Props) {
  const listing = await getListing(params.id)

  if (!listing) return { title: '找不到刊登' }

  const parts = [
    listing.price != null ? `NT$ ${listing.price.toLocaleString()}` : null,
    listing.team,
    listing.location,
  ].filter(Boolean)
  const description = parts.length > 0 ? parts.join('・') : listing.description?.slice(0, 100)

  return {
    title: listing.title,
    description,
    openGraph: {
      title: listing.title,
      description,
      ...(listing.images?.[0] ? { images: [listing.images[0]] } : {}),
    },
  }
}

export default async function ListingDetailPage({ params }: Props) {
  const listing = await getListing(params.id)

  if (!listing) return <ListingClientFallback listingId={params.id} />

  return <ListingDetail listing={listing as Listing} />
}
