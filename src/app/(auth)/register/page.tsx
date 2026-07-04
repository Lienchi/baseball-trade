'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

export default function RegisterPage() {
  const supabase = createClient()
  const router = useRouter()

  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    if (password.length < 6) {
      setError('密碼至少需要 6 個字元')
      setLoading(false)
      return
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { username },
      },
    })

    if (error) {
      if (error.message.includes('already registered')) {
        setError('這個 Email 已經被註冊過了')
      } else {
        setError('註冊失敗：' + error.message)
      }
      setLoading(false)
      return
    }

    // 如果 Supabase 開啟了 email 驗證，session 會是 null
    if (data.session) {
      router.push('/')
      router.refresh()
    } else {
      setSuccess(true)
    }

    setLoading(false)
  }

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="card w-full max-w-sm p-8 text-center">
          <span className="text-4xl">📧</span>
          <h1 className="mt-3 text-lg font-bold">請確認你的 Email</h1>
          <p className="mt-2 text-sm text-gray-500">
            我們已經寄送驗證信到 <strong>{email}</strong>，請點擊信中連結完成註冊。
          </p>
          <Link href="/login" className="btn-secondary mt-6 inline-flex">
            前往登入
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="card w-full max-w-sm p-8">
        <div className="mb-6 text-center">
          <span className="text-4xl">⚾</span>
          <h1 className="mt-2 text-xl font-bold">註冊本質球迷交易所</h1>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">使用者名稱</label>
            <input
              className="input"
              value={username}
              onChange={e => setUsername(e.target.value)}
              required
              minLength={2}
              maxLength={20}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Email</label>
            <input
              type="email"
              className="input"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">密碼</label>
            <input
              type="password"
              className="input"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={6}
            />
            <p className="mt-1 text-xs text-gray-400">至少 6 個字元</p>
          </div>
          <label className="flex items-start gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={agreed}
              onChange={e => setAgreed(e.target.checked)}
              required
            />
            <span>
              我已閱讀並同意
              <Link href="/terms" target="_blank" className="font-medium text-red-600 hover:underline">
                網站規定與免責聲明
              </Link>
              ，並瞭解球票僅限原價以下轉讓
            </span>
          </label>

          <button type="submit" className="btn-primary w-full" disabled={loading || !agreed}>
            {loading ? '註冊中...' : '建立帳號'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-500">
          已經有帳號了？{' '}
          <Link href="/login" className="font-medium text-red-600 hover:underline">
            立即登入
          </Link>
        </p>
      </div>
    </div>
  )
}
