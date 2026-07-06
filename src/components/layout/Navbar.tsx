'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { MessageCircle, PlusCircle, User, Heart, LogOut, LogIn, Menu, X, Moon, Sun } from 'lucide-react'
import type { User as SupabaseUser } from '@supabase/supabase-js'

export function Navbar() {
  const supabase = createClient()
  const pathname = usePathname()
  const [user, setUser] = useState<SupabaseUser | null>(null)
  const [unread, setUnread] = useState(0)
  const [menuOpen, setMenuOpen] = useState(false)
  const [dark, setDark] = useState(false)

  useEffect(() => {
    setDark(document.documentElement.classList.contains('dark'))
  }, [])

  // 換頁時自動收起選單
  useEffect(() => { setMenuOpen(false) }, [pathname])

  const toggleDark = () => {
    const next = !dark
    setDark(next)
    document.documentElement.classList.toggle('dark', next)
    localStorage.setItem('theme', next ? 'dark' : 'light')
  }

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
    }
    getUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_, session) => setUser(session?.user ?? null)
    )
    return () => subscription.unsubscribe()
  }, [supabase])

  // 未讀數：換頁時重查（讀完訊息回上頁數字才會清掉），並訂閱新訊息即時更新
  useEffect(() => {
    if (!user) { setUnread(0); return }

    const fetchUnread = async () => {
      const { count } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('is_read', false)
        .neq('sender_id', user.id)
      setUnread(count ?? 0)
    }
    fetchUnread()

    const channel = supabase
      .channel('navbar-unread')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
        if (payload.new.sender_id !== user.id) fetchUnread()
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [supabase, user, pathname])

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
            <span className="mt-0.5 bg-transparent font-mono text-[8px] font-bold tracking-[0.15em] text-gold sm:text-[9px]">BENJI FAN EXCHANGE</span>
          </div>
        </Link>

        {/* 右側按鈕 */}
        <div className="flex items-center gap-2">
          {/* 在周邊商品相關頁面按「+ 刊登」時，new 頁預選周邊商品 */}
          <Link
            href={pathname.startsWith('/merchandise') ? '/listings/new?type=merchandise' : '/listings/new'}
            className="btn-primary inline-flex"
          >
            <PlusCircle size={16} />
            刊登
          </Link>

          {user ? (
            <>
              <Link href="/messages" className="relative hidden p-2 text-white/70 hover:text-white sm:block">
                <MessageCircle size={20} />
                {unread > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-gold text-[10px] font-bold text-field-dark">
                    {unread > 9 ? '9+' : unread}
                  </span>
                )}
              </Link>
              <Link href="/favorites" className="hidden p-2 text-white/70 hover:text-white sm:block">
                <Heart size={20} />
              </Link>
              <Link href="/profile" className="hidden p-2 text-white/70 hover:text-white sm:block">
                <User size={20} />
              </Link>
              <button
                onClick={handleLogout}
                className="hidden rounded-md border-2 border-white/25 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-white/10 sm:block"
              >
                登出
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="hidden rounded-md border-2 border-white/25 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-white/10 sm:block">
                登入
              </Link>
              <Link href="/register" className="btn-primary hidden sm:inline-flex">註冊</Link>
            </>
          )}

          {/* 手機版：漢堡選單 */}
          <button
            onClick={() => setMenuOpen(true)}
            className="relative p-2 text-white/70 hover:text-white sm:hidden"
            title="選單"
            aria-label="開啟選單"
          >
            <Menu size={22} />
            {user && unread > 0 && (
              <span className="absolute right-0.5 top-0.5 h-2 w-2 rounded-full bg-gold" />
            )}
          </button>
        </div>
      </div>

      {/* 手機版滑出選單 */}
      <div className={`fixed inset-0 z-50 sm:hidden ${menuOpen ? '' : 'pointer-events-none'}`}>
        {/* 遮罩 */}
        <div
          className={`absolute inset-0 bg-black/50 transition-opacity duration-300 ${menuOpen ? 'opacity-100' : 'opacity-0'}`}
          onClick={() => setMenuOpen(false)}
        />
        {/* 側欄：從右側向左滑出 */}
        <div
          className={`absolute inset-y-0 right-0 flex w-64 flex-col bg-banner shadow-xl transition-transform duration-300 ${menuOpen ? 'translate-x-0' : 'translate-x-full'}`}
        >
          <div className="flex h-16 items-center justify-between border-b border-white/10 px-4">
            <span className="font-display text-base text-white">選單</span>
            <button onClick={() => setMenuOpen(false)} className="p-2 text-white/70 hover:text-white" aria-label="關閉選單">
              <X size={22} />
            </button>
          </div>

          <div className="flex flex-col gap-1 p-3">
            {user ? (
              <>
                <Link href="/profile" className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-bold text-white/80 hover:bg-white/10 hover:text-white">
                  <User size={18} />
                  個人頁面
                </Link>
                <Link href="/favorites" className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-bold text-white/80 hover:bg-white/10 hover:text-white">
                  <Heart size={18} />
                  我的關注
                </Link>
                <Link href="/messages" className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-bold text-white/80 hover:bg-white/10 hover:text-white">
                  <MessageCircle size={18} />
                  我的私訊
                  {unread > 0 && (
                    <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-gold px-1.5 text-[11px] font-bold text-field-dark">
                      {unread > 9 ? '9+' : unread}
                    </span>
                  )}
                </Link>
              </>
            ) : null}

            <button
              onClick={toggleDark}
              className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-bold text-white/80 hover:bg-white/10 hover:text-white"
            >
              {dark ? <Sun size={18} /> : <Moon size={18} />}
              {dark ? '切換為淺色模式' : '切換為深色模式'}
            </button>

            <div className="my-2 border-t border-white/10" />

            {user ? (
              <button
                onClick={handleLogout}
                className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-bold text-white/80 hover:bg-white/10 hover:text-white"
              >
                <LogOut size={18} />
                登出
              </button>
            ) : (
              <Link href="/login" className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-bold text-white/80 hover:bg-white/10 hover:text-white">
                <LogIn size={18} />
                登入
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}
