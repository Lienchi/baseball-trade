'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { isSuspendedUntil, formatDate } from '@/lib/utils'

// 管理者停權：寫 profiles.suspended_*，DB 層由 RLS 擋停權者的發文/留言/訊息/評價。
// 到期自動失效（判斷都是 suspended_until > now()），解除＝清空欄位。
// 欄位保護 trigger 限管理員修改，且不能停權自己。
const DURATIONS = [
  { label: '一週', days: 7 },
  { label: '一個月', days: 30 },
  { label: '無限期', days: null },
] as const

const SUSPEND_REASONS = ['黃牛加價轉售', '詐騙或詐騙嫌疑', '騷擾其他使用者', '洗版或濫發刊登'] as const
const OTHER = '其他'

interface Props {
  userId: string
  suspendedUntil: string | null
  suspendedReason: string | null
}

export function SuspendUserButton({ userId, suspendedUntil, suspendedReason }: Props) {
  const supabase = createClient()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [days, setDays] = useState<number | null>(7)
  const [reason, setReason] = useState<string>(SUSPEND_REASONS[0])
  const [customReason, setCustomReason] = useState('')
  const [loading, setLoading] = useState(false)

  const suspended = isSuspendedUntil(suspendedUntil)

  const handleLift = async () => {
    if (!confirm('確定要解除這個帳號的停權嗎？')) return
    setLoading(true)
    const { error } = await supabase
      .from('profiles')
      .update({ suspended_until: null, suspended_reason: null, suspended_at: null })
      .eq('id', userId)
    if (error) alert('解除停權失敗，請稍後再試')
    router.refresh()
    setLoading(false)
  }

  const handleSuspend = async () => {
    const finalReason = reason === OTHER ? customReason.trim() : reason
    if (!finalReason) {
      alert('請填寫停權原因')
      return
    }
    setLoading(true)
    const until = days === null
      ? 'infinity'
      : new Date(Date.now() + days * 86400_000).toISOString()
    const { error } = await supabase
      .from('profiles')
      .update({
        suspended_until: until,
        suspended_reason: finalReason,
        suspended_at: new Date().toISOString(),
      })
      .eq('id', userId)
    if (error) {
      alert('停權失敗，請稍後再試')
      setLoading(false)
      return
    }
    setOpen(false)
    router.refresh()
    setLoading(false)
  }

  if (suspended) {
    return (
      <div className="mt-3 rounded-md border-2 border-clay/30 bg-clay/5 p-3 text-sm">
        <p className="font-bold text-clay">
          停權中（{suspendedUntil === 'infinity' ? '無限期' : `至 ${formatDate(suspendedUntil!)}`}）
        </p>
        {suspendedReason && <p className="mt-1 text-clay">原因：{suspendedReason}</p>}
        <button
          onClick={handleLift}
          disabled={loading}
          className="mt-2 rounded-md border-2 border-field/30 px-4 py-1.5 text-sm font-bold text-field transition hover:bg-field/5 disabled:opacity-40"
        >
          {loading ? '處理中...' : '解除停權'}
        </button>
      </div>
    )
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-3 rounded-md border-2 border-clay/20 px-4 py-1.5 text-sm font-bold text-clay transition hover:bg-clay/5"
      >
        停權此帳號
      </button>
    )
  }

  return (
    <div className="mt-3 max-w-sm space-y-2 rounded-md border-2 border-clay/20 p-3">
      <p className="text-sm font-bold text-scoreboard">停權此帳號</p>
      <div className="flex gap-2">
        {DURATIONS.map(d => (
          <button
            key={d.label}
            onClick={() => setDays(d.days)}
            className={`flex-1 rounded-md border-2 px-3 py-1.5 text-sm font-bold transition ${
              days === d.days
                ? 'border-clay bg-clay/10 text-clay'
                : 'border-scoreboard/15 text-dugout hover:border-clay/40'
            }`}
          >
            {d.label}
          </button>
        ))}
      </div>
      <select
        value={reason}
        onChange={e => setReason(e.target.value)}
        className="w-full rounded-md border border-scoreboard/20 bg-transparent px-3 py-2 text-sm text-dugout"
      >
        {[...SUSPEND_REASONS, OTHER].map(r => (
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
          onClick={handleSuspend}
          disabled={loading}
          className="flex-1 rounded-md bg-clay px-4 py-2 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-40"
        >
          {loading ? '處理中...' : '確認停權'}
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
