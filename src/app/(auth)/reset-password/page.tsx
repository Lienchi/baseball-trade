'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function ResetPasswordPage() {
  const supabase = createClient()
  const router = useRouter()

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    if (password.length < 8) {
      setError('密碼至少需要 8 個字元')
      setLoading(false)
      return
    }

    if (password !== confirmPassword) {
      setError('兩次輸入的密碼不一致')
      setLoading(false)
      return
    }

    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      setError('重設失敗：' + error.message)
      setLoading(false)
      return
    }

    setSuccess(true)
    setLoading(false)
    setTimeout(() => {
      router.push('/login')
    }, 2000)
  }

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-chalk px-4">
        <div className="card w-full max-w-sm p-8 text-center">
          <span className="text-4xl">✅</span>
          <h1 className="mt-3 text-lg font-bold text-scoreboard">密碼已重設</h1>
          <p className="mt-2 text-sm text-dugout">正在為你導向登入頁面...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-chalk px-4">
      <div className="card w-full max-w-sm p-8">
        <h1 className="mb-4 text-lg font-bold text-scoreboard">設定新密碼</h1>

        {error && (
          <div className="mb-4 rounded-md bg-clay/10 px-4 py-3 text-sm text-clay-dark">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-scoreboard">新密碼</label>
            <input
              type="password"
              className="input"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={8}
            />
            <p className="mt-1 text-xs text-dugout/60">至少 8 個字元</p>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-scoreboard">確認新密碼</label>
            <input
              type="password"
              className="input"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              required
              minLength={8}
            />
          </div>
          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? '設定中...' : '設定新密碼'}
          </button>
        </form>
      </div>
    </div>
  )
}
