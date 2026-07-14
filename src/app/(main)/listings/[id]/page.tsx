import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { formatDateWithWeekday, formatRelativeTime } from '@/lib/utils'
import { CommentSection } from '@/components/listings/CommentSection'
import { ListingGallery } from '@/components/listings/ListingGallery'
import { ContactSellerButton } from '@/components/listings/ContactSellerButton'
import { MarkSoldButton } from '@/components/listings/MarkSoldButton'
import { TicketItemsList } from '@/components/listings/TicketItemsList'
import { DeleteListingButton } from '@/components/listings/DeleteListingButton'
import { RemoveListingButton } from '@/components/listings/RemoveListingButton'
import { FavoriteButton } from '@/components/listings/FavoriteButton'
import { ReportListingButton } from '@/components/listings/ReportListingButton'
import Link from 'next/link'
import Image from 'next/image'
import { MapPin, Calendar, Package, Users, Clock, ShoppingBag } from 'lucide-react'
import { BackToListLink } from '@/components/listings/BackToListLink'
import { DEAL_METHOD_LABELS } from '@/types'
import type { Listing } from '@/types'

interface Props {
  params: { id: string }
}

// 同一次請求裡 generateMetadata 和 page 都要查 listing，用 cache() 去重
const getListing = cache(async (id: string) => {
  const supabase = createClient()
  const { data } = await supabase
    .from('listings')
    .select('*, profile:profiles!listings_user_id_fkey(username, avatar_url, rating, rating_count, deal_count)')
    .eq('id', id)
    .single()
  return data
})

