'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { ArrowUpDown, Calendar, Search, SlidersHorizontal, X } from 'lucide-react'
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

  // 手機版把低頻篩選（徵求/出售、搜尋、排序）收進抽屜，桌機（sm 以上）維持攤開。
  // 日期是這頁最常用的條件，手機版不收進抽屜，直接擺在最上面那行。
  // 抽屜收起來也看得到已選條件：下方 chips 列出並可單獨移除，避免「忘了自己篩過什麼」。
  const [open, setOpen] = useState(false)
  const intentValues = (searchParams.get('intent') ?? '').split(',').filter(Boolean)
  // chips 只列抽屜裡的條件；日期本來就在畫面上，再列一次是重複資訊
  const chips = [
    ...intentValues.map(v => ({
      key: `intent-${v}`,
      label: v === 'sell' ? '出售' : '徵求',
      remove: () => update('intent', intentValues.filter(x => x !== v).join(',')),
    })),
    ...(urlQ ? [{ key: 'q', label: `「${urlQ}」`, remove: () => onSearch('') }] : []),
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

  // 搜尋框：手機在抽屜裡，桌機在最上面那行。
  const searchBox = (className: string) => (
    <div className={`relative ${className}`}>
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
  )

  // 比賽日期範圍。compact 是手機版：要跟篩選鈕擠同一行，所以拿掉「比賽日期」label、
  // 字級壓到 text-xs，兩個 input 各佔一半撐滿剩下的寬度。
  const dateRange = (className: string, compact: boolean) => {
    // 日曆 icon 固定放左邊（原生的已在 globals.css 關掉）：不管有沒有選日期都看得到，
    // 也不會跟右邊的清除 X 疊在一起。原生 icon 關掉後桌機點框不會自動開日曆，補 showPicker()。
    // fallback：起始日沒選時直接顯示今天（＝可選範圍的下限），不要留一格空白的 yyyy/mm/dd。
    // 只是預填給人看，不會寫進 URL —— 反正過期場次本來就不會出現，篩不篩結果一樣。
    // 清除 X 仍只在真的選過（URL 有值）時出現，不然會變成「清掉又回到今天」。
    const field = (
      key: 'date_from' | 'date_to',
      label: string,
      value: string,
      min: string,
      max: string,
      fallback = '',
    ) => (
      <div className="relative min-w-0 flex-1 sm:flex-none">
        <Calendar size={15} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-dugout/60" />
        <input
          type="date"
          required
          aria-label={label}
          className={`input w-full min-w-0 pl-7 pr-2 text-sm sm:w-[8.5rem] ${value ? 'pr-6' : ''}`}
          value={value || fallback}
          min={min}
          max={max}
          onChange={e => update(key, e.target.value)}
          onClick={e => e.currentTarget.showPicker?.()}
        />
        {value && (
          <button
            type="button"
            aria-label={`清除${label}`}
            className="absolute right-1 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-dugout/50 hover:text-clay"
            onClick={() => update(key, '')}
          >
            <X size={14} />
          </button>
        )}
      </div>
    )

    return (
      <div className={`items-center gap-1 sm:w-auto sm:gap-2 ${className}`}>
        {!compact && <span className="flex-shrink-0 text-xs text-dugout">比賽日期</span>}
        {field('date_from', '比賽日期起', currentDateFrom, minDate, currentDateTo || maxDate, minDate)}
        <span className="flex-shrink-0 text-xs text-dugout">-</span>
        {field('date_to', '比賽日期迄', currentDateTo, currentDateFrom || minDate, maxDate)}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* 最上面那行：手機是「日期範圍 ＋ 篩選抽屜開關」，桌機是搜尋框 */}
      <div className="flex gap-2">
        {/* min-w-0：不加的話 flex item 撐在日期 input 的 min-content 寬，窄機（320px）會溢出 */}
        {dateRange('flex min-w-0 flex-1 sm:hidden', true)}
        {searchBox('hidden flex-1 sm:block')}
        <button
          type="button"
          aria-expanded={open}
          aria-label="篩選"
          className="flex flex-shrink-0 items-center gap-1 rounded-md border border-scoreboard/20 px-2.5 text-xs font-bold text-dugout transition hover:border-scoreboard/40 sm:hidden"
          onClick={() => setOpen(o => !o)}
        >
          <SlidersHorizontal size={14} />
          {chips.length > 0 && (
            <span className="rounded-full bg-scoreboard px-1.5 py-0.5 text-[10px] leading-none text-chalk">
              {chips.length}
            </span>
          )}
        </button>
      </div>

      {/* 低頻篩選：手機收在抽屜裡，sm 以上一律攤開 */}
      <div className={`${open ? 'block' : 'hidden'} space-y-3 sm:block`}>
        {searchBox('sm:hidden')}
        {/* 整層 hidden：手機版裡面兩個都不顯示，留著空 div 會被 space-y-3 多算一份間距 */}
        <div className="hidden flex-wrap items-center gap-3 sm:flex">
          {dateRange('flex w-full sm:w-auto', false)}
          {/* sm 以上排序接在日期後面；手機版改跟出售／徵求同一行（見下方） */}
          {sortButton('hidden sm:flex')}
        </div>

        {/* 手機：出售／徵求大小同球隊按鈕；排序是「排序模式」不是篩選條件，靠右擺開 */}
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
