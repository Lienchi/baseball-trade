'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { formatDate, formatPrice } from '@/lib/utils'
import type { ListingType, TicketItem } from '@/types'

export function TicketItemsList({
  listingId,
  items,
  canManage,
  type,
}: {
  listingId: string
  items: TicketItem[]
  canManage: boolean
  type: ListingType
}) {
  const supabase = createClient()
  const router = useRouter()
  const [loadingIdx, setLoadingIdx] = useState<number | null>(null)

  const toggleSold = async (i: number) => {
    setLoadingIdx(i)
    const updated = items.map((t, idx) => idx === i ? { ...t, sold: !t.sold } : t)
    await supabase.from('listings').update({ ticket_items: updated }).eq('id', listingId)
    router.refresh()
    setLoadingIdx(null)
  }

  return (
    <ul className="mt-1.5 space-y-1">
      {items.map((item, i) => (
        <li
          key={i}
          className={`ml-6 flex items-baseline gap-2 rounded-md bg-scoreboard/5 px-2.5 py-1.5 ${item.sold ? 'opacity-50' : ''}`}
        >
          {type === 'ticket' ? (
            <>
              <span className={`flex-shrink-0 font-medium text-scoreboard ${item.sold ? 'line-through' : ''}`}>
                {formatDate(item.date!)}
              </span>
              {item.seat && (
                <span className={`text-dugout ${item.sold ? 'line-through' : ''}`}>{item.seat}</span>
              )}
            </>
          ) : (
            <span className={`font-medium text-scoreboard ${item.sold ? 'line-through' : ''}`}>
              {item.name}
            </span>
          )}
          {item.price != null && (
            <span className={`ml-auto flex-shrink-0 font-bold text-field dark:text-blue-400 ${item.sold ? 'line-through' : ''}`}>
              {formatPrice(item.price)}
            </span>
          )}
          {canManage ? (
            <button
              type="button"
              onClick={() => toggleSold(i)}
              disabled={loadingIdx === i}
              className={`flex-shrink-0 rounded-full border px-2 py-0.5 text-xs font-bold transition disabled:opacity-40 ${
                item.sold
                  ? 'border-clay text-clay'
                  : 'border-scoreboard/20 text-dugout hover:border-field hover:text-field'
              }`}
            >
              {loadingIdx === i ? '...' : item.sold ? '已售出' : '標記售出'}
            </button>
          ) : item.sold ? (
            <span className="flex-shrink-0 rounded-full bg-clay/10 px-2 py-0.5 text-xs font-bold text-clay">
              已售出
            </span>
          ) : null}
        </li>
      ))}
    </ul>
  )
}
