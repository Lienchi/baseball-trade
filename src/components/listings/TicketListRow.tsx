'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Calendar, MessageCircle, Star } from 'lucide-react'
import { formatDateWithWeekday, formatPrice, formatRelativeTime, cn } from '@/lib/utils'
import { getTeamColor } from '@/types'
import type { Listing } from '@/types'

interface Props {
  listing: Listing
}

export function TicketListRow({ listing }: Props) {
  const team = getTeamColor(listing.team)
  // 已標記售出的單場不顯示在卡片上（整張刊登售出另有 status === 'sold' 標籤）
  const visibleItems = listing.ticket_items?.filter(item => !item.sold) ?? []

  return (
    <Link
      href={`/listings/${listing.id}`}
      prefetch={false}
      className={cn(
        'card group flex items-center gap-4 border-l-4 px-4 py-2 transition-all hover:shadow-md',
        team.border
      )}
    >
      {/* 球隊色塊：用隊名縮寫取代棒球 icon */}
      <div className={cn(
        'flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-md text-sm font-bold leading-none',
        team.bg,
        team.textOnBg
      )}>
        {listing.team ? listing.team.slice(0, 2) : '⚾'}
      </div>

      {/* 主要資訊 */}
      <div className="flex-1 overflow-hidden">
        {listing.status === 'sold' && (
          <span className="badge mb-1 bg-clay/10 text-clay-dark">已售出</span>
        )}
        <p className="truncate text-sm font-semibold text-scoreboard">
          <span className={cn(
            'mr-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full border align-middle text-sm font-bold leading-none',
            listing.intent === 'wanted'
              ? 'border-[#FAC775] bg-[#FAEEDA] text-[#854F0B]'
              : 'border-[#85B7EB] bg-[#E6F1FB] text-[#0C447C]'
          )}>
            {listing.intent === 'wanted' ? '徵' : '售'}
          </span>
          {listing.title}
        </p>
        {/* 場次清單：日期 + 座位（最多 3 筆，其餘收合） */}
        {visibleItems.length > 0 && (
          <ul className="mt-1.5 space-y-0.5">
            {visibleItems.slice(0, 3).map((item, i) => (
              <li key={i} className="flex items-center gap-2 text-xs text-dugout">
                <span className="flex flex-shrink-0 items-center gap-1 font-medium text-scoreboard">
                  <Calendar size={11} className="text-dugout/50" />
                  {formatDateWithWeekday(item.date!)}
                </span>
                {item.seat && <span className="truncate">{item.seat}</span>}
                {item.price != null && (
                  <span className="flex-shrink-0 font-bold text-field dark:text-blue-400">
                    {formatPrice(item.price)}
                  </span>
                )}
              </li>
            ))}
            {visibleItems.length > 3 && (
              <li className="text-xs text-dugout/60">還有 {visibleItems.length - 3} 場…</li>
            )}
          </ul>
        )}
        {/* 刊登者 + 星等 + 留言數 */}
        <div className="mt-1 flex items-center gap-3 text-xs text-dugout">
          {listing.profile && (
            <span className="flex items-center gap-1.5 overflow-hidden">
              {listing.profile.avatar_url ? (
                <Image src={listing.profile.avatar_url} alt={listing.profile.username} width={14} height={14} unoptimized className="rounded-full object-cover flex-shrink-0" />
              ) : (
                <span className="h-3.5 w-3.5 flex-shrink-0 rounded-full bg-dugout/20 flex items-center justify-center text-[8px] font-bold text-dugout">
                  {listing.profile.username[0]?.toUpperCase()}
                </span>
              )}
              <span className="truncate">{listing.profile.username}</span>
              <Star size={10} className="text-gold fill-gold flex-shrink-0" />
              <span className="font-medium text-gold">
                {(listing.profile.rating_count ?? 0) > 0 ? Number(listing.profile.rating).toFixed(1) : '–'}
              </span>
            </span>
          )}
          <span className="flex flex-shrink-0 items-center gap-1">
            <MessageCircle size={12} />
            {listing.comment_count ?? 0}
          </span>
          {/* ISR 快取的相對時間會與 client 當下重算的值不同，suppressHydrationWarning 避免
              整頁 hydration 失敗（否則 React 18 會整份重繪，連 <html> 的 dark class 都被洗掉） */}
          <span suppressHydrationWarning className="flex-shrink-0 text-dugout/60">{formatRelativeTime(listing.created_at)}</span>
        </div>
      </div>
    </Link>
  )
}
