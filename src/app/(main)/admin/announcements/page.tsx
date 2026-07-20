'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { formatDate } from '@/lib/utils'
import { revalidatePaths } from '@/lib/revalidate'
import { Megaphone, Trash2, Pencil } from 'lucide-react'

// 管理員專用：發佈／上下架／刪除全站置頂公告。
// 寫入權限由 announcements 的 RLS（is_admin）把關，頁面檢查只是導流 UX。
interface Announcement {
  id: string
  message: string
  link_url: string | null
  is_active: boolean
  created_at: string
}

export default function AdminAnnouncementsPage() {
  const supabase = createClient()
  const router = useRouter()
  const [checked, setChecked] = useState(false)
  const [items, setItems] = useState<Announcement[]>([])
  const [message, setMessage] = useState('')
  const [linkUrl, setLinkUrl] = useState('')
  const [loading, setLoading] = useState(false)
  // 行內編輯：正在編輯的公告 id 與編輯中的內容
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editMessage, setEditMessage] = useState('')
  const [editLinkUrl, setEditLinkUrl] = useState('')

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('announcements')
      .select('*')
      .order('created_at', { ascending: false })
    setItems(data ?? [])
  }, [supabase])

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/login'); return }
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', user.id)
        .single()
      if (!profile?.is_admin) { router.replace('/'); return }
      setChecked(true)
      load()
    }
    init()
  }, [supabase, router, load])

  const handleCreate = async () => {
    if (!message.trim()) { alert('請輸入公告內容'); return }
    setLoading(true)
    const { error } = await supabase.from('announcements').insert({
      message: message.trim(),
      link_url: linkUrl.trim() || null,
    })
    if (error) alert('發佈失敗，請稍後再試')
    else { setMessage(''); setLinkUrl(''); revalidatePaths('/announcements'); await load() }
    setLoading(false)
  }

  const toggleActive = async (item: Announcement) => {
    const { error } = await supabase
      .from('announcements')
      .update({ is_active: !item.is_active })
      .eq('id', item.id)
    if (error) alert('更新失敗，請稍後再試')
    else { revalidatePaths('/announcements'); await load() }
  }

  const startEdit = (item: Announcement) => {
    setEditingId(item.id)
    setEditMessage(item.message)
    setEditLinkUrl(item.link_url ?? '')
  }

  const handleSaveEdit = async () => {
    if (!editingId) return
    if (!editMessage.trim()) { alert('請輸入公告內容'); return }
    setLoading(true)
    const { error } = await supabase
      .from('announcements')
      .update({ message: editMessage.trim(), link_url: editLinkUrl.trim() || null })
      .eq('id', editingId)
    if (error) alert('更新失敗，請稍後再試')
    else { setEditingId(null); revalidatePaths('/announcements'); await load() }
    setLoading(false)
  }

  const handleDelete = async (item: Announcement) => {
    if (!confirm('確定要刪除這則公告嗎？')) return
    const { error } = await supabase.from('announcements').delete().eq('id', item.id)
    if (error) alert('刪除失敗，請稍後再試')
    else { revalidatePaths('/announcements'); await load() }
  }

  if (!checked) return null

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="flex items-center gap-2 text-xl font-bold text-scoreboard mb-6">
        <Megaphone size={22} /> 置頂公告管理
      </h1>

      <div className="rounded-xl bg-surface p-4 shadow-sm mb-8 space-y-3">
        <textarea
          value={message}
          onChange={e => setMessage(e.target.value)}
          placeholder="公告內容，例如：🎉 新功能上線：賣家現在會收到訊息通知信！"
          rows={2}
          className="w-full rounded-lg border border-dugout/20 bg-chalk px-3 py-2 text-sm text-scoreboard placeholder:text-dugout/50 focus:outline-none focus:ring-2 focus:ring-clay"
        />
        <input
          type="url"
          value={linkUrl}
          onChange={e => setLinkUrl(e.target.value)}
          placeholder="連結網址（選填，點公告會前往）"
          className="w-full rounded-lg border border-dugout/20 bg-chalk px-3 py-2 text-sm text-scoreboard placeholder:text-dugout/50 focus:outline-none focus:ring-2 focus:ring-clay"
        />
        <div className="flex justify-end">
          <button
            onClick={handleCreate}
            disabled={loading}
            className="rounded-lg bg-clay px-4 py-2 text-sm font-medium text-white hover:bg-clay-light disabled:opacity-50"
          >
            發佈公告
          </button>
        </div>
        <p className="text-xs text-dugout">橫幅只會顯示最新一則「上架中」的公告。</p>
      </div>

      <ul className="space-y-3">
        {items.map(item => (
          <li key={item.id} className="rounded-xl bg-surface p-4 shadow-sm">
            {editingId === item.id ? (
              <div className="space-y-2">
                <textarea
                  value={editMessage}
                  onChange={e => setEditMessage(e.target.value)}
                  rows={2}
                  className="w-full rounded-lg border border-dugout/20 bg-chalk px-3 py-2 text-sm text-scoreboard focus:outline-none focus:ring-2 focus:ring-clay"
                />
                <input
                  type="url"
                  value={editLinkUrl}
                  onChange={e => setEditLinkUrl(e.target.value)}
                  placeholder="連結網址（選填，點公告會前往）"
                  className="w-full rounded-lg border border-dugout/20 bg-chalk px-3 py-2 text-sm text-scoreboard placeholder:text-dugout/50 focus:outline-none focus:ring-2 focus:ring-clay"
                />
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setEditingId(null)}
                    disabled={loading}
                    className="rounded-lg px-3 py-1.5 text-xs font-medium text-dugout hover:bg-dugout/10 disabled:opacity-50"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleSaveEdit}
                    disabled={loading}
                    className="rounded-lg bg-clay px-3 py-1.5 text-xs font-medium text-white hover:bg-clay-light disabled:opacity-50"
                  >
                    儲存
                  </button>
                </div>
              </div>
            ) : (
              <>
                <p className="text-sm text-scoreboard break-words">{item.message}</p>
                {item.link_url && (
                  <p className="mt-1 text-xs text-clay break-all">{item.link_url}</p>
                )}
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-xs text-dugout">{formatDate(item.created_at)}</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleActive(item)}
                      className={`rounded-full px-3 py-1 text-xs font-medium ${
                        item.is_active
                          ? 'bg-tsg/10 text-tsg'
                          : 'bg-dugout/10 text-dugout'
                      }`}
                    >
                      {item.is_active ? '上架中' : '已下架'}
                    </button>
                    <button
                      onClick={() => startEdit(item)}
                      aria-label="編輯公告"
                      className="p-1.5 rounded text-dugout hover:text-scoreboard"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(item)}
                      aria-label="刪除公告"
                      className="p-1.5 rounded text-dugout hover:text-wei"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </>
            )}
          </li>
        ))}
        {items.length === 0 && (
          <li className="text-sm text-dugout text-center py-8">目前沒有任何公告</li>
        )}
      </ul>
    </div>
  )
}
