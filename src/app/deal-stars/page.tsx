import { createStaticClient } from '@/lib/supabase/static'
import Link from 'next/link'
import Image from 'next/image'
import { Trophy, Star } from 'lucide-react'
import type { Profile } from '@/types'

export const metadata = {
  title: '交易之星',
  description: '本質球迷交易所成交次數最多的資深賣家排行，看看誰是交易之星',
}

// ISR：成交數變動不頻繁，快取一小時即可
export const revalidate = 3600

const MAX_STARS = 50

export default async function DealStarsPage() {
  const supabase = createStaticClient()

  const { data } = await supabase
    .from('profiles')
    .select('id, username, avatar_url, rating, rating_count, deal_count')
    .gt('deal_count', 0)
    .order('deal_count', { ascending: false })
    .order('rating_count', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(MAX_STARS)

  const stars = (data ?? []) as Pick<
    Profile, 'id' | 'username' | 'avatar_url' | 'rating' | 'rating_count' | 'deal_count'
  >[]

  // 前三名的名次牌：金、銀、銅
  const medal = (rank: number) =>
    rank === 1 ? 'bg-[#F5C518] text-white'
    : rank === 2 ? 'bg-[#B4B7BD] text-white'
    : rank === 3 ? 'bg-[#A97142] text-white'
    : 'text-dugout'

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6 border-b-2 border-scoreboard/10 pb-6">
        <h1 className="flex items-center gap-2 font-display text-2xl text-scoreboard">
          <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-gold/15 text-gold">
            <Trophy size={18} strokeWidth={2} />
          </span>
          交易之星
        </h1>
        <p className="mt-1 text-sm text-dugout">依成交次數排行，都是站上真實完成的交易</p>
      </div>

      {stars.length === 0 ? (
        <p className="mt-20 text-center text-dugout">目前還沒有成交紀錄，快來開第一棒</p>
      ) : (
        <ul className="space-y-2">
          {stars.map((star, i) => {
            const rank = i + 1
            return (
              <li key={star.id}>
                <Link
                  href={`/users/${star.id}`}
                  className="card flex items-center gap-3 px-4 py-2.5 transition-all hover:shadow-md"
                >
                  <span className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold ${medal(rank)}`}>
                    {rank}
                  </span>
                  {star.avatar_url ? (
                    <Image src={star.avatar_url} alt={star.username} width={40} height={40} unoptimized className="h-10 w-10 flex-shrink-0 rounded-full border border-scoreboard/10 object-cover" />
                  ) : (
                    <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border border-scoreboard/10 bg-dugout/20 text-base font-bold text-dugout">
                      {star.username[0]?.toUpperCase()}
                    </span>
                  )}
                  <span className="min-w-0 flex-1 truncate font-bold text-scoreboard">{star.username}</span>
                  <span className="flex flex-shrink-0 items-center gap-1 text-xs font-medium text-gold">
                    <Star size={12} className="fill-gold" />
                    {star.rating_count > 0 ? Number(star.rating).toFixed(1) : '–'}
                  </span>
                  <span className="flex-shrink-0 text-sm">
                    <span className="font-bold text-field dark:text-blue-400">{star.deal_count}</span>
                    <span className="ml-0.5 text-xs text-dugout">次成交</span>
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
