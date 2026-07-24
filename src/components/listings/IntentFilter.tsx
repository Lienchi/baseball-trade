'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useCallback } from 'react'
import type { ListingIntent } from '@/types'

// 徵求／出售篩選：預設都不選（顯示全部），可複選。
// 狀態存 URL 的 intent 參數（逗號分隔），球票、周邊兩個篩選列共用。
const OPTIONS: { value: ListingIntent; label: string; active: string }[] = [
  { value: 'sell', label: '出售', active: 'border-[#85B7EB] bg-[#E6F1FB] text-[#0C447C]' },
  { value: 'wanted', label: '徵求', active: 'border-[#FAC775] bg-[#FAEEDA] text-[#854F0B]' },
]

export function IntentFilter() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const selected = new Set((searchParams.get('intent') ?? '').split(',').filter(Boolean))

  const toggle = useCallback((value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    const cur = new Set((params.get('intent') ?? '').split(',').filter(Boolean))
    if (cur.has(value)) cur.delete(value)
    else cur.add(value)
    if (cur.size) params.set('intent', Array.from(cur).join(','))
    else params.delete('intent')
    params.delete('page')
    router.push(`${pathname}?${params.toString()}`)
  }, [router, pathname, searchParams])

  return (
    <div className="flex gap-2">
      {OPTIONS.map(({ value, label, active }) => (
        <button
          key={value}
          className={`flex-shrink-0 rounded-full border px-3 py-1 text-xs font-bold transition ${
            selected.has(value)
              ? active
              : 'border-scoreboard/20 text-dugout hover:border-scoreboard/40'
          }`}
          onClick={() => toggle(value)}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
