'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useCallback, useState } from 'react'
import { ArrowUpDown, Search, X } from 'lucide-react'
import { TEAM_FILTER_ORDER, getTeamShortName, getTeamColor } from '@/types'
import { todayTaipei } from '@/lib/utils'
import { IntentFilter } from '@/components/listings/IntentFilter'

export function TicketSortFilterBar() {
  // 可搜尋的比賽日期：今天（過期場次不會顯示）到今年年底（球季範圍）
  const minDate = todayTaipei()
  const maxDate = `${minDate.slice(0, 4)}-12-31`
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
  const currentDateFrom = searchParams.get('date_from') ?? ''
  const currentDateTo = searchParams.get('date_to') ?? ''
  const currentSort = searchParams.get('sort') ?? 'created_desc'

  // 搜尋框自控值，才能顯示/清除 X；輸入同步寫入 URL 的 q
  const [q, setQ] = useState(searchParams.get('q') ?? '')
  const onSearch = (v: string) => { setQ(v); update('q', v) }

  // 任一篩選在作用時顯示「清除篩選」
  const hasFilters = ['q', 'intent', 'team', 'date_from', 'date_to', 'sort'].some(k => searchParams.get(k))
  const clearAll = () => { setQ(''); router.push(pathname) }

  return (
    <div className="space-y-3">
      {/* 搜尋 */}
      <div className="relative">
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

      {/* 日期範圍（左）＋ 排序 toggle（右） */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1 sm:gap-2">
          {/* 標籤在手機上藏掉，讓日期框和排序鍵能排同一列 */}
          <span className="hidden text-xs text-dugout sm:inline">比賽日期</span>
          <div className="relative">
            <input
              type="date"
              required
              className={`input w-[5.5rem] min-w-0 px-1.5 text-xs sm:w-[6.5rem] sm:px-2 ${currentDateFrom ? 'pr-6' : ''}`}
              value={currentDateFrom}
              min={minDate}
              max={currentDateTo || maxDate}
              onChange={e => update('date_from', e.target.value)}
            />
            {currentDateFrom && (
              <button
                type="button"
                aria-label="清除開始日期"
                className="absolute right-1 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-dugout/50 hover:text-clay"
                onClick={() => update('date_from', '')}
              >
                <X size={14} />
              </button>
            )}
          </div>
          <span className="text-xs text-dugout">-</span>
          <div className="relative">
            <input
              type="date"
              required
              className={`input w-[5.5rem] min-w-0 px-1.5 text-xs sm:w-[6.5rem] sm:px-2 ${currentDateTo ? 'pr-6' : ''}`}
              value={currentDateTo}
              min={currentDateFrom || minDate}
              max={maxDate}
              onChange={e => update('date_to', e.target.value)}
            />
            {currentDateTo && (
              <button
                type="button"
                aria-label="清除結束日期"
                className="absolute right-1 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-dugout/50 hover:text-clay"
                onClick={() => update('date_to', '')}
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* 點一下在「新到舊（上架時間）／近到遠（比賽日期）」之間切換 */}
        <button
          className="ml-auto flex flex-shrink-0 items-center gap-1.5 rounded-full border border-scoreboard/20 px-3 py-1 text-xs font-bold text-dugout transition hover:border-scoreboard/40"
          onClick={() => update('sort', currentSort === 'game_date_asc' ? '' : 'game_date_asc')}
        >
          <ArrowUpDown size={12} />
          {currentSort === 'game_date_asc' ? '近到遠' : '新到舊'}
        </button>
      </div>
    </div>
  )
}
