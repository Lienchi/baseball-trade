'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useCallback } from 'react'
import { Search } from 'lucide-react'
import { TEAM_FILTER_ORDER, getTeamShortName } from '@/types'
import { IntentFilter } from '@/components/listings/IntentFilter'

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

  const currentTeam = searchParams.get('team') ?? ''

  return (
    <div className="space-y-3">
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-dugout/50" />
          <input
            className="input pl-8"
            placeholder="搜尋標題..."
            defaultValue={searchParams.get('q') ?? ''}
            onChange={e => update('q', e.target.value)}
          />
        </div>
      </div>

      {/* 徵求／出售：預設不選（全部），可複選 */}
      <IntentFilter />

      {/* 球隊按鈕：固定一列，窄螢幕可橫向滑動 */}
      <div className="scrollbar-none flex gap-2 overflow-x-auto">
        <button
          className={`flex-shrink-0 rounded-full border px-3 py-1 text-xs font-bold transition ${
            currentTeam === ''
              ? 'border-scoreboard bg-scoreboard text-chalk'
              : 'border-scoreboard/20 text-dugout hover:border-scoreboard/40'
          }`}
          onClick={() => update('team', '')}
        >
          全部
        </button>
        {TEAM_FILTER_ORDER.map(team => (
          <button
            key={team}
            className={`flex-shrink-0 rounded-full border px-3 py-1 text-xs font-bold transition ${
              currentTeam === team
                ? 'border-scoreboard bg-scoreboard text-chalk'
                : 'border-scoreboard/20 text-dugout hover:border-scoreboard/40'
            }`}
            onClick={() => update('team', currentTeam === team ? '' : team)}
          >
            {getTeamShortName(team)}
          </button>
        ))}
      </div>
    </div>
  )
}
