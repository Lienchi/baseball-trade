'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { formatRelativeTime, compressImage, storagePathFromUrl } from '@/lib/utils'
import { Send, ImageIcon, CheckCircle2, Circle, Star } from 'lucide-react'
import { Skeleton } from '@/components/ui/Skeleton'
import { revalidatePaths } from '@/lib/revalidate'
import type { Message, Profile } from '@/types'

interface Props {
  params: { id: string }
}

// 每人每對話最多保留的照片數；超過時 rolling 刪掉自己最舊那張（省 Supabase 免費版空間）
const MAX_MY_IMAGES = 5

interface OtherUser {
  id: string
  username: string
  avatar_url: string | null
  rating: number
  rating_count: number
  deal_count: number
}

interface DealState {
  listingId: string | null   // 刊登可能已被賣家刪除，此時用快照欄位
  listingTitle: string
  sellerId: string
  buyerConfirmedAt: string | null
  sellerConfirmedAt: string | null
  // null = 舊資料（修法前成交），視為可評價
  reviewEligible: boolean | null
}

export default function ConversationPage({ params }: Props) {
  const supabase = createClient()
  const [messages, setMessages] = useState<Message[]>([])
  const [loadingMessages, setLoadingMessages] = useState(true)
  const [me, setMe] = useState<Profile | null>(null)
  const [content, setContent] = useState('')
  const [sending, setSending] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [imageError, setImageError] = useState('')
  const [deal, setDeal] = useState<DealState | null>(null)
  const [otherUser, setOtherUser] = useState<OtherUser | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  // null = 尚未查詢；false = 還沒評價；true = 已評價
  const [hasReviewed, setHasReviewed] = useState<boolean | null>(null)
  const [showReviewModal, setShowReviewModal] = useState(false)
  const [reviewRating, setReviewRating] = useState(0)
  const [reviewComment, setReviewComment] = useState('')
  const [submittingReview, setSubmittingReview] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const composerRef = useRef<HTMLTextAreaElement>(null)
  // realtime callback 是在 effect 建立時綁定的，用 ref 拿到最新的自己 id
  const myIdRef = useRef<string | null>(null)
  // rolling 刪掉的圖片訊息 id：手機選圖器回來的 visibilitychange 會觸發 catchUp 重抓全部，
  // 若那次 SELECT 早於 DELETE commit 會把已刪的圖抓回來復活，故所有寫入畫面處都濾掉這些 id
  const deletedIdsRef = useRef<Set<string>>(new Set())

  // catchUp / init 用：把整批訊息寫進畫面前先濾掉已刪 id
  const setMessagesFiltered = (rows: Message[]) => {
    setMessages(rows.filter(m => !deletedIdsRef.current.has(m.id)))
  }

  // 自己送出的訊息直接塞進畫面（不等 realtime），realtime 再收到同一筆時靠 id 去重
  const appendMessage = (msg: Message) => {
    if (deletedIdsRef.current.has(msg.id)) return
    setMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg])
  }

  // 送出並立刻顯示；select 帶回 sender 讓新訊息的頭像/名稱正常
  // isSystem：確認/評價產生的系統訊息，不算進成交判定的對話門檻
  const insertMessage = async (content: string, isSystem = false, imageUrl?: string) => {
    if (!me) return { error: new Error('尚未登入') }
    const { data, error } = await supabase
      .from('messages')
      .insert({ conversation_id: params.id, sender_id: me.id, content, is_system: isSystem, image_url: imageUrl ?? null })
      .select('*, sender:profiles(id, username, avatar_url)')
      .single()
    if (data) appendMessage(data as Message)
    return { error }
  }

  // 傳新圖後把自己在這段對話的圖片數壓回 MAX_MY_IMAGES：刪最舊的（storage 物件 + 訊息 row）。
  // 盡力而為，失敗不擋主流程——cron 過期清理最終也會回收殘留圖檔。
  const pruneMyImages = async () => {
    if (!me) return
    // 從 DB 撈權威清單（含剛插入那張），不靠可能過期的 messages state
    const { data: mine } = await supabase
      .from('messages')
      .select('id, image_url')
      .eq('conversation_id', params.id)
      .eq('sender_id', me.id)
      .not('image_url', 'is', null)
      .order('created_at')
    if (!mine) return
    const excess = mine.length - MAX_MY_IMAGES
    if (excess <= 0) return
    const victims = mine.slice(0, excess) // 升序，前面的最舊
    const paths = victims
      .map(m => (m.image_url ? storagePathFromUrl(m.image_url) : null))
      .filter((p): p is string => !!p)
    if (paths.length > 0) await supabase.storage.from('images').remove(paths)
    const ids = victims.map(m => m.id)
    ids.forEach(id => deletedIdsRef.current.add(id))
    await supabase.from('messages').delete().in('id', ids)
    setMessages(prev => prev.filter(m => !ids.includes(m.id)))
  }

  const sendImage = async (file: File) => {
    if (!me || uploadingImage) return
    setUploadingImage(true)
    setImageError('')
    try {
      // 對話照片 800px / webp 就夠看票號座位，壓縮後多落在 100–150KB
      const { blob, ext, contentType } = await compressImage(file, 800, 0.75)
      if (blob.size > 500 * 1024) {
        setImageError('圖片太大，請換一張或先裁切')
        return
      }
      // storage policy 依路徑中的 uid 判權限，第一層必須是 messages/{me.id}
      const path = `messages/${me.id}/${params.id}-${Date.now()}.${ext}`
      const { error } = await supabase.storage
        .from('images')
        .upload(path, blob, { contentType, cacheControl: '31536000' })
      if (error) {
        // 手機開不了 devtools，把實際錯誤帶進畫面才好回報
        setImageError(`圖片上傳失敗：${error.message}`)
        return
      }
      const { data: { publicUrl } } = supabase.storage.from('images').getPublicUrl(path)
      const { error: insertError } = await insertMessage('', false, publicUrl)
      if (insertError) {
        setImageError(`訊息寫入失敗：${insertError.message}`)
        return
      }
      await pruneMyImages()
    } catch (err) {
      const detail = err instanceof Error ? err.message : '不支援的圖片格式'
      setImageError(`圖片處理失敗：${detail}`)
    } finally {
      setUploadingImage(false)
    }
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
      if (data) setMessagesFiltered(data as Message[])
      setLoadingMessages(false)

      await supabase
        .from('messages')
        .update({ is_read: true })
        .eq('conversation_id', params.id)
        .neq('sender_id', user.id)
        .eq('is_read', false)

      // 對話標頭顯示對方的頭像、名稱與信譽（成交數、評價）
      const { data: parts } = await supabase
        .from('conversation_participants')
        .select('user_id')
        .eq('conversation_id', params.id)
      const otherId = (parts ?? []).map(p => p.user_id).find(id => id !== user.id)
      if (otherId) {
        const { data: other } = await supabase
          .from('profiles')
          .select('id, username, avatar_url, rating, rating_count, deal_count')
          .eq('id', otherId)
          .single()
        if (other) setOtherUser(other)
      }

      const { data: conv } = await supabase
        .from('conversations')
        .select(`
          id, listing_id, buyer_confirmed_at, seller_confirmed_at, seller_id, listing_title, review_eligible,
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
            reviewEligible: conv.review_eligible,
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

    // 補抓漏掉的訊息：realtime 斷線重連或手機切回前景時，把離線期間的訊息撈回來
    const catchUp = async () => {
      const { data } = await supabase
        .from('messages')
        .select('*, sender:profiles(id, username, avatar_url)')
        .eq('conversation_id', params.id)
        .order('created_at')
      if (data) setMessagesFiltered(data as Message[])
      if (myIdRef.current) {
        await supabase
          .from('messages')
          .update({ is_read: true })
          .eq('conversation_id', params.id)
          .neq('sender_id', myIdRef.current)
          .eq('is_read', false)
      }
    }

    const onVisible = () => {
      if (document.visibilityState === 'visible') catchUp()
    }
    document.addEventListener('visibilitychange', onVisible)

    let hadSubscribed = false
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
      .on('postgres_changes', {
        event: 'DELETE',
        schema: 'public',
        table: 'messages',
        // DELETE 事件的 payload.old 在預設 replica identity 下只有主鍵，
        // 無法用 conversation_id 過濾（會收不到），故不加 filter，改用 id 比對移除
      }, (payload) => {
        const id = (payload.old as { id?: string })?.id
        if (id) setMessages(prev => prev.filter(m => m.id !== id))
      })
      .subscribe((status, err) => {
        // 重連成功時補抓斷線期間的訊息；失敗時留下線索方便排查
        if (status === 'SUBSCRIBED') {
          if (hadSubscribed) catchUp()
          hadSubscribed = true
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error('[messages realtime]', status, err?.message)
        }
      })

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
          reviewEligible: payload.new.review_eligible ?? prev.reviewEligible,
        } : prev)
      })
      .subscribe()

    return () => {
      document.removeEventListener('visibilitychange', onVisible)
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
      if (!error) {
        setContent('')
        // 清空後把 textarea 高度縮回單行
        if (composerRef.current) composerRef.current.style.height = 'auto'
      }
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

      // 雙方都確認後，trigger 已寫入評價資格，抓回來決定評分入口是否顯示
      let reviewEligible: boolean | null = deal.reviewEligible
      if (otherAlreadyConfirmed) {
        const { data: conv } = await supabase
          .from('conversations')
          .select('review_eligible')
          .eq('id', params.id)
          .single()
        reviewEligible = conv?.review_eligible ?? null
        setDeal(prev => prev ? { ...prev, reviewEligible } : prev)
      }

      const systemMsg = otherAlreadyConfirmed
        ? (reviewEligible !== false
            ? `🤝 雙方都已確認，交易完成！可以互相評分囉`
            : `🤝 雙方都已確認，交易完成！`)
        : `✅ ${me.username} 已標記這筆交易完成，等待對方確認`

      await insertMessage(systemMsg, true)
      // 成交數顯示在雙方個人頁，刷 ISR 快取
      if (otherAlreadyConfirmed) {
        revalidatePaths(`/users/${me.id}`, ...(otherUser ? [`/users/${otherUser.id}`] : []))
      }
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
      await insertMessage(`⭐ ${me.username} 給了 ${reviewRating} 星評價`, true)
      // 評價顯示在對方個人頁，刷 ISR 快取
      if (otherUser) revalidatePaths(`/users/${otherUser.id}`)
    } else {
      alert('評價送出失敗，請稍後再試')
    }
    setSubmittingReview(false)
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-4rem)] max-w-2xl flex-col">
      {(otherUser || deal) && (
        <div className="sticky top-16 z-10 border-b border-scoreboard/10 bg-chalk px-4 py-2.5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              {otherUser && (
                <Link href={`/users/${otherUser.id}`} className="group flex items-center gap-2">
                  {otherUser.avatar_url ? (
                    <Image
                      src={otherUser.avatar_url}
                      alt={otherUser.username}
                      width={36}
                      height={36}
                      unoptimized
                      className="h-9 w-9 flex-shrink-0 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-field text-xs font-bold text-white">
                      {otherUser.username.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-scoreboard group-hover:underline">
                      {otherUser.username}
                    </p>
                    <p className="flex items-center gap-1.5 text-xs text-dugout">
                      <span>成交 {otherUser.deal_count ?? 0} 次</span>
                      <span className="flex items-center gap-0.5">
                        <Star size={11} className="fill-gold text-gold" />
                        {(otherUser.rating_count ?? 0) > 0
                          ? `${Number(otherUser.rating).toFixed(1)}（${otherUser.rating_count}）`
                          : '尚無評價'}
                      </span>
                    </p>
                  </div>
                </Link>
              )}
            </div>

            {deal && (
            <div className="flex flex-shrink-0 flex-col items-end gap-1.5">
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
              // reviewEligible === false（隱藏判定未達標）時不給評分入口，只顯示交易完成
              hasReviewed === false && deal.reviewEligible !== false ? (
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
            )}
          </div>

          {/* 獨立一行吃滿寬度，標題再長也完整換行顯示 */}
          {deal && (
            deal.listingId ? (
              <Link href={`/listings/${deal.listingId}`} className="mt-1.5 block break-words text-sm font-semibold text-clay hover:underline dark:text-clay-light">
                關於：{deal.listingTitle}
              </Link>
            ) : (
              <span className="mt-1.5 block break-words text-sm font-semibold text-dugout">關於：{deal.listingTitle}</span>
            )
          )}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4">
        {/* justify-end：訊息少時貼齊底部（靠近輸入框），像一般聊天室由下往上長 */}
        <div className="flex min-h-full flex-col justify-end space-y-3">
        {/* 骨架屏：模擬左右交錯的訊息泡泡 */}
        {loadingMessages && messages.length === 0 && (
          <>
            <div className="flex gap-2">
              <Skeleton className="h-8 w-8 flex-shrink-0 rounded-full" />
              <Skeleton className="h-10 w-48 rounded-2xl" />
            </div>
            <div className="flex flex-row-reverse gap-2">
              <Skeleton className="h-10 w-40 rounded-2xl" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-8 w-8 flex-shrink-0 rounded-full" />
              <Skeleton className="h-10 w-32 rounded-2xl" />
            </div>
          </>
        )}
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
                ) : !msg.content && !msg.is_system ? (
                  // 圖片過期清理後留下的空訊息（image_url 已被 cron 設 null）
                  <div className="rounded-2xl border border-dashed border-dugout/30 px-3 py-2 text-xs italic text-dugout/60">
                    圖片已過期
                  </div>
                ) : (
                  <div className={`whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-sm ${
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
        {imageError && (
          <p className="mb-2 text-xs text-wei">{imageError}</p>
        )}
        <div className="flex items-end gap-2">
          <label
            className={`flex-shrink-0 self-end pb-2 ${
              uploadingImage
                ? 'cursor-not-allowed text-dugout/25'
                : 'cursor-pointer text-dugout/50 hover:text-clay'
            }`}
            title="傳送照片"
          >
            <ImageIcon size={20} />
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={uploadingImage}
              onChange={e => {
                const file = e.target.files?.[0]
                if (file) sendImage(file)
                // 清空 value 才能連續選同一張重試
                e.target.value = ''
              }}
            />
          </label>
          <textarea
            ref={composerRef}
            className="input max-h-32 flex-1 resize-none"
            rows={1}
            placeholder="輸入訊息..."
            value={content}
            onChange={e => {
              setContent(e.target.value)
              // 隨內容自動長高，最多 max-h-32
              e.target.style.height = 'auto'
              e.target.style.height = `${Math.min(e.target.scrollHeight, 128)}px`
            }}
            onKeyDown={e => {
              // 觸控裝置 Enter 一律換行，送出靠按鈕
              if (window.matchMedia('(pointer: coarse)').matches) return
              // isComposing：中文輸入法選字的 Enter 不能當送出
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && !sending) {
                e.preventDefault()
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
