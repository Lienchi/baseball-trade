'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { startConversationWithMessage } from '@/lib/conversation'

interface Props {
  listingId: string
  otherUserId: string
  senderId: string
  placeholder?: string
  onCancel: () => void
}

// 展開式首訊輸入框：送出時才建立對話＋寫入第一則訊息，
// 取代「點聯絡按鈕就先建對話」的舊流程（避免留下空對話）
export function StartChatComposer({ listingId, otherUserId, senderId, placeholder, onCancel }: Props) {
  const supabase = createClient()
  const router = useRouter()
  const [content, setContent] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  const handleSend = async () => {
    if (!content.trim() || sending) return
    setSending(true)
    setError('')
    const { id, error: err } = await startConversationWithMessage(
      supabase, listingId, otherUserId, senderId, content.trim()
    )
    if (id) { router.push(`/messages/${id}`); return }
    setError(`傳送失敗，請稍後再試（${err}）`)
    setSending(false)
  }

  return (
    <div className="mt-2">
      <textarea
        className="input h-auto w-full resize-none"
        rows={3}
        placeholder={placeholder ?? '想跟對方說什麼...'}
        value={content}
        autoFocus
        onChange={e => setContent(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Escape') onCancel()
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSend()
        }}
      />
      {error && <p className="mt-1 text-xs text-clay-dark">{error}</p>}
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          className="btn-primary flex-1 py-2"
          onClick={handleSend}
          disabled={sending || !content.trim()}
        >
          {sending ? '傳送中...' : '送出訊息'}
        </button>
        <button type="button" className="btn-secondary px-4" onClick={onCancel} disabled={sending}>
          取消
        </button>
      </div>
    </div>
  )
}
