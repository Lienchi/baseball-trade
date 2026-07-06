import { createClient } from '@/lib/supabase/server'
import { ListingCard } from '@/components/listings/ListingCard'
import { TicketListRow } from '@/components/listings/TicketListRow'
import Link from 'next/link'
import { ArrowRight, Ticket, Shirt } from 'lucide-react'
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
      .select('*, profile:profiles!listings_user_id_fkey(id, username, avatar_url, rating, rating_count, deal_count), comment_count:comments(count)')
      .eq('status', 'active')
      .eq('type', 'ticket')
      .order('created_at', { ascending: false })
      .limit(PREVIEW_COUNT),
    supabase
      .from('listings')
      .select('*, profile:profiles!listings_user_id_fkey(id, username, avatar_url, rating, rating_count, deal_count), comment_count:comments(count)')
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
          {/* 球票精選 */}
          {tickets.length > 0 && (
            <section>
              <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-1.5 font-display text-base text-scoreboard">
                  <Ticket size={16} className="text-field dark:text-blue-400" /> 最新球票
                </h2>
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
            <section>
              <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-1.5 font-display text-base text-scoreboard">
                  <Shirt size={16} className="text-clay dark:text-blue-300" /> 最新周邊
                </h2>
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
        </div>
      )}
    </div>
  )
}
