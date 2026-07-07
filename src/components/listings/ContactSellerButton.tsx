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

    const { data: existingId } = await supabase.rpc('get_existing_conversation', {
      p_seller_id: sellerId,
      p_listing_id: listingId,
    })

    if (existingId) {
      router.push(`/messages/${existingId}`)
      return
    }

    const { data: convId, error } = await supabase.rpc('create_conversation', {
      p_listing_id: listingId,
      p_seller_id: sellerId,
    })

    if (convId) {
      router.push(`/messages/${convId}`)
      return
    }

    alert(`建立對話失敗，請稍後再試${error ? `（${error.message}）` : ''}`)
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
