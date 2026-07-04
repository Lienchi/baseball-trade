import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { formatDate, formatRelativeTime } from '@/lib/utils'
import { CommentSection } from '@/components/listings/CommentSection'
import { ListingGallery } from '@/components/listings/ListingGallery'
import { ContactSellerButton } from '@/components/listings/ContactSellerButton'
import { MarkSoldButton } from '@/components/listings/MarkSoldButton'
import { TicketItemsList } from '@/components/listings/TicketItemsList'
import { DeleteListingButton } from '@/components/listings/DeleteListingButton'
import Link from 'next/link'
import Image from 'next/image'
import { MapPin, Calendar, Package, Users, Clock, ShoppingBag } from 'lucide-react'
import { DEAL_METHOD_LABELS } from '@/types'
import type { Listing } from '@/types'

interface Props {
  params: { id: string }
}

export default async function ListingDetailPage({ params }: Props) {
  const supabase = createClient()

  // listing 與 auth 互不依賴，平行查詢減少 TTFB
  const [{ data: listing }, { data: { user } }] = await Promise.all([
    supabase
      .from('listings')
      .select('*, profile:profiles(username, avatar_url, rating_count)')
      .eq('id', params.id)
      .single(),
    supabase.auth.getUser(),
  ])

  if (!listing) notFound()

  const isOwner = user?.id === listing.user_id

  let isAdmin = false
  if (user && !isOwner) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single()
    isAdmin = (profile as any)?.is_admin === true
  }

  const canManage = isOwner || isAdmin

  // 瀏覽數：擁有者看自己不計，且不 await（不阻塞頁面回應）
  if (!isOwner) {
    void supabase.rpc('increment_view_count', { listing_id: params.id })
  }

  const l = listing as Listing


  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="grid gap-8 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <ListingGallery images={l.images} title={l.title} />

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
            <ul className="space-y-2 text-sm text-dugout">
              {l.team && (
                <li className="flex items-center gap-2">
                  <Users size={14} className="text-dugout/50" />
                  {l.team}
                </li>
              )}
              {(l.ticket_items?.length ?? 0) > 0 ? (
                <li>
                  <div className="flex items-center gap-2">
                    {l.type === 'ticket'
                      ? <Calendar size={14} className="text-dugout/50" />
                      : <ShoppingBag size={14} className="text-dugout/50" />}
                    {l.type === 'ticket' ? '場次資訊' : '商品列表'}
                  </div>
                  <TicketItemsList listingId={l.id} items={l.ticket_items} canManage={canManage} type={l.type} />
                </li>
              ) : l.game_date && (
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
              {l.deal_methods?.length > 0 && (
                <li className="flex items-center gap-2">
                  <Package size={14} className="text-dugout/50" />
                  {l.deal_methods.map(m => DEAL_METHOD_LABELS[m]).join('、')}
                </li>
              )}
              <li className="flex items-center gap-2 text-dugout/70">
                <Clock size={14} className="text-dugout/50" />
                {formatRelativeTime(l.created_at)}刊登
              </li>
            </ul>

            {l.profile && (
              <div className="mt-5 flex items-center gap-3 border-t border-scoreboard/10 pt-4">
                {l.profile.avatar_url ? (
                  <Image
                    src={l.profile.avatar_url}
                    alt={l.profile.username}
                    width={40}
                    height={40}
                    className="h-10 w-10 flex-shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-field text-sm font-bold text-white">
                    {l.profile.username.slice(0, 2).toUpperCase()}
                  </div>
                )}
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

            {canManage ? (
              <div className="mt-4 space-y-2">
                {l.status === 'active' && <MarkSoldButton listingId={l.id} />}
                <Link
                  href={`/listings/${l.id}/edit`}
                  className="btn-secondary mt-2 flex w-full items-center justify-center"
                >
                  編輯刊登
                </Link>
                <DeleteListingButton listingId={l.id} />
              </div>
            ) : (
              <ContactSellerButton listingId={l.id} sellerId={l.user_id} />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
