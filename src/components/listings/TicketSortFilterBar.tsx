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
    params.delete('page') // 改變篩選/排序時重置回第一頁
    router.push(`${pathname}?${params.toString()}`)
  }, [router, pathname, searchParams])

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* 搜尋 */}
      <div className="relative flex-1 min-w-[180px]">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-dugout/50" />
        <input
          className="input pl-8"
          placeholder="搜尋標題..."
          defaultValue={searchParams.get('q') ?? ''}
          onChange={e => update('q', e.target.value)}
        />
      </div>

      {/* 球隊 */}
      <select
        className="input w-auto"
        value={searchParams.get('team') ?? ''}
        onChange={e => update('team', e.target.value)}
      >
        <option value="">全部球隊</option>
        {CPBL_TEAMS.map(team => (
          <option key={team} value={team}>{team}</option>
        ))}
      </select>

      {/* 交易方式 */}
      <select
        className="input w-auto"
        value={searchParams.get('deal_method') ?? ''}
        onChange={e => update('deal_method', e.target.value)}
      >
        <option value="">不限交易方式</option>
        <option value="meetup">面交</option>
        <option value="mail">郵寄</option>
      </select>

      {/* 排序 */}
      <select
        className="input w-auto"
        value={searchParams.get('sort') ?? 'created_desc'}
        onChange={e => update('sort', e.target.value)}
      >
        {showGameDateSort && (
          <option value="game_date_asc">比賽日期（近到遠）</option>
        )}
        <option value="created_desc">最新上架</option>
        <option value="price_asc">價格（低到高）</option>
        <option value="price_desc">價格（高到低）</option>
      </select>
    </div>
  )
}
