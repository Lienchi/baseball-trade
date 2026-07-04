'use client'

import Image from 'next/image'
import Link from 'next/link'
import { MessageCircle, MapPin, Tag, Star } from 'lucide-react'
import { formatRelativeTime, cn } from '@/lib/utils'
import { getTeamColor, DEAL_METHOD_LABELS } from '@/types'
import type { Listing } from '@/types'

interface Props {
  listing: Listing
}

export function ListingCard({ listing }: Props) {
  const firstImage = listing.images?.[0]
  const team = getTeamColor(listing.team)

  return (
    <Link
      href={`/listings/${listing.id}`}
      className="card group flex flex-col overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-scoreboard/5"
    >
      {/* 圖片區 */}
      <div className="relative aspect-[4/3] bg-dugout/10">
        {firstImage ? (
          <Image
            src={firstImage}
            alt={listing.title}
            fill
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

      {/* 內容區 */}
      <div className="flex flex-1 flex-col p-3">
        {listing.team && (
          <span className={cn('mb-1 inline-flex w-fit items-center rounded-full px-2 py-0.5 text-[11px] font-bold', team.bg, team.textOnBg)}>
            {listing.team}
          </span>
        )}
        <p className="line-clamp-2 text-sm font-semibold text-scoreboard">{listing.title}</p>

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
                <Image src={listing.profile.avatar_url} alt={listing.profile.username} width={16} height={16} className="rounded-full object-cover flex-shrink-0" />
              ) : (
                <span className="h-4 w-4 flex-shrink-0 rounded-full bg-dugout/20 flex items-center justify-center text-[9px] font-bold text-dugout">
                  {listing.profile.username[0]?.toUpperCase()}
                </span>
              )}
              <span className="truncate">{listing.profile.username}</span>
              <Star size={10} className="text-gold fill-gold flex-shrink-0 ml-auto" />
              <span className="font-medium text-gold flex-shrink-0">{listing.profile.rating_count ?? 0}</span>
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
            <span className="flex items-center gap-2.5">
              <span className="flex items-center gap-0.5">
                <MessageCircle size={11} />
                {listing.comment_count ?? 0}
              </span>
              <span>{formatRelativeTime(listing.created_at)}</span>
            </span>
          </div>
        </div>
      </div>
    </Link>
  )
}
