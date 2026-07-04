'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { storagePathFromUrl } from '@/lib/utils'

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

    // 先取得圖片清單，刪除資料列成功後把 Storage 檔案一併清掉（避免孤兒檔案佔空間）
    const { data: listing } = await supabase
      .from('listings')
      .select('images')
      .eq('id', listingId)
      .single()

    const { error } = await supabase.from('listings').delete().eq('id', listingId)
    if (error) {
      alert('刪除失敗，請稍後再試')
      setLoading(false)
      return
    }

    const paths = ((listing?.images ?? []) as string[])
      .map(storagePathFromUrl)
      .filter((p): p is string => p !== null)
    if (paths.length > 0) {
      // 清檔失敗不擋流程（刊登已刪成功），最多留下孤兒檔案
      await supabase.storage.from('images').remove(paths)
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
