'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Ticket, Shirt } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  ticketCount: number
  merchCount: number
}

// 球票／周邊分頁導覽：兩顆左右 segmented「連結」，各自是獨立路由（/、/merchandise）。
// 桌面（sm+）改用 Navbar 上的連結，這裡隱藏。
export function ListingTabs({ ticketCount, merchCount }: Props) {
  const pathname = usePathname()
  const onMerch = pathname.startsWith('/merchandise')

  const tabs = [
    { href: '/', label: '球票', icon: Ticket, count: ticketCount, active: !onMerch },
    { href: '/merchandise', label: '周邊', icon: Shirt, count: merchCount, active: onMerch },
  ]

  return (
    <div className="mb-3 grid grid-cols-2 gap-1 rounded-xl border-2 border-scoreboard/10 bg-scoreboard/5 p-1 sm:hidden">
      {tabs.map(({ href, label, icon: Icon, count, active }) => (
        <Link
          key={href}
          href={href}
          className={cn(
            'flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-bold transition',
            active
              ? 'bg-field text-white shadow-sm'
              : 'text-dugout hover:text-scoreboard dark:hover:text-blue-300'
          )}
        >
          <Icon size={16} />
          {label}
          <span className={cn('text-xs font-medium', active ? 'text-white/70' : 'text-dugout/60')}>{count}</span>
        </Link>
      ))}
    </div>
  )
}
