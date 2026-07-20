import { createStaticClient } from '@/lib/supabase/static'
import { notFound } from 'next/navigation'
import { ListingCard } from '@/components/listings/ListingCard'
import Image from 'next/image'
import { CalendarDays, Package, Handshake, MessageSquareQuote } from 'lucide-react'
import { formatDate, todayTaipei } from '@/lib/utils'
import { ReviewList } from '@/components/ReviewList'
import { SocialLinkRow } from '@/components/SocialLinkRow'
import { AdminSuspendControl } from '@/components/AdminSuspendControl'
import type { Listing, Profile } from '@/types'

// 個人頁只查公開資料（管理員停權鈕由 AdminSuspendControl 客端判斷）。
// ISR 快取一天：更新主要靠寫入點打 /api/revalidate 主動刷新
// （評價、成交、刊登增刪、個資編輯），revalidate 只是漏網時的安全網。
// 60 秒太短——小流量站重訪間隔幾乎都超過 60 秒，等於每次都觸發背景重算。
export const revalidate = 86400

// 空陣列＝build 不預產任何頁，但宣告此路由為靜態候選：
// 每個 user id 首次被訪問時渲染，之後照 revalidate 快取
export function generateStaticParams() {
  return []
}

interface Props {
  params: { id: string }
}

export async function generateMetadata({ params }: Props) {
  const supabase = createStaticClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('username')
    .eq('id', params.id)
    .single()

  if (!profile) return { title: '找不到用戶' }
  return {
    title: `${profile.username} 的刊登`,
    description: `查看 ${profile.username} 在本質球迷交易所的球票與周邊刊登`,
  }
}

export default async function UserProfilePage({ params }: Props) {
  const supabase = createStaticClient()

  // 個人資料與刊登互不依賴，平行查詢（評價由 ReviewList 客端分頁載入）
  const [{ data: profile }, { data: rawListings }] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, username, avatar_url, bio, social_links, rating, rating_count, deal_count, created_at, suspended_until, suspended_reason')
      .eq('id', params.id)
      .single(),
    supabase
      .from('listings')
      .select(`
        *,
        profile:profiles!listings_user_id_fkey(id, username, avatar_url, rating, rating_count, deal_count),
        comment_count:comments(count)
      `)
      .eq('user_id', params.id)
      .eq('status', 'active')
      // 球票場次全過期即時消失（周邊 last_game_date 為 null 不受影響）
      .or(`last_game_date.is.null,last_game_date.gte.${todayTaipei()}`)
      .order('created_at', { ascending: false }),
  ])

  if (!profile) notFound()
  const p = profile as Profile

  const listings = (rawListings?.map(listing => ({
    ...listing,
    comment_count: Array.isArray(listing.comment_count)
      ? (listing.comment_count[0]?.count ?? 0)
      : 0,
  })) ?? []) as Listing[]

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      {/* 個人資訊 */}
      <div className="flex items-start gap-4 border-b-2 border-scoreboard/10 pb-6">
        {p.avatar_url ? (
          <Image
            src={p.avatar_url}
            alt={p.username}
            width={96}
            height={96}
            unoptimized
            className="h-24 w-24 flex-shrink-0 rounded-full object-cover"
          />
        ) : (
          <div className="flex h-24 w-24 flex-shrink-0 items-center justify-center rounded-full bg-field text-2xl font-bold text-white">
            {p.username.slice(0, 2).toUpperCase()}
          </div>
        )}
        <div className="min-w-0">
          <h1 className="font-display text-2xl text-scoreboard">{p.username}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-dugout">
            <span className="flex items-center gap-1">
              <Handshake size={14} className="text-field" />
              成交
              <span className="font-bold text-scoreboard">{p.deal_count}</span>
              次
            </span>
            <span className="flex items-center gap-1">
              <span className="text-gold">⭐</span>
              {p.rating_count > 0 ? (
                <>
                  <span className="font-bold text-scoreboard">{Number(p.rating).toFixed(1)}</span>
                  （{p.rating_count} 則評價）
                </>
              ) : (
                '尚無評價'
              )}
            </span>
            <span className="flex items-center gap-1">
              <CalendarDays size={14} className="text-dugout/50" />
              {formatDate(p.created_at)} 加入
            </span>
          </p>
          <p className="mt-2 text-sm text-dugout">
            {p.bio || '這個人很神秘，還沒留下自我介紹'}
          </p>
          <SocialLinkRow socialLinks={p.social_links} />
          <AdminSuspendControl
            userId={p.id}
            suspendedUntil={p.suspended_until}
            suspendedReason={p.suspended_reason}
          />
        </div>
      </div>

      {/* 刊登中的商品 */}
      <h2 className="mt-6 flex items-center gap-2 font-display text-lg text-scoreboard">
        <Package size={18} className="text-field" />
        刊登中的商品（{listings.length}）
      </h2>

      {listings.length > 0 ? (
        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-3">
          {listings.map(listing => (
            <ListingCard key={listing.id} listing={listing} />
          ))}
        </div>
      ) : (
        <p className="mt-8 text-center text-sm text-dugout">目前沒有刊登中的商品</p>
      )}

      {/* 收到的評價 */}
      <h2 className="mt-8 flex items-center gap-2 font-display text-lg text-scoreboard">
        <MessageSquareQuote size={18} className="text-gold" />
        收到的評價（{p.rating_count}）
      </h2>

      <ReviewList revieweeId={p.id} />
    </div>
  )
}
