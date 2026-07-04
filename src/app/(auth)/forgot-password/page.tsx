'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

export default function ForgotPasswordPage() {
  const supabase = createClient()

  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    })

    if (error) {
      setError('寄送失敗：' + error.message)
    } else {
      setSuccess(true)
    }

    setLoading(false)
  }

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-chalk px-4">
        <div className="card w-full max-w-sm p-8 text-center">
          <span className="text-4xl">📧</span>
          <h1 className="mt-3 text-lg font-bold text-scoreboard">請確認你的 Email</h1>
          <p className="mt-2 text-sm text-dugout">
            我們已經寄送重設密碼的連結到 <strong>{email}</strong>，請點擊信中連結繼續。
          </p>
          <Link href="/login" className="btn-secondary mt-6 inline-flex">
            返回登入
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-chalk px-4">
      <div className="card w-full max-w-sm p-8">
        <h1 className="mb-1 text-lg font-bold text-scoreboard">忘記密碼</h1>
        <p className="mb-4 text-sm text-dugout">輸入註冊時使用的 Email，我們會寄送重設密碼連結給你。</p>

        {error && (
          <div className="mb-4 rounded-md bg-clay/10 px-4 py-3 text-sm text-clay-dark">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
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
          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? '寄送中...' : '寄送重設連結'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-dugout">
          <Link href="/login" className="font-bold text-clay hover:underline">
            返回登入
          </Link>
        </p>
      </div>
    </div>
  )
}
