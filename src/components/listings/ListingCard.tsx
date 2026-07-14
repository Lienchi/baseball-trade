'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { MessageCircle, MapPin, Tag, Star, Calendar } from 'lucide-react'
import { formatRelativeTime, formatDateWithWeekday, formatPrice, cn, listingThumbUrl } from '@/lib/utils'
import { getTeamColor, DEAL_METHOD_LABELS, INTENT_LABELS } from '@/types'
import type { Listing } from '@/types'

interface Props {
  listing: Listing
  /** 不顯示商品圖（首頁止血 Supabase egress 用），點進詳情才載圖 */
  hideImage?: boolean
}

export function ListingCard({ listing, hideImage = false }: Props) {
  const firstImage = listing.images?.[0]
  // 列表用 400px 縮圖省流量；縮圖不存在（補產前的舊圖）時 onError 退回原圖
  const [imgSrc, setImgSrc] = useState(firstImage ? listingThumbUrl(firstImage) : undefined)
  const team = getTeamColor(listing.team)

  return (
    <Link
      href={`/listings/${listing.id}`}
      prefetch={false}
      className="card group flex flex-col overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-scoreboard/5"
    >
      {/* 圖片區 */}
      {!hideImage && (
      <div className="relative aspect-[4/3] bg-dugout/10">
        {imgSrc ? (
          <Image
            src={imgSrc}
            alt={listing.title}
            fill
            onError={() => { if (firstImage && imgSrc !== firstImage) setImgSrc(firstImage) }}
            className="object-cover transition group-hover:scale-105"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-dugout/30">
            <Tag size={40} />
          </div>
        )}

        {/* 已售出 overlay */}
        {listing.status === 'sold' && (
          <div className="absolute inset-0 flex items-center justify-center bg-scoreboard/60">
            <span className="rounded-sm bg-clay px-4 py-1 text-sm font-display text-white">
              已售出
            </span>
          </div>
        )}
      </div>
      )}

      {/* 內容區 */}
      <div className="flex flex-1 flex-col p-3">
        {listing.team && (
          <span className={cn('mb-1 inline-flex w-fit items-center rounded-full px-2 py-0.5 text-[11px] font-bold', team.bg, team.textOnBg)}>
            {listing.team}
          </span>
        )}
        <p className="line-clamp-2 text-sm font-semibold text-scoreboard">
          <span className={cn(
            'mr-1.5 inline-block rounded-sm px-1 py-px align-text-bottom text-[11px] font-bold leading-tight',
            listing.intent === 'wanted' ? 'bg-gold/15 text-gold' : 'bg-field/10 text-field dark:bg-blue-400/15 dark:text-blue-400'
          )}>
            {INTENT_LABELS[listing.intent ?? 'sell']}
          </span>
          {listing.title}
        </p>

        {/* 品項清單：周邊用名稱、球票用日期＋座位（最多 3 筆，其餘收合），跟球票列表卡一致 */}
        {(listing.ticket_items?.length ?? 0) > 0 && (
          <ul className="mt-1.5 space-y-0.5">
            {listing.ticket_items.slice(0, 3).map((item, i) => (
              <li key={i} className="flex items-center gap-1.5 text-xs text-dugout">
                {item.name ? (
                  <span className="truncate font-medium text-scoreboard">{item.name}</span>
                ) : (
                  <>
                    <span className="flex flex-shrink-0 items-center gap-1 font-medium text-scoreboard">
                      <Calendar size={11} className="text-dugout/50" />
                      {item.date && formatDateWithWeekday(item.date)}
                    </span>
                    {item.seat && <span className="truncate">{item.seat}</span>}
                  </>
                )}
                {item.price != null && (
                  <span className="ml-auto flex-shrink-0 font-bold text-field dark:text-blue-400">
                    {formatPrice(item.price)}
                  </span>
                )}
              </li>
            ))}
            {listing.ticket_items.length > 3 && (
              <li className="text-xs text-dugout/60">還有 {listing.ticket_items.length - 3} 項…</li>
            )}
          </ul>
        )}

        {listing.deal_methods?.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {listing.deal_methods.map(m => (
              <span key={m} className="rounded-sm bg-field/10 px-1.5 py-0.5 text-[10px] font-medium text-field dark:bg-blue-400/15 dark:text-blue-400">
                {DEAL_METHOD_LABELS[m]}
              </span>
            ))}
          </div>
        )}

        {/* 底部資訊 */}
        <div className="mt-auto pt-2.5 text-xs text-dugout">
          {listing.profile && (
            <div className="mb-2 flex items-center gap-1.5">
              {listing.profile.avatar_url ? (
                <Image src={listing.profile.avatar_url} alt={listing.profile.username} width={16} height={16} unoptimized className="rounded-full object-cover flex-shrink-0" />
              ) : (
                <span className="h-4 w-4 flex-shrink-0 rounded-full bg-dugout/20 flex items-center justify-center text-[9px] font-bold text-dugout">
                  {listing.profile.username[0]?.toUpperCase()}
                </span>
              )}
              <span className="truncate">{listing.profile.username}</span>
              <Star size={10} className="text-gold fill-gold flex-shrink-0" />
              <span className="font-medium text-gold flex-shrink-0">
                {(listing.profile.rating_count ?? 0) > 0 ? Number(listing.profile.rating).toFixed(1) : '–'}
              </span>
              <span className="ml-auto flex items-center gap-0.5 flex-shrink-0">
                <MessageCircle size={11} />
                {listing.comment_count ?? 0}
              </span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1">
              {listing.location && (
                <>
                  <MapPin size={11} />
                  {listing.location}
                </>
              )}
            </span>
            <span>{formatRelativeTime(listing.created_at)}</span>
          </div>
        </div>
      </div>
    </Link>
  )
}
