'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { Search, X } from 'lucide-react'
import { IntentFilter } from '@/components/listings/IntentFilter'
import { TeamFilter } from '@/components/listings/TeamFilter'

export function MerchandiseSortFilterBar() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const update = useCallback((key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value) params.set(key, value)
    else params.delete(key)
    params.delete('page')
    router.push(`${pathname}?${params.toString()}`)
  }, [router, pathname, searchParams])

  // 搜尋框自控值，才能顯示/清除 X；輸入同步寫入 URL 的 q。
  // 不直接用 searchParams 當 value，避免每次打字都等 router 更新造成延遲/游標跳動；
  // 改用 effect 跟著 URL 校正，列表那邊按「清除篩選」時這裡才會一起清空。
  const urlQ = searchParams.get('q') ?? ''
  const [q, setQ] = useState(urlQ)
  useEffect(() => { setQ(urlQ) }, [urlQ])
  const onSearch = (v: string) => { setQ(v); update('q', v) }

  return (
    <div className="space-y-3">
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-dugout/50" />
          <input
            className={`input pl-8 ${q ? 'pr-8' : ''}`}
            placeholder="搜尋標題..."
            value={q}
            onChange={e => onSearch(e.target.value)}
          />
          {q && (
            <button
              type="button"
              aria-label="清除搜尋"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-dugout/50 hover:text-clay"
              onClick={() => onSearch('')}
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* 徵求／出售：預設不選（全部），可複選（清除全部在列表的「共 N 筆」那行） */}
      <IntentFilter />

      {/* 球隊：可複選，窄螢幕橫向滑動 */}
      <TeamFilter />
    </div>
  )
}
