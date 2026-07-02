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
    <nav className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-banner">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5">
          <svg width="34" height="38" viewBox="0 0 60 68" className="flex-shrink-0">
            <path d="M 30 2 L 56 10 L 56 34 Q 56 54 30 66 Q 4 54 4 34 L 4 10 Z" fill="#082849" stroke="#D4A437" strokeWidth="2" />
            <path d="M 30 9 L 49 15 L 49 34 Q 49 48 30 58 Q 11 48 11 34 L 11 15 Z" fill="none" stroke="#D4A437" strokeWidth="1" opacity="0.6" />
            <text x="30" y="40" fontFamily="'Archivo Black', sans-serif" fontWeight="900" fontSize="24" fill="#F5F0E8" textAnchor="middle">本</text>
          </svg>
          <div className="flex flex-col leading-none">
            <span className="font-display text-base tracking-tight text-white sm:text-lg">本質球迷交易所</span>
            <span className="mt-0.5 bg-transparent font-mono text-[8px] font-bold tracking-[0.15em] text-gold sm:text-[9px]">BEN2 FAN EXCHANGE</span>
          </div>
        </Link>

        {/* 右側按鈕 */}
        <div className="flex items-center gap-2">
          <button onClick={toggleDark} className="p-2 text-white/70 hover:text-white">
            {dark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <Link href="/listings/new" className="btn-primary hidden sm:inline-flex">
            <PlusCircle size={16} />
            刊登
          </Link>

          {user ? (
            <>
              <Link href="/messages" className="relative p-2 text-white/70 hover:text-white">
                <MessageCircle size={20} />
                {unread > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-gold text-[10px] font-bold text-field-dark">
                    {unread > 9 ? '9+' : unread}
                  </span>
                )}
              </Link>
              <Link href="/profile" className="p-2 text-white/70 hover:text-white">
                <User size={20} />
              </Link>
              <button
                onClick={handleLogout}
                className="rounded-md border-2 border-white/25 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-white/10"
              >
                登出
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="rounded-md border-2 border-white/25 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-white/10">
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
