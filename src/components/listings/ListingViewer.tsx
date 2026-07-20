'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { ListingType } from '@/types'

// 刊登詳情頁改 ISR 後，頁面本體是匿名快取，所有跟登入者相關的狀態
// （擁有者/管理員判斷、關注、檢舉）改由瀏覽器直連 Supabase 查，
// 不經過 Vercel function。瀏覽數也在這裡計（非擁有者才算，跟原本一致）。

interface ViewerState {
  ready: boolean
  userId: string | null
  isOwner: boolean
  isAdmin: boolean
  canManage: boolean
  isFavorited: boolean          // 關注整篇（item_id null）
  favoritedItemIds: string[]    // 關注的特定場次
  hasReported: boolean
}

const initialState: ViewerState = {
  ready: false,
  userId: null,
  isOwner: false,
  isAdmin: false,
  canManage: false,
  isFavorited: false,
  favoritedItemIds: [],
  hasReported: false,
}

const ListingViewerContext = createContext<ViewerState>(initialState)

export function useListingViewer() {
  return useContext(ListingViewerContext)
}

export function ListingViewerProvider({
  listingId,
  ownerId,
  listingType,
  children,
}: {
  listingId: string
  ownerId: string
  listingType: ListingType
  children: React.ReactNode
}) {
  const [state, setState] = useState<ViewerState>(initialState)

  useEffect(() => {
    const supabase = createClient()
    let cancelled = false

    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        // 匿名訪客：計瀏覽數後即完成（fire-and-forget，失敗不影響瀏覽）
        supabase.rpc('increment_view_count', { listing_id: listingId }).then(() => {})
        if (!cancelled) setState({ ...initialState, ready: true })
        return
      }

      const isOwner = user.id === ownerId
      if (!isOwner) {
        supabase.rpc('increment_view_count', { listing_id: listingId }).then(() => {})
      }

      const [adminRes, favsRes, reportRes] = await Promise.all([
        isOwner
          ? Promise.resolve(null)
          : supabase.from('profiles').select('is_admin').eq('id', user.id).single(),
        !isOwner && listingType === 'ticket'
          ? supabase.from('favorites').select('item_id').eq('user_id', user.id).eq('listing_id', listingId)
          : Promise.resolve(null),
        !isOwner
          ? supabase.from('reports').select('id').eq('listing_id', listingId).eq('reporter_id', user.id).maybeSingle()
          : Promise.resolve(null),
      ])

      const isAdmin = (adminRes?.data as { is_admin?: boolean } | null)?.is_admin === true
      const favs = (favsRes?.data ?? []) as { item_id: string | null }[]

      if (!cancelled) {
        setState({
          ready: true,
          userId: user.id,
          isOwner,
          isAdmin,
          canManage: isOwner || isAdmin,
          isFavorited: favs.some(f => f.item_id === null),
          favoritedItemIds: favs.map(f => f.item_id).filter((x): x is string => x !== null),
          hasReported: !!reportRes?.data,
        })
      }
    }

    load()
    return () => { cancelled = true }
  }, [listingId, ownerId, listingType])

  return (
    <ListingViewerContext.Provider value={state}>
      {children}
    </ListingViewerContext.Provider>
  )
}
