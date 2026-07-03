'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Props {
  listingId: string
}

export function DeleteListingButton({ listingId }: Props) {
  const supabase = createClient()
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleDelete = async () => {
    if (!confirm('確定要刪除這個刊登嗎？此操作無法復原。')) return
    setLoading(true)
    const { error } = await supabase.from('listings').delete().eq('id', listingId)
    if (error) {
      alert('刪除失敗，請稍後再試')
      setLoading(false)
      return
    }
    router.push('/')
  }

  return (
    <button
      onClick={handleDelete}
      disabled={loading}
      className="w-full rounded-md border-2 border-clay/20 px-5 py-2.5 text-sm font-bold text-clay transition hover:bg-clay/5 disabled:opacity-40"
    >
      {loading ? '刪除中...' : '刪除刊登'}
    </button>
  )
}
