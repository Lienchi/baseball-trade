'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { formatRelativeTime, compressImage } from '@/lib/utils'
import { Send, Image as ImageIcon, CheckCircle2, Circle, Star } from 'lucide-react'
import { RedactModal } from '@/components/listings/RedactModal'
import type { Message, Profile } from '@/types'

interface Props {
  params: { id: string }
}

// 一個對話最多可傳的照片數
const MAX_CONVERSATION_IMAGES = 5

interface DealState {
  listingId: string
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
  const [uploadingImage, setUploadingImage] = useState(false)
  const [imageError, setImageError] = useState('')
  // 選好檔案後先開裁切/遮蔽視窗（與刊登相同流程），確認後才上傳
  const [pendingImage, setPendingImage] = useState<File | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  const imageCount = messages.filter(m => m.image_url).length

  // 自己送出的訊息直接塞進畫面（不等 realtime），realtime 再收到同一筆時靠 id 去重
  const appendMessage = (msg: Message) => {
    setMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg])
  }

  // 送出並立刻顯示；select 帶回 sender 讓新訊息的頭像/名稱正常
  const insertMessage = async (fields: { content: string; image_url?: string }) => {
    if (!me) return { error: new Error('尚未登入') }
    const { data, error } = await supabase
      .from('messages')
      .insert({ conversation_id: params.id, sender_id: me.id, ...fields })
      .select('*, sender:profiles(id, username, avatar_url)')
      .single()
    if (data) appendMessage(data as Message)
    return { error }
  }

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

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
          id, listing_id, buyer_confirmed_at, seller_confirmed_at,
          listing:listings(id, title, user_id)
        `)
        .eq('id', params.id)
        .single()

      if (conv && conv.listing) {
        const listing = conv.listing as any
        setDeal({
          listingId: listing.id,
          listingTitle: listing.title,
          sellerId: listing.user_id,
          buyerConfirmedAt: conv.buyer_confirmed_at,
          sellerConfirmedAt: conv.seller_confirmed_at,
        })
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
      const { error } = await insertMessage({ content: content.trim() })
      if (!error) setContent('')
    } finally {
      setSending(false)
    }
  }

  const sendImage = async (file: File) => {
    if (!me || uploadingImage) return
    if (imageCount >= MAX_CONVERSATION_IMAGES) {
      setImageError(`一個對話最多 ${MAX_CONVERSATION_IMAGES} 張照片`)
      return
    }
    setUploadingImage(true)
    setImageError('')
    try {
      // 對話照片長邊壓到 600px 就夠看，載入也快
      const { blob, ext, contentType } = await compressImage(file, 600)
      // storage policy 以路徑中的 user id 判斷權限，路徑必須放 me.id（不能只放 conversation id）
      const path = `messages/${me.id}/${params.id}-${Date.now()}.${ext}`
      const { error } = await supabase.storage.from('images').upload(path, blob, { contentType })
      if (error) {
        // 手機上開不了 devtools console，把實際錯誤附在畫面訊息裡才有辦法回報除錯
        setImageError(`圖片上傳失敗：${error.message}`)
        return
      }
      const { data: { publicUrl } } = supabase.storage.from('images').getPublicUrl(path)
      const { error: insertError } = await insertMessage({ content: '[圖片]', image_url: publicUrl })
      if (insertError) setImageError(`訊息寫入失敗：${insertError.message}`)
    } catch (err) {
      const detail = err instanceof Error ? err.message : '不支援的圖片格式'
      setImageError(`圖片處理失敗：${detail}`)
    } finally {
      setUploadingImage(false)
    }
  }

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
        ? `🌟 雙方都已確認，交易完成！雙方各獲得一顆星`
        : `✅ ${me.username} 已標記這筆交易完成，等待對方確認`

      await insertMessage({ content: systemMsg })
    }
    setConfirming(false)
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-4rem)] max-w-2xl flex-col">
      {deal && (
        <div className="sticky top-16 z-10 border-b border-scoreboard/10 bg-chalk px-4 py-2.5">
          <Link href={`/listings/${deal.listingId}`} className="text-xs font-medium text-clay hover:underline dark:text-clay-light">
            關於：{deal.listingTitle}
          </Link>
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
              <span className="flex items-center gap-1 text-xs font-bold text-gold">
                <Star size={14} className="fill-gold" />
                交易完成，已獲得星星
              </span>
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
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-dugout/15 text-xs font-bold text-dugout">
                {msg.sender?.username.slice(0, 2).toUpperCase()}
              </div>
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
        <div className="flex items-center gap-2">
          <label
            className={
              uploadingImage || imageCount >= MAX_CONVERSATION_IMAGES
                ? 'cursor-not-allowed text-dugout/25'
                : 'cursor-pointer text-dugout/50 hover:text-clay'
            }
            title={imageCount >= MAX_CONVERSATION_IMAGES ? `一個對話最多 ${MAX_CONVERSATION_IMAGES} 張照片` : '傳送照片'}
          >
            <ImageIcon size={20} />
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={uploadingImage || imageCount >= MAX_CONVERSATION_IMAGES}
              onChange={e => {
                const file = e.target.files?.[0]
                // 先開裁切/遮蔽視窗，確認後才上傳
                if (file) setPendingImage(file)
                // 清空 value，才能連續選同一張檔案重試
                e.target.value = ''
              }}
            />
          </label>

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

      {pendingImage && (
        <RedactModal
          file={pendingImage}
          onCancel={() => setPendingImage(null)}
          onConfirm={blob => {
            setPendingImage(null)
            sendImage(new File([blob], `message-${Date.now()}.png`, { type: blob.type || 'image/png' }))
          }}
        />
      )}

      {showConfirmModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-scoreboard/50 p-4"
          onClick={() => !confirming && setShowConfirmModal(false)}
        >
          <div
            className="w-full max-w-sm rounded-lg bg-white p-5 shadow-lg"
            onClick={e => e.stopPropagation()}
          >
            <h2 className="text-base font-bold text-scoreboard">確認交易完成？</h2>
            <p className="mt-2 text-sm text-dugout">
              確認後無法取消。雙方都確認後，交易即完成並各獲得一顆星。
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
    </div>
  )
}
