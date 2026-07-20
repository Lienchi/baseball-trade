'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { storagePathFromUrl } from '@/lib/utils'
import { revalidatePaths } from '@/lib/revalidate'

interface Props {
  listingId: string
  ownerId: string
  listingType: 'ticket' | 'merchandise'
  isAdmin?: boolean  // 管理者刪別人的文章時，確認文案強調作者不會收到說明（日常處置應優先用下架）
}

export function DeleteListingButton({ listingId, ownerId, listingType, isAdmin = false }: Props) {
  const supabase = createClient()
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleDelete = async () => {
    const message = isAdmin
      ? '確定要永久刪除這個刊登嗎？資料與圖片將直接消失，作者不會收到任何說明。若要讓作者知道原因，請改用「下架刊登」。'
      : '確定要刪除這個刊登嗎？此操作無法復原。'
    if (!confirm(message)) return
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
      // 連 -thumb 縮圖一起清（不存在的路徑 remove 會略過，不影響其他檔案）
      .flatMap(p => [p, p.replace(/\.(\w+)$/, '-thumb.$1')])
    if (paths.length > 0) {
      // 清檔失敗不擋流程（刊登已刪成功），最多留下孤兒檔案
      await supabase.storage.from('images').remove(paths)
    }

    // 刪除後詳情頁、個人頁、首頁、列表頁都要刷；await 完再導回首頁才拿得到新頁
    await revalidatePaths(`/listings/${listingId}`, `/users/${ownerId}`, '/', listingType === 'ticket' ? '/tickets' : '/merchandise')
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
