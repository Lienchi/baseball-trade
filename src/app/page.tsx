import { createClient } from '@/lib/supabase/server'
import { ListingCard } from '@/components/listings/ListingCard'
import { TicketListRow } from '@/components/listings/TicketListRow'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import type { Listing } from '@/types'

export const revalidate = 60

const PREVIEW_COUNT = 6

export default async function HomePage() {
  const supabase = createClient()

  const normalize = (rawListings: any[] | null) =>
    (rawListings?.map(listing => ({
      ...listing,
      comment_count: Array.isArray(listing.comment_count)
        ? (listing.comment_count[0]?.count ?? 0)
        : 0,
    })) ?? []) as Listing[]

  const [ticketsRes, merchRes] = await Promise.all([
    supabase
      .from('listings')
      .select('*, profile:profiles(id, username, avatar_url, rating, rating_count), comment_count:comments(count)')
      .eq('status', 'active')
      .eq('type', 'ticket')
      .order('created_at', { ascending: false })
      .limit(PREVIEW_COUNT),
    supabase
      .from('listings')
      .select('*, profile:profiles(id, username, avatar_url, rating, rating_count), comment_count:comments(count)')
      .eq('status', 'active')
      .eq('type', 'merchandise')
      .order('created_at', { ascending: false })
      .limit(PREVIEW_COUNT),
  ])

  const tickets = normalize(ticketsRes.data)
  const merchandise = normalize(merchRes.data)
  const isEmpty = tickets.length === 0 && merchandise.length === 0

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      {/* Hero */}
      <div className="mb-8 border-b-2 border-scoreboard/10 pb-6">
        <p className="font-mono text-xs font-bold uppercase tracking-widest text-clay">
          CPBL Marketplace
        </p>
        <h1 className="mt-1 font-display text-2xl text-scoreboard">本質球迷交易所</h1>
        <p className="mt-1 text-sm text-dugout">中華職棒球票 &amp; 周邊商品交易</p>
      </div>

      {/* 兩個導覽入口 */}
      <div className="grid grid-cols-2 gap-4">
        <Link
          href="/tickets"
          className="card group flex items-center justify-between border-l-4 border-field p-6 transition hover:shadow-md"
        >
          <div>
            <span className="text-2xl">⚾</span>
            <h2 className="mt-2 font-display text-lg text-scoreboard">球票交易</h2>
            <p className="mt-1 text-sm text-dugout">瀏覽所有球票刊登，依日期、球隊篩選</p>
          </div>
          <ArrowRight size={20} className="text-dugout/40 transition group-hover:translate-x-1 group-hover:text-field" />
        </Link>

        <Link
          href="/merchandise"
          className="card group flex items-center justify-between border-l-4 border-gold p-6 transition hover:shadow-md"
        >
          <div>
            <span className="text-2xl">🎽</span>
            <h2 className="mt-2 font-display text-lg text-scoreboard">周邊商品</h2>
            <p className="mt-1 text-sm text-dugout">球衣、簽名球、應援小物盡在這裡</p>
          </div>
          <ArrowRight size={20} className="text-dugout/40 transition group-hover:translate-x-1 group-hover:text-gold" />
        </Link>
      </div>

      {isEmpty ? (
        <div className="mt-16 flex flex-col items-center text-center">
          <span className="text-4xl">⚾</span>
          <p className="mt-3 text-lg font-semibold text-scoreboard">目前還沒有任何刊登</p>
          <p className="mt-1 text-sm text-dugout">第一棒由你來開打</p>
          <Link href="/listings/new" className="btn-primary mt-5 inline-flex">
            + 刊登商品
          </Link>
        </div>
      ) : (
        <>
          {/* 球票精選 */}
          {tickets.length > 0 && (
            <section className="mt-10">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-base text-scoreboard">⚾ 最新球票</h2>
                <Link href="/tickets" className="flex items-center gap-1 text-xs font-bold text-clay hover:underline">
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
            <section className="mt-10">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-base text-scoreboard">🎽 最新周邊</h2>
                <Link href="/merchandise" className="flex items-center gap-1 text-xs font-bold text-clay hover:underline">
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
        </>
      )}
    </div>
  )
}
