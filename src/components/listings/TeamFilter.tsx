'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { TEAM_FILTER_ORDER, getTeamShortName, getTeamColor } from '@/types'

// 球隊篩選：預設都不選（顯示全部），可複選，選中用該隊代表色。
// 狀態存 URL 的 team 參數（逗號分隔），球票、周邊兩個篩選列共用。
export function TeamFilter() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const selected = new Set((searchParams.get('team') ?? '').split(',').filter(Boolean))

  const push = useCallback((value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value) params.set('team', value)
    else params.delete('team')
    params.delete('page')
    router.push(`${pathname}?${params.toString()}`)
  }, [router, pathname, searchParams])

  const toggle = useCallback((team: string) => {
    const cur = new Set((searchParams.get('team') ?? '').split(',').filter(Boolean))
    if (cur.has(team)) cur.delete(team)
    else cur.add(team)
    push(Array.from(cur).join(','))
  }, [searchParams, push])

  // 只在真的還有內容被切掉時才蓋漸層：捲到底 / 沒溢出（桌機）都不該蓋住最後一顆按鈕
  const scrollRef = useRef<HTMLDivElement>(null)
  const [edges, setEdges] = useState({ left: false, right: false })
  const syncEdges = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const max = el.scrollWidth - el.clientWidth
    setEdges({ left: el.scrollLeft > 4, right: el.scrollLeft < max - 4 })
  }, [])

  useEffect(() => {
    syncEdges()
    window.addEventListener('resize', syncEdges)
    return () => window.removeEventListener('resize', syncEdges)
  }, [syncEdges])

  return (
    <div className="relative">
      <div ref={scrollRef} onScroll={syncEdges} className="scrollbar-none flex gap-2 overflow-x-auto">
        <button
          className={`flex-shrink-0 rounded-full border px-3 py-1 text-xs font-bold transition ${
            selected.size === 0
              ? 'border-scoreboard bg-scoreboard text-chalk'
              : 'border-scoreboard/20 text-dugout hover:border-scoreboard/40'
          }`}
          onClick={() => push('')}
        >
          全部
        </button>
        {TEAM_FILTER_ORDER.map(team => {
          const c = getTeamColor(team)
          return (
            <button
              key={team}
              className={`flex-shrink-0 rounded-full border px-3 py-1 text-xs font-bold transition ${
                selected.has(team)
                  ? `${c.bg} ${c.border} ${c.textOnBg}`
                  : 'border-scoreboard/20 text-dugout hover:border-scoreboard/40'
              }`}
              onClick={() => toggle(team)}
            >
              {getTeamShortName(team)}
            </button>
          )
        })}
      </div>
      {edges.left && (
        <div className="pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-chalk to-transparent" />
      )}
      {edges.right && (
        <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-chalk to-transparent" />
      )}
    </div>
  )
}
