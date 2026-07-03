'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Calendar, MessageCircle, Star } from 'lucide-react'
import { formatDate, cn } from '@/lib/utils'
import { getTeamColor } from '@/types'
import type { Listing } from '@/types'

interface Props {
  listing: Listing
}

export function TicketListRow({ listing }: Props) {
  const team = getTeamColor(listing.team)

  return (
    <Link
      href={`/listings/${listing.id}`}
      className={cn(
        'card group flex items-center gap-4 border-l-4 p-4 transition-all hover:shadow-md',
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
          {listing.title}
        </p>
        {/* 場次清單：日期 + 座位（最多 3 筆，其餘收合） */}
        {(listing.ticket_items?.length ?? 0) > 0 && (
          <ul className="mt-1.5 space-y-0.5">
            {listing.ticket_items.slice(0, 3).map((item, i) => (
              <li key={i} className="flex items-center gap-2 text-xs text-dugout">
                <span className="flex flex-shrink-0 items-center gap-1 font-medium text-scoreboard">
                  <Calendar size={11} className="text-dugout/50" />
                  {formatDate(item.date)}
                </span>
                {item.seat && <span className="truncate">{item.seat}</span>}
              </li>
            ))}
            {listing.ticket_items.length > 3 && (
              <li className="text-xs text-dugout/60">還有 {listing.ticket_items.length - 3} 場…</li>
            )}
          </ul>
        )}
        {/* 刊登者 + 星星數 + 留言數 */}
        <div className="mt-1 flex items-center gap-3 text-xs text-dugout">
          {listing.profile && (
            <span className="flex items-center gap-1.5 overflow-hidden">
              {listing.profile.avatar_url ? (
                <Image src={listing.profile.avatar_url} alt={listing.profile.username} width={14} height={14} className="rounded-full object-cover flex-shrink-0" />
              ) : (
                <span className="h-3.5 w-3.5 flex-shrink-0 rounded-full bg-dugout/20 flex items-center justify-center text-[8px] font-bold text-dugout">
                  {listing.profile.username[0]?.toUpperCase()}
                </span>
              )}
              <span className="truncate">{listing.profile.username}</span>
              <Star size={10} className="text-gold fill-gold flex-shrink-0" />
              <span className="font-medium text-gold">{listing.profile.rating_count ?? 0}</span>
            </span>
          )}
          <span className="flex flex-shrink-0 items-center gap-1">
            <MessageCircle size={12} />
            {listing.comment_count ?? 0}
          </span>
        </div>
      </div>
    </Link>
  )
}
