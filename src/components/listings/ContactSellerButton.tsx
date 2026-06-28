'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
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

    const { data: existing } = await supabase
      .from('conversation_participants')
      .select('conversation_id')
      .eq('user_id', user.id)

    if (existing && existing.length > 0) {
      const conversationIds = existing.map(e => e.conversation_id)
      const { data: shared } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', sellerId)
        .in('conversation_id', conversationIds)

      if (shared && shared.length > 0) {
        router.push(`/messages/${shared[0].conversation_id}`)
        return
      }
    }

    const { data: convId } = await supabase.rpc('create_conversation', {
      p_listing_id: listingId,
      p_seller_id: sellerId,
    })

    if (convId) {
      router.push(`/messages/${convId}`)
    }

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