export async function generateMetadata({ params }: Props) {
  const listing = await getListing(params.id)

  if (!listing) return { title: '找不到刊登' }

  const parts = [
    listing.status === 'sold' ? '已售出' : listing.price != null ? `NT$ ${listing.price.toLocaleString()}` : null,
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
  const supabase = createClient()

  // listing 與 auth 互不依賴，平行查詢減少 TTFB
  const [listing, { data: { user } }] = await Promise.all([
    getListing(params.id),
    supabase.auth.getUser(),
  ])

  if (!listing) notFound()

  const isOwner = user?.id === listing.user_id

  let isAdmin = false
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single()
    isAdmin = (profile as any)?.is_admin === true
  }

  const canManage = isOwner || isAdmin

  // 關注狀態（僅球票、非擁有者才需要）：item_id null = 關注整篇，有值 = 關注特定場次
  let isFavorited = false
  let favoritedItemIds: string[] = []
  if (user && !isOwner && listing.type === 'ticket') {
    const { data: favs } = await supabase
      .from('favorites')
      .select('item_id')
      .eq('user_id', user.id)
      .eq('listing_id', params.id)
    isFavorited = (favs ?? []).some(f => f.item_id === null)
    favoritedItemIds = (favs ?? [])
      .map(f => f.item_id as string | null)
      .filter((x): x is string => x !== null)
  }

  // 檢舉狀態：非擁有者且已登入才需要（RLS 只回自己的檢舉）
  let hasReported = false
  if (user && !isOwner) {
    const { data: myReport } = await supabase
      .from('reports')
      .select('id')
      .eq('listing_id', params.id)
      .eq('reporter_id', user.id)
      .maybeSingle()
    hasReported = !!myReport
  }

  // 瀏覽數：擁有者看自己不計。serverless 回應送出後 function 即凍結，
  // fire-and-forget 的請求可能根本沒送出，所以要 await（單一 RPC，延遲可忽略）
  if (!isOwner) {
    await supabase.rpc('increment_view_count', { listing_id: params.id })
  }

  const l = listing as Listing


  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <BackToListLink
        href={l.type === 'ticket' ? '/tickets' : '/merchandise'}
        label={l.type === 'ticket' ? '返回球票列表' : '返回周邊列表'}
      />
      {l.status === 'removed' && (
        <div className="mb-6 rounded-md border-2 border-clay/30 bg-clay/5 px-4 py-3 text-sm text-clay">
          <p className="font-bold">此刊登已由管理員下架</p>
          {l.removed_reason && <p className="mt-1">原因：{l.removed_reason}</p>}
        </div>
      )}
      {l.status === 'expired' && (
        <div className="mb-6 rounded-md border-2 border-dugout/20 bg-dugout/5 px-4 py-3 text-sm text-dugout">
          場次已全數結束，此刊登已自動下架
        </div>
      )}
      <div className="grid gap-8 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <ListingGallery images={l.images} title={l.title} />

          <div className="mt-6">
            <h1 className="font-display text-xl text-scoreboard">
              <span className={`mr-2 inline-block rounded-sm px-1.5 py-0.5 align-middle text-sm font-bold leading-tight ${
                l.intent === 'wanted' ? 'bg-gold/25 text-gold' : 'bg-field/10 text-field dark:bg-blue-400/15 dark:text-blue-400'
              }`}>
                {l.intent === 'wanted' ? '徵求' : '出售'}
              </span>
              {l.title}
            </h1>
            <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-dugout">
              {l.description}
            </p>
          </div>

          <CommentSection listingId={l.id} ownerId={l.user_id} viewerId={user?.id ?? null} />
        </div>

        <div className="lg:col-span-2">
          <div className="sticky top-20 card p-5">
            <ul className="space-y-2 text-sm text-dugout">
              {l.team && (
                <li className="flex items-center gap-2">
                  <Users size={14} className="text-dugout/50" />
                  {l.team}
                </li>
              )}
              {(l.ticket_items?.length ?? 0) > 0 ? (
                <li>
                  <div className="flex items-center gap-2">
                    {l.type === 'ticket'
                      ? <Calendar size={14} className="text-dugout/50" />
                      : <ShoppingBag size={14} className="text-dugout/50" />}
                    {l.type === 'ticket' ? '場次資訊' : '商品列表'}
                  </div>
                  <TicketItemsList
                    listingId={l.id}
                    items={l.ticket_items}
                    canManage={canManage}
                    type={l.type}
                    userId={user?.id ?? null}
                    favoritedItemIds={favoritedItemIds}
                  />
                </li>
              ) : l.game_date && (
                <li className="flex items-center gap-2">
                  <Calendar size={14} className="text-dugout/50" />
                  {formatDateWithWeekday(l.game_date)}
                </li>
              )}
              {l.location && (
                <li className="flex items-center gap-2">
                  <MapPin size={14} className="text-dugout/50" />
                  {l.location}
                </li>
              )}
              {l.deal_methods?.length > 0 && (
                <li className="flex items-center gap-2">
                  <Package size={14} className="text-dugout/50" />
                  {l.deal_methods.map(m => DEAL_METHOD_LABELS[m]).join('、')}
                </li>
              )}
              <li className="flex items-center gap-2 text-dugout/70">
                <Clock size={14} className="text-dugout/50" />
                {formatRelativeTime(l.created_at)}刊登
              </li>
            </ul>

            {l.profile && (
              <Link
                href={`/users/${l.user_id}`}
                className="mt-5 flex items-center gap-3 border-t border-scoreboard/10 pt-4 transition hover:opacity-80"
              >
                {l.profile.avatar_url ? (
                  <Image
                    src={l.profile.avatar_url}
                    alt={l.profile.username}
                    width={40}
                    height={40}
                    unoptimized
                    className="h-10 w-10 flex-shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-field text-sm font-bold text-white">
                    {l.profile.username.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div>
                  <p className="text-sm font-semibold text-scoreboard">{l.profile.username}</p>
                  <p className="flex items-center gap-2 text-xs text-dugout">
                    <span>
                      成交 <span className="font-bold text-scoreboard">{l.profile.deal_count ?? 0}</span> 次
                    </span>
                    <span className="flex items-center gap-0.5">
                      <span className="text-gold">⭐</span>
                      {(l.profile.rating_count ?? 0) > 0
                        ? `${Number(l.profile.rating).toFixed(1)}（${l.profile.rating_count}）`
                        : '尚無評價'}
                    </span>
                  </p>
                </div>
              </Link>
            )}

            {canManage ? (
              <div className="mt-4 space-y-2">
                {l.status === 'active' && <MarkSoldButton listingId={l.id} />}
                <Link
                  href={`/listings/${l.id}/edit`}
                  className="btn-secondary mt-2 flex w-full items-center justify-center"
                >
                  編輯刊登
                </Link>
                {/* 管理者：下架（記錄原因，作者看得到）優先於真刪；真刪留給垃圾內容 */}
                {isAdmin && !isOwner && <RemoveListingButton listingId={l.id} status={l.status} />}
                <DeleteListingButton listingId={l.id} isAdmin={isAdmin && !isOwner} />
              </div>
            ) : (
              <>
                <ContactSellerButton listingId={l.id} sellerId={l.user_id} />
                {l.type === 'ticket' && (
                  <FavoriteButton
                    listingId={l.id}
                    userId={user?.id ?? null}
                    initialFavorited={isFavorited}
                  />
                )}
                {user && (
                  <ReportListingButton listingId={l.id} initialReported={hasReported} />
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
