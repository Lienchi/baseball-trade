'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { findExistingConversation } from '@/lib/conversation'
import { StartChatComposer } from '@/components/listings/StartChatComposer'
import { MessageCircle } from 'lucide-react'

interface Props {
  listingId: string
  sellerId: string
}

export function ContactSellerButton({ listingId, sellerId }: Props) {
  const supabase = createClient()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [composerFor, setComposerFor] = useState<string | null>(null) // 登入者 id，展開輸入框時記下

  const handleContact = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      router.push('/login')
      return
    }

    if (user.id === sellerId) {
      alert('這是你自己的貼文')
      setLoading(false)
      return
    }

    // 聊過就直接進聊天室；沒聊過才展開輸入框，送出首訊時才建對話
    const existingId = await findExistingConversation(supabase, listingId, sellerId)
    if (existingId) {
      router.push(`/messages/${existingId}`)
      return
    }

    setComposerFor(user.id)
    setLoading(false)
  }

  if (composerFor) {
    return (
      <StartChatComposer
        listingId={listingId}
        otherUserId={sellerId}
        senderId={composerFor}
        placeholder="想跟賣家說什麼..."
        onCancel={() => setComposerFor(null)}
      />
    )
  }

  return (
    <button
      className="btn-primary mt-4 w-full"
      onClick={handleContact}
      disabled={loading}
    >
      <MessageCircle size={16} />
      {loading ? '處理中...' : '聯絡賣家'}
    </button>
  )
}
