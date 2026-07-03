'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  currentPage: number
  totalPages: number
  basePath: string
}

export function Pagination({ currentPage, totalPages, basePath }: Props) {
  const searchParams = useSearchParams()

  const buildUrl = (page: number) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('page', String(page))
    return `${basePath}?${params.toString()}`
  }

  if (totalPages <= 1) return null

  // 計算要顯示哪些頁碼（目前頁前後 2 頁，加上頭尾）
  const pages = new Set<number>()
  pages.add(1)
  pages.add(totalPages)
  for (let p = currentPage - 2; p <= currentPage + 2; p++) {
    if (p >= 1 && p <= totalPages) pages.add(p)
  }
  const sortedPages = Array.from(pages).sort((a, b) => a - b)

  return (
    <nav className="mt-8 flex items-center justify-center gap-1">
      {/* 上一頁 */}
      {currentPage > 1 ? (
        <Link
          href={buildUrl(currentPage - 1)}
          className="flex h-9 w-9 items-center justify-center rounded-md border-2 border-scoreboard/10 text-dugout hover:border-clay hover:text-clay"
        >
          <ChevronLeft size={16} />
        </Link>
      ) : (
        <span className="flex h-9 w-9 items-center justify-center rounded-md border-2 border-scoreboard/5 text-dugout/30">
          <ChevronLeft size={16} />
        </span>
      )}

      {/* 頁碼 */}
      {sortedPages.map((page, i) => {
        const prevPage = sortedPages[i - 1]
        const showEllipsis = prevPage !== undefined && page - prevPage > 1

        return (
          <span key={page} className="flex items-center gap-1">
            {showEllipsis && <span className="px-1 text-dugout/50">···</span>}
            <Link
              href={buildUrl(page)}
              className={cn(
                'flex h-9 w-9 items-center justify-center rounded-md text-sm font-bold transition',
                page === currentPage
                  ? 'bg-field text-white'
                  : 'border-2 border-scoreboard/10 text-dugout hover:border-field hover:text-field'
              )}
            >
              {page}
            </Link>
          </span>
        )
      })}

      {/* 下一頁 */}
      {currentPage < totalPages ? (
        <Link
          href={buildUrl(currentPage + 1)}
          className="flex h-9 w-9 items-center justify-center rounded-md border-2 border-scoreboard/10 text-dugout hover:border-clay hover:text-clay"
        >
          <ChevronRight size={16} />
        </Link>
      ) : (
        <span className="flex h-9 w-9 items-center justify-center rounded-md border-2 border-scoreboard/5 text-dugout/30">
          <ChevronRight size={16} />
        </span>
      )}
    </nav>
  )
}
