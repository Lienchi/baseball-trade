import { cn } from '@/lib/utils'

// 載入佔位灰塊：以 className 控制形狀（寬高/圓角），配合頁面版型排出骨架屏
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-md bg-scoreboard/10', className)} />
}
