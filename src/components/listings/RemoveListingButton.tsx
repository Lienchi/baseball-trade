'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { ListingStatus } from '@/types'
import { revalidatePaths } from '@/lib/revalidate'

// 管理者下架（soft delete）：status 改 removed 並記錄原因，作者在自己的頁面看得到。
// 真刪另有 DeleteListingButton；removed 狀態的變更由 DB trigger 限管理員。
const REMOVE_REASONS = ['場次已過期', '違規刊登', '重複刊登', '疑似黃牛加價轉售'] as const
const OTHER = '其他'

interface Props {
  listingId: string
  ownerId: string
  listingType: 'ticket' | 'merchandise'
  status: ListingStatus
}

export function RemoveListingButton({ listingId, ownerId, listingType, status }: Props) {
  const supabase = createClient()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState<string>(REMOVE_REASONS[0])
  const [customReason, setCustomReason] = useState('')
  const [loading, setLoading] = useState(false)

  const handleRestore = async () => {
    if (!confirm('確定要解除下架、恢復此刊登嗎？')) return
    setLoading(true)
    const { error } = await supabase
      .from('listings')
      .update({ status: 'active', removed_reason: null, removed_at: null })
      .eq('id', listingId)
    if (error) alert('解除下架失敗，請稍後再試')
    else revalidatePaths(`/users/${ownerId}`, '/', listingType === 'ticket' ? '/tickets' : '/merchandise')
    router.refresh()
    setLoading(false)
  }

  const handleRemove = async () => {
    const finalReason = reason === OTHER ? customReason.trim() : reason
    if (!finalReason) {
      alert('請填寫下架原因')
      return
    }
    setLoading(true)
    const { error } = await supabase
      .from('listings')
      .update({
        status: 'removed',
        removed_reason: finalReason,
        removed_at: new Date().toISOString(),
      })
      .eq('id', listingId)
    if (error) {
      alert('下架失敗，請稍後再試')
      setLoading(false)
      return
    }
    revalidatePaths(`/users/${ownerId}`, '/', listingType === 'ticket' ? '/tickets' : '/merchandise')
    setOpen(false)
    router.refresh()
    setLoading(false)
  }

  if (status === 'removed') {
    return (
      <button
        onClick={handleRestore}
        disabled={loading}
        className="w-full rounded-md border-2 border-field/30 px-5 py-2.5 text-sm font-bold text-field transition hover:bg-field/5 disabled:opacity-40"
      >
        {loading ? '處理中...' : '解除下架'}
      </button>
    )
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full rounded-md border-2 border-clay/20 px-5 py-2.5 text-sm font-bold text-clay transition hover:bg-clay/5"
      >
        下架刊登
      </button>
    )
  }

  return (
    <div className="space-y-2 rounded-md border-2 border-clay/20 p-3">
      <p className="text-sm font-bold text-scoreboard">下架原因（作者會看到）</p>
      <select
        value={reason}
        onChange={e => setReason(e.target.value)}
        className="w-full rounded-md border border-scoreboard/20 bg-transparent px-3 py-2 text-sm text-dugout"
      >
        {[...REMOVE_REASONS, OTHER].map(r => (
          <option key={r} value={r}>{r}</option>
        ))}
      </select>
      {reason === OTHER && (
        <input
          type="text"
          value={customReason}
          onChange={e => setCustomReason(e.target.value)}
          placeholder="請輸入原因"
          maxLength={100}
          className="w-full rounded-md border border-scoreboard/20 bg-transparent px-3 py-2 text-sm text-dugout"
        />
      )}
      <div className="flex gap-2">
        <button
          onClick={handleRemove}
          disabled={loading}
          className="flex-1 rounded-md bg-clay px-4 py-2 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-40"
        >
          {loading ? '處理中...' : '確認下架'}
        </button>
        <button
          onClick={() => setOpen(false)}
          disabled={loading}
          className="flex-1 rounded-md border border-scoreboard/20 px-4 py-2 text-sm font-bold text-dugout transition hover:bg-scoreboard/5 disabled:opacity-40"
        >
          取消
        </button>
      </div>
    </div>
  )
}
