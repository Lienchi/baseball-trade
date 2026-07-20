'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { formatDateWithWeekday, formatPrice, isPastGameDate } from '@/lib/utils'
import { revalidatePaths } from '@/lib/revalidate'
import { Heart } from 'lucide-react'
import type { ListingType, TicketItem } from '@/types'

export function TicketItemsList({
  listingId,
  items,
  canManage,
  type,
  userId = null,
  favoritedItemIds = [],
}: {
  listingId: string
  items: TicketItem[]
  canManage: boolean
  type: ListingType
  userId?: string | null           // 未登入為 null，點愛心導向登入頁
  favoritedItemIds?: string[]      // 目前使用者已關注的場次 id
}) {
  const supabase = createClient()
  const router = useRouter()
  const [loadingIdx, setLoadingIdx] = useState<number | null>(null)
  const [favIds, setFavIds] = useState<Set<string>>(new Set(favoritedItemIds))
  const [favLoadingId, setFavLoadingId] = useState<string | null>(null)

  const toggleSold = async (i: number) => {
    setLoadingIdx(i)
    const updated = items.map((t, idx) => idx === i ? { ...t, sold: !t.sold } : t)
    await supabase.from('listings').update({ ticket_items: updated }).eq('id', listingId)
    // 詳情頁與列表頁都是 ISR，刷完快取再 refresh 才拿得到新資料
    await revalidatePaths(`/listings/${listingId}`, type === 'ticket' ? '/tickets' : '/merchandise')
    router.refresh()
    setLoadingIdx(null)
  }

  const toggleItemFavorite = async (itemId: string) => {
    if (!userId) {
      router.push('/login')
      return
    }
    setFavLoadingId(itemId)
    if (favIds.has(itemId)) {
      const { error } = await supabase
        .from('favorites')
        .delete()
        .eq('user_id', userId)
        .eq('listing_id', listingId)
        .eq('item_id', itemId)
      if (!error) setFavIds(prev => { const s = new Set(prev); s.delete(itemId); return s })
    } else {
      const { error } = await supabase
        .from('favorites')
        .insert({ user_id: userId, listing_id: listingId, item_id: itemId })
      if (!error) setFavIds(prev => new Set(prev).add(itemId))
    }
    setFavLoadingId(null)
  }

  return (
    <ul className="mt-1.5 space-y-1">
      {items.map((item, i) => {
        // 過期場次（比賽日已過）灰化並關閉關注，顯示端即時判斷不依賴排程
        const expired = type === 'ticket' && isPastGameDate(item.date)
        return (
        <li
          key={item.id ?? i}
          className={`flex items-baseline gap-2 rounded-md bg-scoreboard/5 px-2.5 py-1.5 ${item.sold || expired ? 'opacity-50' : ''}`}
        >
          {type === 'ticket' ? (
            <>
              <span className={`flex-shrink-0 font-medium text-scoreboard ${item.sold ? 'line-through' : ''}`}>
                {formatDateWithWeekday(item.date!)}
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
            <span className={`flex-shrink-0 font-bold text-field dark:text-blue-400 ${item.sold ? 'line-through' : ''}`}>
              {formatPrice(item.price)}
            </span>
          )}
          {canManage ? (
            <button
              type="button"
              onClick={() => toggleSold(i)}
              disabled={loadingIdx === i}
              className={`ml-auto flex-shrink-0 rounded-full border px-2 py-0.5 text-xs font-bold transition disabled:opacity-40 ${
                item.sold
                  ? 'border-clay text-clay'
                  : 'border-scoreboard/20 text-dugout hover:border-field hover:text-field'
              }`}
            >
              {loadingIdx === i ? '...' : item.sold ? '已售出' : '標記售出'}
            </button>
          ) : (
            <>
              {item.sold ? (
                <span className="ml-auto flex-shrink-0 rounded-full bg-clay/10 px-2 py-0.5 text-xs font-bold text-clay">
                  已售出
                </span>
              ) : expired && (
                <span className="ml-auto flex-shrink-0 rounded-full bg-dugout/10 px-2 py-0.5 text-xs font-bold text-dugout">
                  已過期
                </span>
              )}
              {type === 'ticket' && item.id && !item.sold && !expired && (
                <button
                  type="button"
                  onClick={() => toggleItemFavorite(item.id!)}
                  disabled={favLoadingId === item.id}
                  title={favIds.has(item.id) ? '取消關注此場次' : '關注此場次'}
                  className="ml-auto flex-shrink-0 self-center p-0.5 transition disabled:opacity-40"
                >
                  <Heart
                    size={14}
                    className={favIds.has(item.id) ? 'fill-clay text-clay' : 'text-dugout/40 hover:text-clay'}
                  />
                </button>
              )}
            </>
          )}
        </li>
        )
      })}
    </ul>
  )
}
