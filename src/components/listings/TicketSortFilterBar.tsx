'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useCallback } from 'react'
import { Search } from 'lucide-react'
import { CPBL_TEAMS } from '@/types'

interface Props {
  showGameDateSort?: boolean
}

export function TicketSortFilterBar({ showGameDateSort = false }: Props) {
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
  const currentDateFrom = searchParams.get('date_from') ?? ''
  const currentDateTo = searchParams.get('date_to') ?? ''

  return (
    <div className="space-y-3">
      {/* 搜尋 */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-dugout/50" />
        <input
          className="input pl-8"
          placeholder="搜尋標題..."
          defaultValue={searchParams.get('q') ?? ''}
          onChange={e => update('q', e.target.value)}
        />
      </div>

      {/* 球隊按鈕 */}
      <div className="flex flex-wrap gap-2">
        <button
          className={`rounded-full border px-3 py-1 text-xs font-bold transition ${
            currentTeam === ''
              ? 'border-scoreboard bg-scoreboard text-chalk'
              : 'border-scoreboard/20 text-dugout hover:border-scoreboard/40'
          }`}
          onClick={() => update('team', '')}
        >
          全部
        </button>
        {CPBL_TEAMS.map(team => (
          <button
            key={team}
            className={`rounded-full border px-3 py-1 text-xs font-bold transition ${
              currentTeam === team
                ? 'border-scoreboard bg-scoreboard text-chalk'
                : 'border-scoreboard/20 text-dugout hover:border-scoreboard/40'
            }`}
            onClick={() => update('team', currentTeam === team ? '' : team)}
          >
            {team}
          </button>
        ))}
      </div>

      {/* 日期範圍 + 交易方式 + 排序 */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-dugout">比賽日期</span>
          <input
            type="date"
            className="input w-auto text-xs"
            value={currentDateFrom}
            onChange={e => update('date_from', e.target.value)}
            onBlur={e => { if (e.target.value !== currentDateFrom) update('date_from', e.target.value) }}
          />
          <span className="text-xs text-dugout">～</span>
          <input
            type="date"
            className="input w-auto text-xs"
            value={currentDateTo}
            onChange={e => update('date_to', e.target.value)}
            onBlur={e => { if (e.target.value !== currentDateTo) update('date_to', e.target.value) }}
          />
        </div>

        <select
          className="input w-auto"
          value={searchParams.get('deal_method') ?? ''}
          onChange={e => update('deal_method', e.target.value)}
        >
          <option value="">不限交易方式</option>
          <option value="meetup">面交</option>
          <option value="mail">郵寄</option>
          <option value="eticket">電子票券</option>
          <option value="app_transfer">APP轉票</option>
        </select>

        <select
          className="input w-auto"
          value={searchParams.get('sort') ?? 'created_desc'}
          onChange={e => update('sort', e.target.value)}
        >
          {showGameDateSort && (
            <option value="game_date_asc">比賽日期（近到遠）</option>
          )}
          <option value="created_desc">最新上架</option>
        </select>
      </div>
    </div>
  )
}
