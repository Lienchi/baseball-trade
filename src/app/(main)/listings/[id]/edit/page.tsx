'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { compressImage } from '@/lib/utils'
import { CPBL_TEAMS, DEAL_METHOD_LABELS, DEAL_METHOD_OPTIONS } from '@/types'
import type { DealMethod, TicketItem } from '@/types'
import { Upload, X, Ticket, Shirt, Plus, Trash2 } from 'lucide-react'

// 表單內的場次列（票價以字串暫存，送出時轉數字）
interface TicketItemForm {
  date: string
  seat: string
  price: string
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
  const [ticketItems, setTicketItems] = useState<TicketItemForm[]>([{ date: '', seat: '', price: '' }])
  const [existingImages, setExistingImages] = useState<string[]>([])
  const [newImages, setNewImages] = useState<File[]>([])
  const [newPreviews, setNewPreviews] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

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
      const items = ((listing.ticket_items ?? []) as TicketItem[]).map(t => ({
        date: t.date,
        seat: t.seat ?? '',
        price: t.price != null ? String(t.price) : '',
      }))
      setTicketItems(items.length > 0 ? items : [{ date: '', seat: '', price: '' }])
      setExistingImages(listing.images ?? [])
      setLoading(false)
    }
    load()
  }, [id, supabase, router])

  const removeExistingImage = (i: number) => {
    setExistingImages(prev => prev.filter((_, idx) => idx !== i))
  }

  const handleNewImages = (files: FileList) => {
    const total = existingImages.length + newImages.length
    const added = Array.from(files).slice(0, 5 - total)
    setNewImages(prev => [...prev, ...added])
    setNewPreviews(prev => [...prev, ...added.map(f => URL.createObjectURL(f))])
  }

  const removeNewImage = (i: number) => {
    setNewImages(prev => prev.filter((_, idx) => idx !== i))
    setNewPreviews(prev => prev.filter((_, idx) => idx !== i))
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
    if (!user) { router.push('/login'); return }

    // 平行壓縮+上傳，總時間 = 最慢的一張（Promise.all 保留原本順序）
    let uploadedUrls: string[]
    try {
      uploadedUrls = await Promise.all(newImages.map(async file => {
        const blob = await compressImage(file)
        const path = `listings/${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.webp`
        const { error: uploadError } = await supabase.storage
          .from('images')
          .upload(path, blob, { contentType: 'image/webp' })
        if (uploadError) throw uploadError
        return supabase.storage.from('images').getPublicUrl(path).data.publicUrl
      }))
    } catch {
      setError('圖片上傳失敗')
      setSaving(false)
      return
    }

    // 過濾掉沒填日期的場次，game_date 存最早場次供排序/篩選
    const validItems = form.type === 'ticket'
      ? ticketItems.filter(t => t.date).map(t => ({
          date: t.date,
          seat: t.seat,
          price: t.price ? parseInt(t.price) : null,
        }))
      : []
    const sortedDates = validItems.map(t => t.date).sort()
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
          <textarea className="input" rows={4} value={form.description} onChange={e => set('description', e.target.value)} required />
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
              <label className="mb-1 block text-sm font-medium text-scoreboard">場次與座位 *</label>
              <div className="space-y-2">
                {ticketItems.map((item, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      type="date"
                      className="input w-auto flex-shrink-0"
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
                      className="input w-24 flex-shrink-0"
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
              <button
                type="button"
                className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-field hover:underline dark:text-blue-400"
                onClick={() => setTicketItems(prev => [...prev, { date: '', seat: '', price: '' }])}
              >
                <Plus size={14} /> 新增場次
              </button>
            </div>
          </>
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

        <div className="flex gap-3">
          <button type="submit" className="btn-primary flex-1 py-3" disabled={saving}>
            {saving ? '儲存中...' : '儲存變更'}
          </button>
          <button type="button" className="btn-secondary px-5" onClick={() => router.back()}>
            取消
          </button>
        </div>
      </form>
    </div>
  )
}
