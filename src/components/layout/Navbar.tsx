'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { MessageCircle, PlusCircle, User, Sun, Moon } from 'lucide-react'
import type { User as SupabaseUser } from '@supabase/supabase-js'

export function Navbar() {
  const supabase = createClient()
  const [user, setUser] = useState<SupabaseUser | null>(null)
  const [unread, setUnread] = useState(0)
  const [dark, setDark] = useState(false)

  useEffect(() => {
    setDark(document.documentElement.classList.contains('dark'))
  }, [])

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)

      if (user) {
        const { count } = await supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('is_read', false)
          .neq('sender_id', user.id)
        setUnread(count ?? 0)
      }
    }
    getUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_, session) => setUser(session?.user ?? null)
    )
    return () => subscription.unsubscribe()
  }, [supabase])

  const toggleDark = () => {
    const next = !dark
    setDark(next)
    document.documentElement.classList.toggle('dark', next)
    localStorage.setItem('theme', next ? 'dark' : 'light')
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  return (
    <nav className="fixed inset-x-0 top-0 z-50 border-b border-chalk/10 bg-field bg-stitch-pattern">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5">
          <svg width="34" height="34" viewBox="0 0 60 80" className="flex-shrink-0">
            <path d="M 0 0 L 60 0 L 60 42 Q 60 70 30 80 Q 0 70 0 42 Z" fill="#0A2D54" />
            <path d="M 7 7 L 53 7 L 53 40 Q 53 63 30 71 Q 7 63 7 40 Z" fill="none" stroke="#C8A84B" strokeWidth="1.5" />
            <circle cx="30" cy="37" r="14" fill="#F5F0E8" />
            <path d="M 24 29 Q 30 37 24 45" fill="none" stroke="#C8472E" strokeWidth="1.5" />
            <path d="M 36 29 Q 30 37 36 45" fill="none" stroke="#C8472E" strokeWidth="1.5" />
            <text x="30" y="22" fontFamily="serif" fontWeight="900" fontSize="12" fill="#C8A84B" textAnchor="middle">本</text>
          </svg>
          <div className="hidden flex-col leading-none sm:flex">
            <span className="font-display text-lg tracking-tight text-chalk">本質球迷交易所</span>
            <span className="mt-0.5 font-mono text-[9px] font-bold tracking-[0.15em] text-gold">BEN2 FAN EXCHANGE</span>
          </div>
          <span className="font-display text-lg tracking-tight text-chalk sm:hidden">本質球迷交易所</span>
        </Link>

        {/* 右側按鈕 */}
        <div className="flex items-center gap-2">
          <button onClick={toggleDark} className="p-2 text-chalk/80 hover:text-chalk">
            {dark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <Link href="/listings/new" className="btn-primary hidden sm:inline-flex">
            <PlusCircle size={16} />
            刊登
          </Link>

          {user ? (
            <>
              <Link href="/messages" className="relative p-2 text-chalk/80 hover:text-chalk">
                <MessageCircle size={20} />
                {unread > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-gold text-[10px] font-bold text-scoreboard">
                    {unread > 9 ? '9+' : unread}
                  </span>
                )}
              </Link>
              <Link href="/profile" className="p-2 text-chalk/80 hover:text-chalk">
                <User size={20} />
              </Link>
              <button
                onClick={handleLogout}
                className="rounded-md border-2 border-chalk/25 px-3 py-1.5 text-xs font-bold text-chalk transition hover:bg-chalk/10"
              >
                登出
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="rounded-md border-2 border-chalk/25 px-3 py-1.5 text-xs font-bold text-chalk transition hover:bg-chalk/10">
                登入
              </Link>
              <Link href="/register" className="btn-primary hidden sm:inline-flex">註冊</Link>
            </>
          )}
        </div>
      </div>
    </nav>
  )
}
