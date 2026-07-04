'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import TermsContent from '@/components/TermsContent'

export default function RegisterPage() {
  const supabase = createClient()
  const router = useRouter()

  const [step, setStep] = useState<'terms' | 'form'>('terms')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
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

    if (password !== confirmPassword) {
      setError('兩次輸入的密碼不一致')
      setLoading(false)
      return
    }

    const { data: existing } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', username)
      .maybeSingle()

    if (existing) {
      setError('這個使用者名稱已經有人使用了')
      setLoading(false)
      return
    }

    const { data: reserved } = await supabase
      .from('reserved_usernames')
      .select('username')
      .eq('username', username)
      .maybeSingle()

    if (reserved) {
      setError('這個使用者名稱已經有人使用了')
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

    // Supabase 對已註冊的 email 不會回傳 error，而是回傳 identities 為空陣列的假成功（防止 email 枚舉）
    if (data.user && data.user.identities && data.user.identities.length === 0) {
      setError('這個 Email 已經被註冊過了')
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

  if (step === 'terms') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-10">
        <div className="card w-full max-w-2xl p-8">
          <div className="max-h-[60vh] overflow-y-auto pr-2">
            <TermsContent />
          </div>
          <div className="mt-6 flex gap-3">
            <Link href="/login" className="btn-secondary flex-1 text-center">
              不同意
            </Link>
            <button
              type="button"
              className="btn-primary flex-1"
              onClick={() => setStep('form')}
            >
              我已閱讀並同意，繼續註冊
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="card w-full max-w-sm p-8">

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
            <p className="mt-1 text-xs text-gray-400">註冊後無法更改，請謹慎選擇</p>
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
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">確認密碼</label>
            <input
              type="password"
              className="input"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>
          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? '註冊中...' : '建立帳號'}
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-gray-400">
          註冊即代表你同意
          <Link href="/terms" target="_blank" className="font-medium text-red-600 hover:underline">
            網站規定與免責聲明
          </Link>
        </p>

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
