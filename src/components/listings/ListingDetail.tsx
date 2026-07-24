'use client'

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
import { ListingViewerProvider, useListingViewer } from '@/components/listings/ListingViewer'
import Link from 'next/link'
import Image from 'next/image'
import { MapPin, Calendar, Package, Users, Clock, ShoppingBag } from 'lucide-react'
import { BackToListLink } from '@/components/listings/BackToListLink'
import { DEAL_METHOD_LABELS } from '@/types'
import type { Listing } from '@/types'

// 刊登詳情本體：頁面走 ISR 匿名快取，登入者相關狀態由 ListingViewerProvider
// 在瀏覽器端補齊。ready 前先渲染訪客視角（絕大多數流量），ready 後
// 用 key 重掛 auth 相關元件，讓 initial props 換成真實狀態。

export function ListingDetail({ listing }: { listing: Listing }) {
  return (
    <ListingViewerProvider listingId={listing.id} ownerId={listing.user_id} listingType={listing.type}>
      <ListingDetailInner listing={listing} />
    </ListingViewerProvider>
  )
}

function ListingDetailInner({ listing: l }: { listing: Listing }) {
  const viewer = useListingViewer()
  const { ready, userId, isOwner, isAdmin, canManage } = viewer

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <BackToListLink
        href={l.type === 'ticket' ? '/' : '/merchandise'}
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
              <span className={`mr-2 inline-block rounded-full border px-2.5 py-0.5 align-middle text-sm font-bold leading-tight ${
                l.intent === 'wanted'
                  ? 'border-[#FAC775] bg-[#FAEEDA] text-[#854F0B]'
                  : 'border-[#85B7EB] bg-[#E6F1FB] text-[#0C447C]'
              }`}>
                {l.intent === 'wanted' ? '徵求' : '出售'}
              </span>
              {l.title}
            </h1>
            <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-dugout">
              {l.description}
            </p>
          </div>

          <CommentSection listingId={l.id} ownerId={l.user_id} viewerId={userId} />
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
                    key={`items-${ready}`}
                    listingId={l.id}
                    items={l.ticket_items}
                    canManage={canManage}
                    type={l.type}
                    userId={userId}
                    favoritedItemIds={viewer.favoritedItemIds}
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
                {l.status === 'active' && <MarkSoldButton listingId={l.id} ownerId={l.user_id} listingType={l.type} />}
                <Link
                  href={`/listings/${l.id}/edit`}
                  className="btn-secondary mt-2 flex w-full items-center justify-center"
                >
                  編輯刊登
                </Link>
                {/* 管理者：下架（記錄原因，作者看得到）優先於真刪；真刪留給垃圾內容 */}
                {isAdmin && !isOwner && <RemoveListingButton listingId={l.id} ownerId={l.user_id} listingType={l.type} status={l.status} />}
                <DeleteListingButton listingId={l.id} ownerId={l.user_id} listingType={l.type} isAdmin={isAdmin && !isOwner} />
              </div>
            ) : (
              <>
                <ContactSellerButton listingId={l.id} sellerId={l.user_id} />
                {l.type === 'ticket' && (
                  <FavoriteButton
                    key={`fav-${ready}`}
                    listingId={l.id}
                    userId={userId}
                    initialFavorited={viewer.isFavorited}
                  />
                )}
                {userId && (
                  <ReportListingButton
                    key={`report-${ready}`}
                    listingId={l.id}
                    initialReported={viewer.hasReported}
                  />
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
