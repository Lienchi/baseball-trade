'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { findOrCreateConversation } from '@/lib/conversation'
import { MessageCircle } from 'lucide-react'

interface Props {
  listingId: string
  sellerId: string
}

export function ContactSellerButton({ listingId, sellerId }: Props) {
  const supabase = createClient()
  const router = useRouter()
  const [loading, setLoading] = useState(false)

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

    const { id, error } = await findOrCreateConversation(supabase, listingId, sellerId)
    if (id) {
      router.push(`/messages/${id}`)
      return
    }

    alert(`建立對話失敗，請稍後再試（${error}）`)
    setLoading(false)
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
