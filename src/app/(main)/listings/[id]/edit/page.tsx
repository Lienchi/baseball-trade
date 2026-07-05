'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { compressImage, storagePathFromUrl } from '@/lib/utils'
import { CPBL_TEAMS, DEAL_METHOD_LABELS, DEAL_METHOD_OPTIONS, MAX_ITEMS_PER_LISTING } from '@/types'
import type { DealMethod, TicketItem } from '@/types'
import { Upload, X, Ticket, Shirt, Plus, Trash2, EyeOff } from 'lucide-react'
import { RedactModal } from '@/components/listings/RedactModal'

// 表單內的場次列（票價以字串暫存，送出時轉數字）
interface TicketItemForm {
  id?: string   // 既有場次保留原 id（維持場次級關注的連結），新增列送出時才生成
  date: string
  seat: string
  price: string
  sold: boolean
}

// 表單內的周邊商品列
interface MerchandiseItemForm {
  id?: string
  name: string
  price: string
  sold: boolean
}

export default function EditListingPage() {
  const supabase = createClient()
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [form, setForm] = useState({
    title: '',
    description: '',
    type: 'ticket' as 'ticket' | 'merchandise',
    deal_methods: [] as DealMethod[],
    location: '',
    team: '',
  })
  const [ticketItems, setTicketItems] = useState<TicketItemForm[]>([{ date: '', seat: '', price: '', sold: false }])
  const [merchandiseItems, setMerchandiseItems] = useState<MerchandiseItemForm[]>([{ name: '', price: '', sold: false }])
  const [existingImages, setExistingImages] = useState<string[]>([])
  const [originalImages, setOriginalImages] = useState<string[]>([])  // 載入時的圖片清單，存檔時比對出被移除的檔案
  const [newImages, setNewImages] = useState<File[]>([])
  const [newPreviews, setNewPreviews] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [redactingIndex, setRedactingIndex] = useState<number | null>(null)
  const [reviewQueue, setReviewQueue] = useState<number[]>([])

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: profile } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', user.id)
        .single()

      const { data: listing } = await supabase
        .from('listings')
        .select('*')
        .eq('id', id)
        .single()

      if (!listing) { router.push('/'); return }

      const isOwner = listing.user_id === user.id
      const isAdmin = (profile as any)?.is_admin === true
      if (!isOwner && !isAdmin) { router.push('/'); return }

      setForm({
        title: listing.title,
        description: listing.description,
        type: listing.type,
        deal_methods: listing.deal_methods ?? [],
        location: listing.location ?? '',
        team: listing.team ?? '',
      })
      if (listing.type === 'merchandise') {
        const items = ((listing.ticket_items ?? []) as TicketItem[]).map(t => ({
          id: t.id,
          name: t.name ?? '',
          price: t.price != null ? String(t.price) : '',
          sold: t.sold ?? false,
        }))
        setMerchandiseItems(items.length > 0 ? items : [{ name: '', price: '', sold: false }])
      } else {
        const items = ((listing.ticket_items ?? []) as TicketItem[]).map(t => ({
          id: t.id,
          date: t.date ?? '',
          seat: t.seat ?? '',
          price: t.price != null ? String(t.price) : '',
          sold: t.sold ?? false,
        }))
        setTicketItems(items.length > 0 ? items : [{ date: '', seat: '', price: '', sold: false }])
      }
      setExistingImages(listing.images ?? [])
      setOriginalImages(listing.images ?? [])
      setLoading(false)
    }
    load()
  }, [id, supabase, router])

  const removeExistingImage = (i: number) => {
    setExistingImages(prev => prev.filter((_, idx) => idx !== i))
  }

  const handleNewImages = (files: FileList) => {
    const total = existingImages.length + newImages.length
    const startIndex = newImages.length
    const added = Array.from(files).slice(0, 5 - total)
    setNewImages(prev => [...prev, ...added])
    setNewPreviews(prev => [...prev, ...added.map(f => URL.createObjectURL(f))])

    // 新加入的照片先跳出裁切/遮蔽確認頁，讓使用者上傳後立刻檢查
    const newIndices = added.map((_, i) => startIndex + i)
    setReviewQueue(prev => [...prev, ...newIndices])
    setRedactingIndex(prev => prev ?? newIndices[0] ?? null)
  }

  const advanceReview = (handledIndex: number) => {
    setReviewQueue(prev => {
      const rest = prev.filter(i => i !== handledIndex)
      setRedactingIndex(rest[0] ?? null)
      return rest
    })
  }

  const removeNewImage = (i: number) => {
    setNewImages(prev => prev.filter((_, idx) => idx !== i))
    setNewPreviews(prev => prev.filter((_, idx) => idx !== i))
    setReviewQueue(prev => prev.filter(idx => idx !== i).map(idx => idx > i ? idx - 1 : idx))
    setRedactingIndex(prev => prev === null ? null : prev === i ? null : prev > i ? prev - 1 : prev)
  }

  const handleRedactConfirm = (blob: Blob) => {
    if (redactingIndex === null) return
    const i = redactingIndex
    const newFile = new File([blob], `redacted-${Date.now()}.png`, { type: 'image/png' })
    setNewImages(prev => prev.map((f, idx) => idx === i ? newFile : f))
    setNewPreviews(prev => {
      URL.revokeObjectURL(prev[i])
      return prev.map((url, idx) => idx === i ? URL.createObjectURL(newFile) : url)
    })
    advanceReview(i)
  }

  const handleRedactCancel = () => {
    if (redactingIndex === null) return
    advanceReview(redactingIndex)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (form.deal_methods.length === 0) {
      setError('請至少選擇一種交易方式')
      return
    }
    setSaving(true)
    setError('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); setSaving(false); return }

    // 平行壓縮+上傳，總時間 = 最慢的一張（Promise.all 保留原本順序）
    let uploadedUrls: string[]
    try {
      uploadedUrls = await Promise.all(newImages.map(async file => {
        const { blob, ext, contentType } = await compressImage(file)
        const path = `listings/${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
        const { error: uploadError } = await supabase.storage
          .from('images')
          .upload(path, blob, { contentType })
        if (uploadError) throw new Error(`${uploadError.message}（${contentType}，${(blob.size / 1048576).toFixed(2)}MB）`)
        return supabase.storage.from('images').getPublicUrl(path).data.publicUrl
      }))
    } catch (err) {
      console.error('圖片上傳失敗', err)
      // 手機上開不了 devtools console，把實際錯誤附在畫面訊息裡才有辦法回報除錯
      const detail = err instanceof Error ? err.message : JSON.stringify(err)
      setError(`圖片上傳失敗：${detail}`)
      setSaving(false)
      return
    }

    // 球票：過濾掉沒填日期的場次，game_date 存最早場次供排序/篩選；周邊：過濾掉沒填名稱的商品
    const validItems = form.type === 'ticket'
      ? ticketItems.filter(t => t.date).map(t => ({
          id: t.id ?? crypto.randomUUID(),
          date: t.date,
          seat: t.seat,
          price: t.price ? parseInt(t.price) : null,
          sold: t.sold,
        }))
      : merchandiseItems.filter(m => m.name).map(m => ({
          id: m.id ?? crypto.randomUUID(),
          name: m.name,
          price: m.price ? parseInt(m.price) : null,
          sold: m.sold,
        }))
    const sortedDates = form.type === 'ticket'
      ? (validItems as { date: string }[]).map(t => t.date).sort()
      : []
    const earliestDate = sortedDates[0] ?? null
    const latestDate = sortedDates[sortedDates.length - 1] ?? null

    const { error: updateError } = await supabase
      .from('listings')
      .update({
        title: form.title,
        description: form.description,
        type: form.type,
        deal_methods: form.deal_methods,
        location: form.location || null,
        team: form.team || null,
        game_date: earliestDate,
        last_game_date: latestDate,
        ticket_items: validItems,
        images: [...existingImages, ...uploadedUrls],
      })
      .eq('id', id)

    if (updateError) {
      setError('更新失敗，請稍後再試')
      setSaving(false)
      return
    }

    // 把使用者移除的圖片從 Storage 清掉（失敗不擋流程，最多留下孤兒檔案）
    const removedPaths = originalImages
      .filter(url => !existingImages.includes(url))
      .map(storagePathFromUrl)
      .filter((p): p is string => p !== null)
    if (removedPaths.length > 0) {
      await supabase.storage.from('images').remove(removedPaths)
    }

    router.push(`/listings/${id}`)
  }

  const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }))
  const totalImages = existingImages.length + newImages.length

  // 切換類型時，把該類型不支援的交易方式（如周邊不適用電子票券）從已選項目中移除
  const setType = (t: 'ticket' | 'merchandise') => setForm(f => ({
    ...f,
    type: t,
    deal_methods: f.deal_methods.filter(m => DEAL_METHOD_OPTIONS[t].includes(m)),
  }))

  const toggleDealMethod = (m: DealMethod) => setForm(f => ({
    ...f,
    deal_methods: f.deal_methods.includes(m)
      ? f.deal_methods.filter(x => x !== m)
      : [...f.deal_methods, m],
  }))

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <p className="text-sm text-dugout">載入中...</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-6 font-display text-xl text-scoreboard">編輯刊登</h1>

      {error && (
        <div className="mb-4 rounded-md bg-clay/10 px-4 py-3 text-sm text-clay-dark">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="flex gap-3">
          {(['ticket', 'merchandise'] as const).map(t => (
            <button
              key={t}
              type="button"
              className={`flex-1 rounded-md border-2 py-3 text-sm font-bold transition ${
                form.type === t
                  ? 'border-field bg-field/10 text-field'
                  : 'border-scoreboard/10 text-dugout hover:border-scoreboard/20'
              }`}
              onClick={() => setType(t)}
            >
              <span className="inline-flex items-center gap-1.5">
                {t === 'ticket' ? <Ticket size={16} /> : <Shirt size={16} />}
                {t === 'ticket' ? '球票' : '周邊商品'}
              </span>
            </button>
          ))}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-scoreboard">標題 *</label>
          <input className="input" value={form.title} onChange={e => set('title', e.target.value)} required maxLength={80} />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-scoreboard">詳細說明 *</label>
          <textarea className="input h-auto" rows={8} value={form.description} onChange={e => set('description', e.target.value)} required />
        </div>


        {form.type === 'ticket' && (
          <>
            <div>
              <label className="mb-1 block text-sm font-medium text-scoreboard">球隊</label>
              <select className="input" value={form.team} onChange={e => set('team', e.target.value)}>
                <option value="">選擇球隊</option>
                {CPBL_TEAMS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-scoreboard">日期與座位 *</label>
              <div className="space-y-2">
                {ticketItems.map((item, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      type="date"
                      className="input w-32 flex-shrink-0"
                      value={item.date}
                      required
                      onChange={e => setTicketItems(prev => prev.map((t, idx) => idx === i ? { ...t, date: e.target.value } : t))}
                    />
                    <input
                      className="input flex-1"
                      placeholder="座位，e.g. 內野 A13 區 3 排"
                      value={item.seat}
                      required
                      onChange={e => setTicketItems(prev => prev.map((t, idx) => idx === i ? { ...t, seat: e.target.value } : t))}
                    />
                    <input
                      type="number"
                      min={0}
                      className="input w-16 flex-shrink-0 sm:w-24"
                      placeholder="票價"
                      value={item.price}
                      required
                      onChange={e => setTicketItems(prev => prev.map((t, idx) => idx === i ? { ...t, price: e.target.value } : t))}
                    />
                    {ticketItems.length > 1 && (
                      <button
                        type="button"
                        className="flex-shrink-0 p-2 text-dugout/50 hover:text-clay"
                        onClick={() => setTicketItems(prev => prev.filter((_, idx) => idx !== i))}
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {ticketItems.length < MAX_ITEMS_PER_LISTING && (
                <button
                  type="button"
                  className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-field hover:underline dark:text-blue-400"
                  onClick={() => setTicketItems(prev => [...prev, { date: '', seat: '', price: '', sold: false }])}
                >
                  <Plus size={14} /> 新增場次
                </button>
              )}
            </div>
          </>
        )}

        {form.type === 'merchandise' && (
          <div>
            <label className="mb-1 block text-sm font-medium text-scoreboard">商品與價格 *</label>
            <div className="space-y-2">
              {merchandiseItems.map((item, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    className="input flex-1"
                    placeholder="商品名稱，e.g. 主場復刻球衣 M 號"
                    value={item.name}
                    required
                    onChange={e => setMerchandiseItems(prev => prev.map((m, idx) => idx === i ? { ...m, name: e.target.value } : m))}
                  />
                  <input
                    type="number"
                    min={0}
                    className="input w-24 flex-shrink-0"
                    placeholder="價格"
                    value={item.price}
                    required
                    onChange={e => setMerchandiseItems(prev => prev.map((m, idx) => idx === i ? { ...m, price: e.target.value } : m))}
                  />
                  {merchandiseItems.length > 1 && (
                    <button
                      type="button"
                      className="flex-shrink-0 p-2 text-dugout/50 hover:text-clay"
                      onClick={() => setMerchandiseItems(prev => prev.filter((_, idx) => idx !== i))}
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              ))}
            </div>
            {merchandiseItems.length < MAX_ITEMS_PER_LISTING && (
              <button
                type="button"
                className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-field hover:underline dark:text-blue-400"
                onClick={() => setMerchandiseItems(prev => [...prev, { name: '', price: '', sold: false }])}
              >
                <Plus size={14} /> 新增商品
              </button>
            )}
          </div>
        )}

        <div>
          <label className="mb-1 block text-sm font-medium text-scoreboard">交易方式（可複選）*</label>
          <div className="flex flex-wrap gap-2">
            {DEAL_METHOD_OPTIONS[form.type].map(m => (
              <button
                key={m}
                type="button"
                className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                  form.deal_methods.includes(m)
                    ? 'border-field bg-field/10 text-field'
                    : 'border-scoreboard/20 text-dugout hover:border-scoreboard/40'
                }`}
                onClick={() => toggleDealMethod(m)}
              >
                {DEAL_METHOD_LABELS[m]}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-scoreboard">地點（選填）</label>
          <input className="input" placeholder="e.g. 台北市大安區" value={form.location} onChange={e => set('location', e.target.value)} />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-scoreboard">商品圖片（最多 5 張）</label>
          <div className="grid grid-cols-5 gap-2">
            {existingImages.map((url, i) => (
              <div key={`existing-${i}`} className="relative aspect-square">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="h-full w-full rounded-md object-cover" />
                <button
                  type="button"
                  className="absolute -right-1 -top-1 rounded-full bg-clay p-0.5 text-white"
                  onClick={() => removeExistingImage(i)}
                >
                  <X size={12} />
                </button>
              </div>
            ))}
            {newPreviews.map((url, i) => (
              <div key={`new-${i}`} className="relative aspect-square">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="h-full w-full rounded-md object-cover" />
                <button
                  type="button"
                  className="absolute -left-1 -top-1 rounded-full bg-scoreboard p-0.5 text-white"
                  onClick={() => setRedactingIndex(i)}
                  title="遮蔽個人資訊"
                >
                  <EyeOff size={12} />
                </button>
                <button
                  type="button"
                  className="absolute -right-1 -top-1 rounded-full bg-clay p-0.5 text-white"
                  onClick={() => removeNewImage(i)}
                >
                  <X size={12} />
                </button>
              </div>
            ))}
            {totalImages < 5 && (
              <label className="flex aspect-square cursor-pointer items-center justify-center rounded-md border-2 border-dashed border-scoreboard/15 text-dugout/50 hover:border-clay hover:text-clay">
                <Upload size={20} />
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={e => e.target.files && handleNewImages(e.target.files)}
                />
              </label>
            )}
          </div>
        </div>

        <p className="text-xs text-dugout">
          刊登即表示你同意遵守
          <Link href="/terms" target="_blank" className="font-medium text-field hover:underline dark:text-blue-400">
            網站規定
          </Link>
          ；球票僅限原價（含）以下轉讓
        </p>

        <div className="flex gap-3">
          <button type="submit" className="btn-primary flex-1 py-3" disabled={saving}>
            {saving ? '儲存中...' : '儲存變更'}
          </button>
          <button type="button" className="btn-secondary px-5" onClick={() => router.back()}>
            取消
          </button>
        </div>
      </form>

      {redactingIndex !== null && (
        <RedactModal
          file={newImages[redactingIndex]}
          onCancel={handleRedactCancel}
          onConfirm={handleRedactConfirm}
        />
      )}
    </div>
  )
}
