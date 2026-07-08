'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { formatRelativeTime } from '@/lib/utils'
import { Send, CheckCircle2, Circle, Star } from 'lucide-react'
import type { Message, Profile } from '@/types'

interface Props {
  params: { id: string }
}

interface DealState {
  listingId: string | null   // 刊登可能已被賣家刪除，此時用快照欄位
  listingTitle: string
  sellerId: string
  buyerConfirmedAt: string | null
  sellerConfirmedAt: string | null
}

export default function ConversationPage({ params }: Props) {
  const supabase = createClient()
  const [messages, setMessages] = useState<Message[]>([])
  const [me, setMe] = useState<Profile | null>(null)
  const [content, setContent] = useState('')
  const [sending, setSending] = useState(false)
  const [deal, setDeal] = useState<DealState | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  // null = 尚未查詢；false = 還沒評價；true = 已評價
  const [hasReviewed, setHasReviewed] = useState<boolean | null>(null)
  const [showReviewModal, setShowReviewModal] = useState(false)
  const [reviewRating, setReviewRating] = useState(0)
  const [reviewComment, setReviewComment] = useState('')
  const [submittingReview, setSubmittingReview] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  // realtime callback 是在 effect 建立時綁定的，用 ref 拿到最新的自己 id
  const myIdRef = useRef<string | null>(null)

  // 自己送出的訊息直接塞進畫面（不等 realtime），realtime 再收到同一筆時靠 id 去重
  const appendMessage = (msg: Message) => {
    setMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg])
  }

  // 送出並立刻顯示；select 帶回 sender 讓新訊息的頭像/名稱正常
  const insertMessage = async (content: string) => {
    if (!me) return { error: new Error('尚未登入') }
    const { data, error } = await supabase
      .from('messages')
      .insert({ conversation_id: params.id, sender_id: me.id, content })
      .select('*, sender:profiles(id, username, avatar_url)')
      .single()
    if (data) appendMessage(data as Message)
    return { error }
  }

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      myIdRef.current = user.id

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()
      setMe(profile)

      const { data } = await supabase
        .from('messages')
        .select('*, sender:profiles(id, username, avatar_url)')
        .eq('conversation_id', params.id)
        .order('created_at')
      if (data) setMessages(data as Message[])

      await supabase
        .from('messages')
        .update({ is_read: true })
        .eq('conversation_id', params.id)
        .neq('sender_id', user.id)
        .eq('is_read', false)

      const { data: conv } = await supabase
        .from('conversations')
        .select(`
          id, listing_id, buyer_confirmed_at, seller_confirmed_at, seller_id, listing_title,
          listing:listings(id, title, user_id)
        `)
        .eq('id', params.id)
        .single()

      // 刊登被刪除後改用快照欄位（seller_id / listing_title 在雙方確認時寫入）
      if (conv) {
        const listing = conv.listing as any
        const sellerId = listing?.user_id ?? conv.seller_id
        if (sellerId) {
          setDeal({
            listingId: listing?.id ?? null,
            listingTitle: listing?.title ?? conv.listing_title ?? '（刊登已刪除）',
            sellerId,
            buyerConfirmedAt: conv.buyer_confirmed_at,
            sellerConfirmedAt: conv.seller_confirmed_at,
          })
        }

        // 雙方已確認的交易才需要知道自己評過了沒
        if (conv.buyer_confirmed_at && conv.seller_confirmed_at) {
          const { data: myReview } = await supabase
            .from('reviews')
            .select('id')
            .eq('conversation_id', params.id)
            .eq('reviewer_id', user.id)
            .maybeSingle()
          setHasReviewed(!!myReview)
        } else {
          setHasReviewed(false)
        }
      }
    }
    init()

    const channel = supabase
      .channel(`messages:${params.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${params.id}`,
      }, async (payload) => {
        const { data } = await supabase
          .from('messages')
          .select('*, sender:profiles(id, username, avatar_url)')
          .eq('id', payload.new.id)
          .single()
        if (data) appendMessage(data as Message)

        // 人正在對話頁裡，對方的新訊息直接標已讀（對方畫面會透過 UPDATE 事件看到「已讀」）
        if (data && myIdRef.current && data.sender_id !== myIdRef.current) {
          await supabase
            .from('messages')
            .update({ is_read: true })
            .eq('id', data.id)
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${params.id}`,
      }, (payload) => {
        // 對方把訊息標已讀時，同步到畫面上的「已讀」標記
        setMessages(prev => prev.map(m =>
          m.id === payload.new.id ? { ...m, is_read: payload.new.is_read } : m
        ))
      })
      .subscribe()

    // 同時監聽 conversations 的更新（對方確認時即時反映）
    const dealChannel = supabase
      .channel(`conversation:${params.id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'conversations',
        filter: `id=eq.${params.id}`,
      }, (payload) => {
        setDeal(prev => prev ? {
          ...prev,
          buyerConfirmedAt: payload.new.buyer_confirmed_at,
          sellerConfirmedAt: payload.new.seller_confirmed_at,
        } : prev)
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
      supabase.removeChannel(dealChannel)
    }
  }, [params.id, supabase])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async () => {
    if (!content.trim() || !me || sending) return
    setSending(true)
    try {
      const { error } = await insertMessage(content.trim())
      if (!error) setContent('')
    } finally {
      setSending(false)
    }
  }

  // 只在「自己最後一則已被對方讀取的訊息」旁顯示已讀，跟 LINE 一樣
  const lastReadMineId = [...messages].reverse().find(m => m.sender_id === me?.id && m.is_read)?.id

  const isSeller = me && deal && me.id === deal.sellerId
  const myConfirmedAt = isSeller ? deal?.sellerConfirmedAt : deal?.buyerConfirmedAt
  const bothConfirmed = !!(deal?.buyerConfirmedAt && deal?.sellerConfirmedAt)

  const handleConfirmDeal = async () => {
    if (!me || !deal) return
    setConfirming(true)

    // 透過 security definer RPC 確認：後端依 auth.uid() 決定角色欄位，且寫過不可覆蓋
    const now = new Date().toISOString()
    const { error } = await supabase.rpc('confirm_deal', { p_conversation_id: params.id })

    setShowConfirmModal(false)

    if (!error) {
      const otherAlreadyConfirmed = isSeller ? deal.buyerConfirmedAt : deal.sellerConfirmedAt
      setDeal(prev => prev ? {
        ...prev,
        [isSeller ? 'sellerConfirmedAt' : 'buyerConfirmedAt']: now,
      } : prev)

      const systemMsg = otherAlreadyConfirmed
        ? `🤝 雙方都已確認，交易完成！可以互相評分囉`
        : `✅ ${me.username} 已標記這筆交易完成，等待對方確認`

      await insertMessage(systemMsg)
    }
    setConfirming(false)
  }

  const handleSubmitReview = async () => {
    if (!me || reviewRating < 1 || submittingReview) return
    setSubmittingReview(true)

    const { error } = await supabase.rpc('submit_review', {
      p_conversation_id: params.id,
      p_rating: reviewRating,
      p_comment: reviewComment.trim() || null,
    })

    if (!error) {
      setHasReviewed(true)
      setShowReviewModal(false)
      await insertMessage(`⭐ ${me.username} 給了 ${reviewRating} 星評價`)
    } else {
      alert('評價送出失敗，請稍後再試')
    }
    setSubmittingReview(false)
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-4rem)] max-w-2xl flex-col">
      {deal && (
        <div className="sticky top-16 z-10 border-b border-scoreboard/10 bg-chalk px-4 py-2.5">
          {deal.listingId ? (
            <Link href={`/listings/${deal.listingId}`} className="text-sm font-semibold text-clay hover:underline dark:text-clay-light">
              關於：{deal.listingTitle}
            </Link>
          ) : (
            <span className="text-sm font-semibold text-dugout">關於：{deal.listingTitle}</span>
          )}
          <div className="mt-1.5 flex items-center justify-between">
            <div className="flex items-center gap-3 text-xs text-dugout">
              <span className="flex items-center gap-1">
                {deal.buyerConfirmedAt ? (
                  <CheckCircle2 size={13} className="text-field" />
                ) : (
                  <Circle size={13} className="text-dugout/30" />
                )}
                買家確認
              </span>
              <span className="flex items-center gap-1">
                {deal.sellerConfirmedAt ? (
                  <CheckCircle2 size={13} className="text-field" />
                ) : (
                  <Circle size={13} className="text-dugout/30" />
                )}
                賣家確認
              </span>
            </div>

            {bothConfirmed ? (
              hasReviewed === false ? (
                <button
                  className="flex items-center gap-1 rounded-md border-2 border-gold px-3 py-1 text-xs font-bold text-gold hover:bg-gold/10"
                  onClick={() => setShowReviewModal(true)}
                >
                  <Star size={13} className="fill-gold" />
                  給對方評分
                </button>
              ) : (
                <span className="flex items-center gap-1 text-xs font-bold text-gold">
                  <Star size={14} className="fill-gold" />
                  {hasReviewed ? '交易完成，已評價' : '交易完成'}
                </span>
              )
            ) : !myConfirmedAt ? (
              <button
                className="rounded-md border-2 border-field px-3 py-1 text-xs font-bold text-field hover:bg-field/10 dark:border-clay-light dark:text-clay-light dark:hover:bg-clay-light/10"
                onClick={() => setShowConfirmModal(true)}
                disabled={confirming}
              >
                {confirming ? '處理中...' : '確認交易完成'}
              </button>
            ) : (
              <span className="text-xs text-dugout">等待對方確認...</span>
            )}
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4">
        {/* justify-end：訊息少時貼齊底部（靠近輸入框），像一般聊天室由下往上長 */}
        <div className="flex min-h-full flex-col justify-end space-y-3">
        {messages.map(msg => {
          const isMe = msg.sender_id === me?.id
          return (
            <div key={msg.id} className={`flex gap-2 ${isMe ? 'flex-row-reverse' : ''}`}>
              {/* 自己的訊息靠泡泡顏色就能辨識，頭像省略 */}
              {!isMe && (
                msg.sender?.avatar_url ? (
                  <Image
                    src={msg.sender.avatar_url}
                    alt={msg.sender.username}
                    width={32}
                    height={32}
                    unoptimized
                    className="h-8 w-8 flex-shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-dugout/15 text-xs font-bold text-dugout">
                    {msg.sender?.username.slice(0, 2).toUpperCase()}
                  </div>
                )
              )}
              <div className={`max-w-[70%] ${isMe ? 'items-end' : 'items-start'} flex flex-col`}>
                {msg.image_url ? (
                  // 縮圖顯示，點開新分頁看原圖
                  <a href={msg.image_url} target="_blank" rel="noreferrer">
                    <img src={msg.image_url} alt="圖片" className="max-h-48 max-w-full rounded-md" />
                  </a>
                ) : (
                  <div className={`rounded-2xl px-3 py-2 text-sm ${
                    isMe
                      ? 'bg-field text-white rounded-tr-sm'
                      : 'bg-dugout/10 text-scoreboard rounded-tl-sm'
                  }`}>
                    {msg.content}
                  </div>
                )}
                <span className="mt-0.5 text-xs text-dugout/60">
                  {isMe && msg.id === lastReadMineId && <span className="mr-1">已讀</span>}
                  {formatRelativeTime(msg.created_at)}
                </span>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
        </div>
      </div>

      <div className="border-t border-scoreboard/10 bg-surface p-3">
        <div className="flex items-center gap-2">
          <input
            className="input flex-1"
            placeholder="輸入訊息..."
            value={content}
            onChange={e => setContent(e.target.value)}
            onKeyDown={e => {
              // isComposing：中文輸入法選字的 Enter 不能當送出
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && !sending) {
                sendMessage()
              }
            }}
          />

          <button
            className="btn-primary p-2"
            onClick={sendMessage}
            disabled={sending || !content.trim()}
          >
            <Send size={16} />
          </button>
        </div>
      </div>

      {showConfirmModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-scoreboard/50 p-4"
          onClick={() => !confirming && setShowConfirmModal(false)}
        >
          <div
            className="w-full max-w-sm rounded-lg bg-surface p-5 shadow-lg"
            onClick={e => e.stopPropagation()}
          >
            <h2 className="text-base font-bold text-scoreboard">確認交易完成？</h2>
            <p className="mt-2 text-sm text-dugout">
              確認後無法取消。雙方都確認後，交易完成次數 +1，並可互相給 1–5 星評價。
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                className="rounded-md px-4 py-1.5 text-sm text-dugout hover:bg-dugout/10"
                onClick={() => setShowConfirmModal(false)}
                disabled={confirming}
              >
                取消
              </button>
              <button
                className="rounded-md bg-field px-4 py-1.5 text-sm font-bold text-white hover:bg-field/90 disabled:opacity-60"
                onClick={handleConfirmDeal}
                disabled={confirming}
              >
                {confirming ? '處理中...' : '確認'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showReviewModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-scoreboard/50 p-4"
          onClick={() => !submittingReview && setShowReviewModal(false)}
        >
          <div
            className="w-full max-w-sm rounded-lg bg-surface p-5 shadow-lg"
            onClick={e => e.stopPropagation()}
          >
            <h2 className="text-base font-bold text-scoreboard">為這次交易評分</h2>
            <p className="mt-1 text-sm text-dugout">評價送出後無法修改</p>

            <div className="mt-3 flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map(n => (
                <button key={n} onClick={() => setReviewRating(n)} aria-label={`${n} 星`}>
                  <Star
                    size={32}
                    className={n <= reviewRating ? 'fill-gold text-gold' : 'text-dugout/30'}
                  />
                </button>
              ))}
            </div>

            <textarea
              className="input mt-3 w-full resize-none"
              rows={3}
              maxLength={300}
              placeholder="留下評語（選填）..."
              value={reviewComment}
              onChange={e => setReviewComment(e.target.value)}
            />

            <div className="mt-4 flex justify-end gap-2">
              <button
                className="rounded-md px-4 py-1.5 text-sm text-dugout hover:bg-dugout/10"
                onClick={() => setShowReviewModal(false)}
                disabled={submittingReview}
              >
                取消
              </button>
              <button
                className="rounded-md bg-field px-4 py-1.5 text-sm font-bold text-white hover:bg-field/90 disabled:opacity-60"
                onClick={handleSubmitReview}
                disabled={submittingReview || reviewRating < 1}
              >
                {submittingReview ? '送出中...' : '送出評價'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
