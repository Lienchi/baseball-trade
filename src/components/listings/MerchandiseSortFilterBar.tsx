'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useCallback, useState } from 'react'
import { Search, X } from 'lucide-react'
import { TEAM_FILTER_ORDER, getTeamShortName, getTeamColor } from '@/types'
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

  // 搜尋框自控值，才能顯示/清除 X；輸入同步寫入 URL 的 q
  const [q, setQ] = useState(searchParams.get('q') ?? '')
  const onSearch = (v: string) => { setQ(v); update('q', v) }

  // 任一篩選在作用時顯示「清除篩選」
  const hasFilters = ['q', 'intent', 'team'].some(k => searchParams.get(k))
  const clearAll = () => { setQ(''); router.push(pathname) }

  // 球隊可複選：存 URL 的 team 參數（逗號分隔），舊的單值連結也相容
  const selectedTeams = new Set((searchParams.get('team') ?? '').split(',').filter(Boolean))
  const toggleTeam = useCallback((team: string) => {
    const params = new URLSearchParams(searchParams.toString())
    const cur = new Set((params.get('team') ?? '').split(',').filter(Boolean))
    if (cur.has(team)) cur.delete(team)
    else cur.add(team)
    if (cur.size) params.set('team', Array.from(cur).join(','))
    else params.delete('team')
    params.delete('page')
    router.push(`${pathname}?${params.toString()}`)
  }, [router, pathname, searchParams])

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

      {/* 徵求／出售：預設不選（全部），可複選；右側放清除全部篩選 */}
      <div className="flex items-center justify-between gap-2">
        <IntentFilter />
        {hasFilters && (
          <button
            type="button"
            className="flex flex-shrink-0 items-center gap-1 rounded-full px-2 py-1 text-xs font-bold text-dugout transition hover:text-clay"
            onClick={clearAll}
          >
            <X size={12} />
            清除篩選
          </button>
        )}
      </div>

      {/* 球隊按鈕：固定一列，窄螢幕可橫向滑動，右側漸層提示可滑 */}
      <div className="relative">
      <div className="scrollbar-none flex gap-2 overflow-x-auto">
        <button
          className={`flex-shrink-0 rounded-full border px-3 py-1 text-xs font-bold transition ${
            selectedTeams.size === 0
              ? 'border-scoreboard bg-scoreboard text-chalk'
              : 'border-scoreboard/20 text-dugout hover:border-scoreboard/40'
          }`}
          onClick={() => update('team', '')}
        >
          全部
        </button>
        {TEAM_FILTER_ORDER.map(team => {
          const c = getTeamColor(team)
          return (
          <button
            key={team}
            className={`flex-shrink-0 rounded-full border px-3 py-1 text-xs font-bold transition ${
              selectedTeams.has(team)
                ? `${c.bg} ${c.border} ${c.textOnBg}`
                : 'border-scoreboard/20 text-dugout hover:border-scoreboard/40'
            }`}
            onClick={() => toggleTeam(team)}
          >
            {getTeamShortName(team)}
          </button>
          )
        })}
      </div>
      <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-chalk to-transparent" />
      </div>
    </div>
  )
}
