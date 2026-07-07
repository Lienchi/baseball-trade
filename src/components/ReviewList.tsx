'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Star } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { formatRelativeTime } from '@/lib/utils'
import type { Review } from '@/types'

const PAGE_SIZE = 10
// 評語超過這個長度先收合，點「顯示全部」展開
const COLLAPSE_THRESHOLD = 100

interface Props {
  revieweeId: string
}

export function ReviewList({ revieweeId }: Props) {
  const supabase = createClient()
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)
  const [hasMore, setHasMore] = useState(false)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  const loadPage = useCallback(async (offset: number) => {
    setLoading(true)
    // 多抓一筆判斷還有沒有下一頁
    const { data } = await supabase
      .from('reviews')
      .select('id, rating, comment, listing_title, created_at, reviewer:profiles!reviews_reviewer_id_fkey(id, username, avatar_url)')
      .eq('reviewee_id', revieweeId)
      .order('created_at', { ascending: false })
      .range(offset, offset + PAGE_SIZE)

    const rows = (data ?? []) as unknown as Review[]
    setHasMore(rows.length > PAGE_SIZE)
    setReviews(prev => offset === 0 ? rows.slice(0, PAGE_SIZE) : [...prev, ...rows.slice(0, PAGE_SIZE)])
    setLoading(false)
  }, [supabase, revieweeId])

  useEffect(() => {
    loadPage(0)
  }, [loadPage])

  const toggleExpanded = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  if (!loading && reviews.length === 0) {
    return <p className="mt-6 text-center text-sm text-dugout">還沒有收到任何評價</p>
  }

  return (
    <>
      <ul className="mt-4 space-y-3">
        {reviews.map(review => {
          const isLong = (review.comment?.length ?? 0) > COLLAPSE_THRESHOLD
          const expanded = expandedIds.has(review.id)
          return (
            <li key={review.id} className="card p-4">
              <div className="flex items-center gap-2">
                <ReviewerLink reviewerId={review.reviewer?.id}>
                  {review.reviewer?.avatar_url ? (
                    <Image
                      src={review.reviewer.avatar_url}
                      alt={review.reviewer.username}
                      width={28}
                      height={28}
                      unoptimized
                      className="h-7 w-7 rounded-full object-cover"
                    />
                  ) : (
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-dugout/15 text-[10px] font-bold text-dugout">
                      {review.reviewer?.username.slice(0, 2).toUpperCase()}
                    </span>
                  )}
                  <span className="text-sm font-semibold text-scoreboard">
                    {review.reviewer?.username ?? '用戶'}
                  </span>
                </ReviewerLink>
                <span className="flex items-center">
                  {[1, 2, 3, 4, 5].map(n => (
                    <Star
                      key={n}
                      size={13}
                      className={n <= review.rating ? 'fill-gold text-gold' : 'text-dugout/25'}
                    />
                  ))}
                </span>
                <span className="ml-auto text-xs text-dugout/60">
                  {formatRelativeTime(review.created_at)}
                </span>
              </div>
              {review.comment && (
                <>
                  <p className={`mt-2 whitespace-pre-wrap text-sm text-scoreboard ${isLong && !expanded ? 'line-clamp-3' : ''}`}>
                    {review.comment}
                  </p>
                  {isLong && (
                    <button
                      className="mt-1 text-xs font-medium text-field hover:underline"
                      onClick={() => toggleExpanded(review.id)}
                    >
                      {expanded ? '收合' : '顯示全部'}
                    </button>
                  )}
                </>
              )}
              {review.listing_title && (
                <p className="mt-1.5 text-xs text-dugout/60">交易商品：{review.listing_title}</p>
              )}
            </li>
          )
        })}
      </ul>

      {loading && <p className="mt-4 text-center text-sm text-dugout">載入中...</p>}

      {hasMore && !loading && (
        <div className="mt-4 text-center">
          <button className="btn-secondary px-4 py-1.5 text-sm" onClick={() => loadPage(reviews.length)}>
            載入更多評價
          </button>
        </div>
      )}
    </>
  )
}

// 評價者帳號還在才給連結，已刪除帳號維持純文字
function ReviewerLink({ reviewerId, children }: { reviewerId: string | undefined; children: React.ReactNode }) {
  if (!reviewerId) return <>{children}</>
  return (
    <Link href={`/users/${reviewerId}`} className="flex items-center gap-2 transition hover:opacity-80">
      {children}
    </Link>
  )
}
