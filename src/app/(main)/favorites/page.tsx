import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Heart } from 'lucide-react'
import { TicketListRow } from '@/components/listings/TicketListRow'
import type { Listing } from '@/types'

export default async function FavoritesPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // 依關注時間新到舊；已下架（closed/sold 但仍可見於擁有者以外）的刊登
  // 因 listings RLS 只開放 active 或本人，join 不到就自然被過濾掉
  const { data: favorites } = await supabase
    .from('favorites')
    .select(`
      created_at,
      listing:listings(
        *,
        profile:profiles!listings_user_id_fkey(id, username, avatar_url, rating_count),
        comment_count:comments(count)
      )
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  const listings = (favorites ?? [])
    .map(f => f.listing as unknown as (Listing & { comment_count: unknown }) | null)
    .filter((l): l is Listing & { comment_count: unknown } => l !== null)
    .map(l => ({
      ...l,
      comment_count: Array.isArray(l.comment_count)
        ? ((l.comment_count[0] as { count?: number })?.count ?? 0)
        : 0,
    })) as Listing[]

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 border-b-2 border-scoreboard/10 pb-6">
        <h1 className="flex items-center gap-2 font-display text-2xl text-scoreboard">
          <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-clay/10 text-clay">
            <Heart size={18} strokeWidth={2} />
          </span>
          我的關注
        </h1>
        <p className="mt-1 text-sm text-dugout">{listings.length} 筆關注中的球票</p>
      </div>

      {listings.length > 0 ? (
        <div className="space-y-2">
          {listings.map(listing => (
            <TicketListRow key={listing.id} listing={listing} />
          ))}
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
