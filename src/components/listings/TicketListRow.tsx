'use client'

import Link from 'next/link'
import Image from 'next/image'
import { MapPin, Calendar, MessageCircle, Star } from 'lucide-react'
import { formatRelativeTime, formatDate, cn } from '@/lib/utils'
import { getTeamColor, DEAL_METHOD_LABELS } from '@/types'
import type { Listing } from '@/types'

interface Props {
  listing: Listing
}

// 比賽日倒數文字：今天 / 明天 / N 天後 / 已過期
function gameCountdown(gameDate: string): { text: string; expired: boolean } {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const game = new Date(gameDate)
  game.setHours(0, 0, 0, 0)
  const days = Math.round((game.getTime() - today.getTime()) / 86400000)
  if (days < 0) return { text: '已過期', expired: true }
  if (days === 0) return { text: '今天開打', expired: false }
  if (days === 1) return { text: '明天開打', expired: false }
  return { text: `${days} 天後`, expired: false }
}

export function TicketListRow({ listing }: Props) {
  const team = getTeamColor(listing.team)

  // 倒數以「最近的未來場次」為準，全部過期才顯示已過期
  const dates = (listing.ticket_items ?? []).map(t => t.date).filter(Boolean)
  if (dates.length === 0 && listing.game_date) dates.push(listing.game_date)
  const todayStr = new Date().toISOString().slice(0, 10)
  const upcoming = dates.filter(d => d >= todayStr).sort()
  const countdownDate = upcoming[0] ?? (dates.length > 0 ? [...dates].sort().at(-1) : null)

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
        {/* 場次清單：日期 + 座位 + 票價（最多 3 筆，其餘收合） */}
        {(listing.ticket_items?.length ?? 0) > 0 && (
          <ul className="mt-1.5 space-y-0.5">
            {listing.ticket_items.slice(0, 3).map((item, i) => (
              <li key={i} className="flex items-center gap-2 text-xs text-dugout">
                <span className="flex flex-shrink-0 items-center gap-1 font-medium text-scoreboard">
                  <Calendar size={11} className="text-dugout/50" />
                  {formatDate(item.date)}
                </span>
                {item.seat && <span className="truncate">{item.seat}</span>}
                {item.price != null && (
                  <span className="flex-shrink-0 font-bold text-field dark:text-blue-400">
                    NT$ {item.price.toLocaleString('zh-TW')}
                  </span>
                )}
              </li>
            ))}
            {listing.ticket_items.length > 3 && (
              <li className="text-xs text-dugout/60">還有 {listing.ticket_items.length - 3} 場…</li>
            )}
          </ul>
        )}
        <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-dugout">
          {listing.profile && (
            <span className="flex items-center gap-1.5">
              {listing.profile.avatar_url ? (
                <Image src={listing.profile.avatar_url} alt={listing.profile.username} width={14} height={14} className="rounded-full object-cover flex-shrink-0" />
              ) : (
                <span className="h-3.5 w-3.5 flex-shrink-0 rounded-full bg-dugout/20 flex items-center justify-center text-[8px] font-bold text-dugout">
                  {listing.profile.username[0]?.toUpperCase()}
                </span>
              )}
              <span>{listing.profile.username}</span>
              <Star size={10} className="text-gold fill-gold flex-shrink-0" />
              <span className="font-medium text-gold">{listing.profile.rating_count ?? 0}</span>
            </span>
          )}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-dugout">
          {listing.location && (
            <span className="flex items-center gap-1">
              <MapPin size={12} />
              {listing.location}
            </span>
          )}
          <span className="flex items-center gap-1">
            <MessageCircle size={12} />
            {listing.comment_count ?? 0}
          </span>
        </div>
      </div>

      {/* 比賽倒數 + 交易方式 */}
      <div className="flex-shrink-0 text-right">
        {countdownDate && (() => {
          const countdown = gameCountdown(countdownDate)
          return (
            <p className={cn(
              'text-sm font-bold',
              countdown.expired ? 'text-dugout/50' : 'text-field dark:text-blue-400'
            )}>
              {countdown.text}
            </p>
          )
        })()}
        {listing.deal_methods?.length > 0 && (
          <div className="mt-1 flex flex-wrap justify-end gap-1">
            {listing.deal_methods.map(m => (
              <span key={m} className="rounded-sm bg-field/10 px-1.5 py-0.5 text-[10px] font-medium text-field dark:bg-blue-400/15 dark:text-blue-400">
                {DEAL_METHOD_LABELS[m]}
              </span>
            ))}
          </div>
        )}
        <p className="mt-1 text-xs text-dugout/60">{formatRelativeTime(listing.created_at)}</p>
      </div>
    </Link>
  )
}
