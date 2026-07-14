'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { SuspendUserButton } from './SuspendUserButton'

interface Props {
  userId: string
  suspendedUntil: string | null
  suspendedReason: string | null
}

// 管理員判斷在客端做，讓個人頁本體維持 ISR（server 端不碰 auth cookie）。
// 非管理員（絕大多數訪客）什麼都不渲染。
export function AdminSuspendControl({ userId, suspendedUntil, suspendedReason }: Props) {
  const supabase = createClient()
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    let cancelled = false
    const check = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || user.id === userId) return
      const { data: me } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', user.id)
        .single()
      if (!cancelled && me?.is_admin === true) setIsAdmin(true)
    }
    check()
    return () => { cancelled = true }
  }, [supabase, userId])

  if (!isAdmin) return null

  return (
    <SuspendUserButton
      userId={userId}
      suspendedUntil={suspendedUntil}
      suspendedReason={suspendedReason}
    />
  )
}
