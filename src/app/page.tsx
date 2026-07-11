import { createStaticClient } from '@/lib/supabase/static'
import { ListingCard } from '@/components/listings/ListingCard'
import { TicketListRow } from '@/components/listings/TicketListRow'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowRight, Ticket, Shirt, Trophy, Star } from 'lucide-react'
import type { Listing, Profile } from '@/types'
import { todayTaipei } from '@/lib/utils'

export const revalidate = 60

const PREVIEW_COUNT = 6
const DEAL_STARS_COUNT = 8

export default async function HomePage() {
  const supabase = createStaticClient()

  const normalize = (rawListings: any[] | null) =>
    (rawListings?.map(listing => ({
      ...listing,
      comment_count: Array.isArray(listing.comment_count)
        ? (listing.comment_count[0]?.count ?? 0)
        : 0,
    })) ?? []) as Listing[]

  const [ticketsRes, merchRes, dealStarsRes] = await Promise.all([
    supabase
      .from('listings')
      .select('*, profile:profiles!listings_user_id_fkey(id, username, avatar_url, rating, rating_count, deal_count), comment_count:comments(count)')
      .eq('status', 'active')
      .eq('type', 'ticket')
      // 場次全數過期的刊登即時消失，不等半夜 pg_cron 標記 expired
      .or(`last_game_date.is.null,last_game_date.gte.${todayTaipei()}`)
      .order('created_at', { ascending: false })
      .limit(PREVIEW_COUNT),
    supabase
      .from('listings')
      .select('*, profile:profiles!listings_user_id_fkey(id, username, avatar_url, rating, rating_count, deal_count), comment_count:comments(count)')
      .eq('status', 'active')
      .eq('type', 'merchandise')
      .order('created_at', { ascending: false })
      .limit(PREVIEW_COUNT),
    // 交易之星：有成交紀錄的用戶（含站長帳號，都是真實成交）；同分以評價數、資歷穩定排序
    supabase
      .from('profiles')
      .select('id, username, avatar_url, rating, rating_count, deal_count')
      .gt('deal_count', 0)
      .order('deal_count', { ascending: false })
      .order('rating_count', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(DEAL_STARS_COUNT),
  ])

  const tickets = normalize(ticketsRes.data)
  const merchandise = normalize(merchRes.data)
  const dealStars = (dealStarsRes.data ?? []) as Pick<
    Profile, 'id' | 'username' | 'avatar_url' | 'rating' | 'rating_count' | 'deal_count'
  >[]
  const isEmpty = tickets.length === 0 && merchandise.length === 0

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      {isEmpty ? (
        <div className="mt-16 flex flex-col items-center text-center">
          <p className="text-lg font-semibold text-scoreboard">目前還沒有任何刊登</p>
          <p className="mt-1 text-sm text-dugout">第一棒由你來開打</p>
          <Link href="/listings/new" className="btn-primary mt-5 inline-flex">
            + 刊登商品
          </Link>
        </div>
      ) : (
        <div className="space-y-10">
          {/* 交易之星：一列可橫滑的頭像，讓新訪客看到站上有真實成交 */}
          {dealStars.length > 0 && (
            <section>
              <h2 className="flex items-center gap-1.5 font-display text-base text-scoreboard">
                <Trophy size={16} className="text-gold" /> 交易之星
              </h2>
              <div className="scrollbar-none mt-3 flex gap-3 overflow-x-auto">
                {dealStars.map(star => (
                  <Link
                    key={star.id}
                    href={`/users/${star.id}`}
                    title={star.username}
                    className="flex w-14 flex-shrink-0 flex-col items-center transition hover:opacity-80"
                  >
                    {star.avatar_url ? (
                      <Image src={star.avatar_url} alt={star.username} width={48} height={48} unoptimized className="h-12 w-12 rounded-full border border-scoreboard/10 object-cover" />
                    ) : (
                      <span className="flex h-12 w-12 items-center justify-center rounded-full border border-scoreboard/10 bg-dugout/20 text-lg font-bold text-dugout">
                        {star.username[0]?.toUpperCase()}
                      </span>
                    )}
                    <span className="mt-1 text-[10px] leading-tight text-dugout">{star.deal_count} 次成交</span>
                    <span className="flex items-center gap-0.5 text-[10px] font-medium leading-tight text-gold">
                      <Star size={8} className="fill-gold" />
                      {star.rating_count > 0 ? Number(star.rating).toFixed(1) : '–'}
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* 球票精選 */}
          {tickets.length > 0 && (
            <section>
              <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-1.5 font-display text-base text-scoreboard">
                  <Ticket size={16} className="text-field dark:text-blue-400" /> 最新球票
                </h2>
                <Link href="/tickets" className="flex items-center gap-1 text-xs font-bold text-clay hover:underline dark:text-clay-light">
                  查看全部 <ArrowRight size={12} />
                </Link>
              </div>
              <div className="mt-3 space-y-2">
                {tickets.map(listing => (
                  <TicketListRow key={listing.id} listing={listing} />
                ))}
              </div>
            </section>
          )}

          {/* 周邊精選 */}
          {merchandise.length > 0 && (
            <section>
              <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-1.5 font-display text-base text-scoreboard">
                  <Shirt size={16} className="text-clay dark:text-blue-300" /> 最新周邊
                </h2>
                <Link href="/merchandise" className="flex items-center gap-1 text-xs font-bold text-clay hover:underline dark:text-clay-light">
                  查看全部 <ArrowRight size={12} />
                </Link>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-3">
                {merchandise.map(listing => (
                  <ListingCard key={listing.id} listing={listing} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}
