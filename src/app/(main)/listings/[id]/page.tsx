import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Image from 'next/image'
import { formatDate } from '@/lib/utils'
import { CommentSection } from '@/components/listings/CommentSection'
import { ContactSellerButton } from '@/components/listings/ContactSellerButton'
import { MapPin, Calendar, Package, Users } from 'lucide-react'
import type { Listing } from '@/types'

interface Props {
  params: { id: string }
}

export default async function ListingDetailPage({ params }: Props) {
  const supabase = createClient()

  const { data: listing } = await supabase
    .from('listings')
    .select('*, profile:profiles(*)')
    .eq('id', params.id)
    .single()

  if (!listing) notFound()

  await supabase.rpc('increment_view_count', { listing_id: params.id })

  const l = listing as Listing

  const DEAL_METHOD_LABEL = {
    meetup: '面交',
    mail: '郵寄',
    both: '面交 / 郵寄',
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="grid gap-8 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <div className="overflow-hidden rounded-lg">
            {l.images.length > 0 ? (
              <div className="grid gap-1">
                <div className="relative aspect-[4/3]">
                  <Image src={l.images[0]} alt={l.title} fill className="object-cover" priority />
                </div>
                {l.images.length > 1 && (
                  <div className="grid grid-cols-4 gap-1">
                    {l.images.slice(1, 5).map((img, i) => (
                      <div key={i} className="relative aspect-square">
                        <Image src={img} alt="" fill className="object-cover" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex aspect-[4/3] items-center justify-center bg-dugout/10 text-dugout/30">
                <Package size={64} />
              </div>
            )}
          </div>

          <div className="mt-6">
            <h1 className="font-display text-xl text-scoreboard">{l.title}</h1>
            <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-dugout">
              {l.description}
            </p>
          </div>

          <CommentSection listingId={l.id} />
        </div>

        <div className="lg:col-span-2">
          <div className="sticky top-20 card p-5">
            <div className="flex items-center gap-2">
              <span className="scoreboard-price text-xl">
                <span className="currency">NT$</span>
                {l.price.toLocaleString('zh-TW')}
              </span>
              {l.is_negotiable && (
                <span className="badge bg-field/10 text-field">可議價</span>
              )}
            </div>

            <ul className="mt-4 space-y-2 text-sm text-dugout">
              {l.team && (
                <li className="flex items-center gap-2">
                  <Users size={14} className="text-dugout/50" />
                  {l.team}
                </li>
              )}
              {l.game_date && (
                <li className="flex items-center gap-2">
                  <Calendar size={14} className="text-dugout/50" />
                  {formatDate(l.game_date)}
                </li>
              )}
              {l.location && (
                <li className="flex items-center gap-2">
                  <MapPin size={14} className="text-dugout/50" />
                  {l.location}
                </li>
              )}
              <li className="flex items-center gap-2">
                <Package size={14} className="text-dugout/50" />
                {DEAL_METHOD_LABEL[l.deal_method]}
              </li>
            </ul>

            {l.profile && (
              <div className="mt-5 flex items-center gap-3 border-t border-scoreboard/10 pt-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-field text-sm font-bold text-chalk">
                  {l.profile.username.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-semibold text-scoreboard">{l.profile.username}</p>
                  <p className="flex items-center gap-1 text-xs text-dugout">
                    <span className="text-gold">⭐</span>
                    <span className="font-bold text-scoreboard">{l.profile.rating_count}</span>
                    顆星
                  </p>
                </div>
              </div>
            )}

            <ContactSellerButton listingId={l.id} sellerId={l.user_id} />
          </div>
        </div>
      </div>
    </div>
  )
}
