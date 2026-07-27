'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { ArrowUpDown, Search, SlidersHorizontal, X } from 'lucide-react'
import { todayTaipei } from '@/lib/utils'
import { IntentFilter } from '@/components/listings/IntentFilter'
import { TeamFilter } from '@/components/listings/TeamFilter'

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

  const currentDateFrom = searchParams.get('date_from') ?? ''
  const currentDateTo = searchParams.get('date_to') ?? ''
  const currentSort = searchParams.get('sort') ?? 'created_desc'

  // 搜尋框自控值，才能顯示/清除 X；輸入同步寫入 URL 的 q。
  // 不直接用 searchParams 當 value，避免每次打字都等 router 更新造成延遲/游標跳動；
  // 改用 effect 跟著 URL 校正，列表那邊按「清除篩選」時這裡才會一起清空。
  const urlQ = searchParams.get('q') ?? ''
  const [q, setQ] = useState(urlQ)
  useEffect(() => { setQ(urlQ) }, [urlQ])
  const onSearch = (v: string) => { setQ(v); update('q', v) }

  // 手機版把低頻篩選（徵求/出售、日期、排序）收進抽屜，桌機（sm 以上）維持攤開。
  // 收起來也看得到已選條件：下方 chips 列出並可單獨移除，避免「忘了自己篩過什麼」。
  const [open, setOpen] = useState(false)
  const intentValues = (searchParams.get('intent') ?? '').split(',').filter(Boolean)
  const mmdd = (d: string) => `${+d.slice(5, 7)}/${+d.slice(8, 10)}`
  const chips = [
    ...intentValues.map(v => ({
      key: `intent-${v}`,
      label: v === 'sell' ? '出售' : '徵求',
      remove: () => update('intent', intentValues.filter(x => x !== v).join(',')),
    })),
    ...(currentDateFrom ? [{ key: 'from', label: `${mmdd(currentDateFrom)} 起`, remove: () => update('date_from', '') }] : []),
    ...(currentDateTo ? [{ key: 'to', label: `至 ${mmdd(currentDateTo)}`, remove: () => update('date_to', '') }] : []),
    ...(currentSort === 'game_date_asc' ? [{ key: 'sort', label: '近到遠', remove: () => update('sort', '') }] : []),
  ]

  // 排序 toggle：點一下在「新到舊（上架時間）／近到遠（比賽日期）」之間切換。
  // 手機、桌機擺在不同行，用 className 控制哪一顆顯示。
  const sortButton = (className: string) => (
    <button
      className={`flex-shrink-0 items-center justify-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold transition ${
        currentSort === 'game_date_asc'
          ? 'border-scoreboard bg-scoreboard text-chalk'
          : 'border-scoreboard/20 text-dugout hover:border-scoreboard/40'
      } ${className}`}
      onClick={() => update('sort', currentSort === 'game_date_asc' ? '' : 'game_date_asc')}
    >
      <ArrowUpDown size={12} />
      {currentSort === 'game_date_asc' ? '近到遠' : '新到舊'}
    </button>
  )

  return (
    <div className="space-y-3">
      {/* 搜尋（左）＋ 篩選抽屜開關（右，僅手機） */}
      <div className="flex gap-2">
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
        <button
          type="button"
          aria-expanded={open}
          className="flex flex-shrink-0 items-center gap-1.5 rounded-md border border-scoreboard/20 px-3 text-xs font-bold text-dugout transition hover:border-scoreboard/40 sm:hidden"
          onClick={() => setOpen(o => !o)}
        >
          <SlidersHorizontal size={14} />
          篩選
          {chips.length > 0 && (
            <span className="rounded-full bg-scoreboard px-1.5 py-0.5 text-[10px] leading-none text-chalk">
              {chips.length}
            </span>
          )}
        </button>
      </div>

      {/* 低頻篩選：手機收在抽屜裡，sm 以上一律攤開 */}
      <div className={`${open ? 'block' : 'hidden'} space-y-3 sm:block`}>
        {/* 比賽日期範圍 */}
        <div className="flex flex-wrap items-center gap-3">
          {/* 手機：兩個日期各佔一半撐滿整行，不留半行空白；sm 以上維持固定寬度 */}
          <div className="flex w-full items-center gap-1 sm:w-auto sm:gap-2">
            <span className="flex-shrink-0 text-xs text-dugout">比賽日期</span>
            <div className="relative flex-1 sm:flex-none">
              <input
                type="date"
                required
                className={`input w-full min-w-0 px-2 text-sm sm:w-[6.5rem] sm:text-xs ${currentDateFrom ? 'pr-6' : ''}`}
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
            <span className="flex-shrink-0 text-xs text-dugout">-</span>
            <div className="relative flex-1 sm:flex-none">
              <input
                type="date"
                required
                className={`input w-full min-w-0 px-2 text-sm sm:w-[6.5rem] sm:text-xs ${currentDateTo ? 'pr-6' : ''}`}
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
          {/* sm 以上排序接在日期後面；手機版改跟出售／徵求同一行（見下方） */}
          {sortButton('hidden sm:flex')}
        </div>

        {/* 手機：出售／徵求大小同球隊按鈕；排序是「排序模式」不是篩選條件，靠右擺開，
            右緣跟上面日期框對齊（同一層容器，ml-auto 即可） */}
        <div className="flex items-center gap-2">
          <IntentFilter />
          {sortButton('ml-auto flex w-[6.75rem] sm:hidden')}
        </div>
      </div>

      {/* 球隊：可複選，窄螢幕橫向滑動 */}
      <TeamFilter />

      {/* 已選條件 chips：僅手機且抽屜收起時顯示（展開時控制項本身就會變色，再列一次是重複資訊）。
          可單獨移除；清除全部在列表的「共 N 筆」那行 */}
      {chips.length > 0 && !open && (
        <div className="flex flex-wrap items-center gap-2 sm:hidden">
          {chips.map(c => (
            <button
              key={c.key}
              type="button"
              className="flex items-center gap-1 rounded-full bg-scoreboard/5 px-2.5 py-1 text-xs font-bold text-dugout transition hover:text-clay"
              onClick={c.remove}
            >
              {c.label}
              <X size={11} />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
