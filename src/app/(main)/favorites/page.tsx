import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Calendar, Heart } from 'lucide-react'
import { TicketListRow } from '@/components/listings/TicketListRow'
import { cn, formatDateWithWeekday, formatPrice } from '@/lib/utils'
import { getTeamColor } from '@/types'
import type { Listing, TicketItem } from '@/types'

interface FavoriteRow {
  item_id: string | null
  created_at: string
  listing: (Listing & { comment_count: unknown }) | null
}

export default async function FavoritesPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // 依關注時間新到舊；已下架（closed/sold 但仍可見於擁有者以外）的刊登
  // 因 listings RLS 只開放 active 或本人，join 不到就自然被過濾掉
  const { data: favorites } = await supabase
    .from('favorites')
    .select(`
      item_id,
      created_at,
      listing:listings(
        *,
        profile:profiles!listings_user_id_fkey(id, username, avatar_url, rating_count),
        comment_count:comments(count)
      )
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  const rows = ((favorites ?? []) as unknown as FavoriteRow[])
    .filter(f => f.listing !== null)
    .map(f => ({
      ...f,
      listing: {
        ...f.listing!,
        comment_count: Array.isArray(f.listing!.comment_count)
          ? ((f.listing!.comment_count[0] as { count?: number })?.count ?? 0)
          : 0,
      } as Listing,
    }))

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 border-b-2 border-scoreboard/10 pb-6">
        <h1 className="flex items-center gap-2 font-display text-2xl text-scoreboard">
          <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-clay/10 text-clay">
            <Heart size={18} strokeWidth={2} />
          </span>
          我的關注
        </h1>
        <p className="mt-1 text-sm text-dugout">{rows.length} 筆關注</p>
      </div>

      {rows.length > 0 ? (
        <div className="space-y-2">
          {rows.map(({ item_id, listing }) =>
            item_id === null ? (
              <TicketListRow key={listing.id} listing={listing} />
            ) : (
              <FavoriteItemRow
                key={`${listing.id}-${item_id}`}
                listing={listing}
                item={listing.ticket_items?.find(t => t.id === item_id)}
              />
            )
          )}
        </div>
      ) : (
        <div className="mt-20 flex flex-col items-center text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-clay/10 text-clay">
            <Heart size={26} strokeWidth={2} />
          </span>
          <p className="mt-3 text-lg font-semibold text-scoreboard">還沒有關注任何球票</p>
          <p className="mt-1 text-sm text-dugout">到球票列表逛逛，點「關注球票」追蹤有興趣的刊登</p>
          <Link href="/tickets" className="btn-primary mt-5 inline-flex">
            瀏覽球票
          </Link>
        </div>
      )}
    </div>
  )
}

// 場次級關注：只顯示該場次的日期/座位/價格，場次被賣家移除時提示
function FavoriteItemRow({ listing, item }: { listing: Listing; item: TicketItem | undefined }) {
  const team = getTeamColor(listing.team)

  return (
    <Link
      href={`/listings/${listing.id}`}
      className={cn(
        'card group flex items-center gap-4 border-l-4 p-4 transition-all hover:shadow-md',
        team.border
      )}
    >
      <div className={cn(
        'flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-md text-sm font-bold leading-none',
        team.bg,
        team.textOnBg
      )}>
        {listing.team ? listing.team.slice(0, 2) : '⚾'}
      </div>

      <div className="flex-1 overflow-hidden">
        <p className="flex items-center gap-2 text-xs text-dugout">
          <span className="badge bg-clay/10 text-clay-dark">關注場次</span>
          <span className="truncate">{listing.title}</span>
        </p>
        {item ? (
          <div className="mt-1.5 flex items-center gap-2 text-sm">
            <span className="flex flex-shrink-0 items-center gap-1 font-semibold text-scoreboard">
              <Calendar size={13} className="text-dugout/50" />
              {formatDateWithWeekday(item.date!)}
            </span>
            {item.seat && <span className="truncate text-dugout">{item.seat}</span>}
            {item.price != null && (
              <span className="flex-shrink-0 font-bold text-field dark:text-blue-400">
                {formatPrice(item.price)}
              </span>
            )}
            {item.sold && (
              <span className="badge flex-shrink-0 bg-clay/10 text-clay-dark">已售出</span>
            )}
          </div>
        ) : (
          <p className="mt-1.5 text-sm text-dugout/60">此場次已被賣家移除</p>
        )}
      </div>
    </Link>
  )
}
