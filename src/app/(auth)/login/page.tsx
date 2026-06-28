'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

function LoginForm() {
  const supabase = createClient()
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirectTo') ?? '/'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError('帳號或密碼錯誤，請重試')
    } else {
      router.push(redirectTo)
      router.refresh()
    }
    setLoading(false)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-chalk px-4">
      <div className="card w-full max-w-sm p-8">
        <div className="mb-6 text-center">
          <span className="text-4xl">⚾</span>
          <h1 className="mt-2 font-display text-xl text-scoreboard">登入球票市集</h1>
        </div>

        {error && (
          <div className="mb-4 rounded-md bg-clay/10 px-4 py-3 text-sm text-clay-dark">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-scoreboard">Email</label>
            <input
              type="email"
              className="input"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-scoreboard">密碼</label>
            <input
              type="password"
              className="input"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? '登入中...' : '登入'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-dugout">
          還沒有帳號？{' '}
          <Link href="/register" className="font-bold text-clay hover:underline">
            立即註冊
          </Link>
        </p>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
