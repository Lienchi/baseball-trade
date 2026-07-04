'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { compressImage } from '@/lib/utils'
import { CPBL_TEAMS, DEAL_METHOD_LABELS, DEAL_METHOD_OPTIONS, LISTING_LIMITS } from '@/types'
import type { DealMethod } from '@/types'
import { Upload, X, Ticket, Shirt, Plus, Trash2, EyeOff } from 'lucide-react'
import { RedactModal } from '@/components/listings/RedactModal'

// 表單內的場次列（票價以字串暫存，送出時轉數字）
interface TicketItemForm {
  date: string
  seat: string
  price: string
}

// 表單內的周邊商品列
interface MerchandiseItemForm {
  name: string
  price: string
}

export default function NewListingPage() {
  const supabase = createClient()
  const router = useRouter()

  const [form, setForm] = useState({
    title: '',
    description: '',
    type: 'ticket' as 'ticket' | 'merchandise',
    deal_methods: ['meetup'] as DealMethod[],
    location: '',
    team: '',
  })
  const [ticketItems, setTicketItems] = useState<TicketItemForm[]>([{ date: '', seat: '', price: '' }])
  const [merchandiseItems, setMerchandiseItems] = useState<MerchandiseItemForm[]>([{ name: '', price: '' }])
  const [images, setImages] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [redactingIndex, setRedactingIndex] = useState<number | null>(null)
  const [reviewQueue, setReviewQueue] = useState<number[]>([])

  const handleImageAdd = async (files: FileList) => {
    const startIndex = images.length
    const newFiles = Array.from(files).slice(0, 5 - images.length)
    setImages(prev => [...prev, ...newFiles])
    const urls = newFiles.map(f => URL.createObjectURL(f))
    setPreviews(prev => [...prev, ...urls])

    // 新加入的照片先跳出裁切/遮蔽確認頁，讓使用者上傳後立刻檢查
    const newIndices = newFiles.map((_, i) => startIndex + i)
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

  const removeImage = (i: number) => {
    setImages(prev => prev.filter((_, idx) => idx !== i))
    setPreviews(prev => prev.filter((_, idx) => idx !== i))
    setReviewQueue(prev => prev.filter(idx => idx !== i).map(idx => idx > i ? idx - 1 : idx))
    setRedactingIndex(prev => prev === null ? null : prev === i ? null : prev > i ? prev - 1 : prev)
  }

  const handleRedactConfirm = (blob: Blob) => {
    if (redactingIndex === null) return
    const i = redactingIndex
    const newFile = new File([blob], `redacted-${Date.now()}.png`, { type: 'image/png' })
    setImages(prev => prev.map((f, idx) => idx === i ? newFile : f))
    setPreviews(prev => {
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
    setLoading(true)
    setError('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); setLoading(false); return }

    // 同時上架數量限制（DB trigger 也會擋，這裡先給友善提示）
    const { count: activeCount } = await supabase
      .from('listings')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('type', form.type)
      .eq('status', 'active')
    if ((activeCount ?? 0) >= LISTING_LIMITS[form.type]) {
      setError(
        `${form.type === 'ticket' ? '球票' : '周邊商品'}同時上架以 ${LISTING_LIMITS[form.type]} 篇為限，` +
        '請先將已完成的刊登標記售出或刪除'
      )
      setLoading(false)
      return
    }

    // 平行壓縮+上傳，總時間 = 最慢的一張（Promise.all 保留原本順序）
    let imageUrls: string[]
    try {
      imageUrls = await Promise.all(images.map(async file => {
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
      setLoading(false)
      return
    }

    // 球票：過濾掉沒填日期的場次，game_date 存最早場次供排序/篩選；周邊：過濾掉沒填名稱的商品
    const validItems = form.type === 'ticket'
      ? ticketItems.filter(t => t.date).map(t => ({
          date: t.date,
          seat: t.seat,
          price: t.price ? parseInt(t.price) : null,
        }))
      : merchandiseItems.filter(m => m.name).map(m => ({
          name: m.name,
          price: m.price ? parseInt(m.price) : null,
        }))
    const sortedDates = form.type === 'ticket'
      ? (validItems as { date: string }[]).map(t => t.date).sort()
      : []
    const earliestDate = sortedDates[0] ?? null
    const latestDate = sortedDates[sortedDates.length - 1] ?? null

    const { data, error: insertError } = await supabase
      .from('listings')
      .insert({
        user_id: user.id,
        title: form.title,
        description: form.description,
        type: form.type,
        deal_methods: form.deal_methods,
        location: form.location || null,
        team: form.team || null,
        game_date: earliestDate,
        last_game_date: latestDate,
        ticket_items: validItems,
        images: imageUrls,
      })
      .select()
      .single()

    if (insertError || !data) {
      setError('發文失敗，請稍後再試')
      setLoading(false)
      return
    }

    router.push(`/listings/${data.id}`)
  }

  const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }))

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

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-6 font-display text-xl text-scoreboard">刊登商品</h1>

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
                      className="input w-20 flex-shrink-0"
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
            <button
              type="button"
              className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-field hover:underline dark:text-blue-400"
              onClick={() => setMerchandiseItems(prev => [...prev, { name: '', price: '' }])}
            >
              <Plus size={14} /> 新增商品
            </button>
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
            {previews.map((url, i) => (
              <div key={i} className="relative aspect-square">
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
                  onClick={() => removeImage(i)}
                >
                  <X size={12} />
                </button>
              </div>
            ))}
            {previews.length < 5 && (
              <label className="flex aspect-square cursor-pointer items-center justify-center rounded-md border-2 border-dashed border-scoreboard/15 text-dugout/50 hover:border-clay hover:text-clay">
                <Upload size={20} />
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={e => e.target.files && handleImageAdd(e.target.files)}
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

        <button type="submit" className="btn-primary w-full py-3" disabled={loading}>
          {loading ? '刊登中...' : '發布商品'}
        </button>
      </form>

      {redactingIndex !== null && (
        <RedactModal
          file={images[redactingIndex]}
          onCancel={handleRedactCancel}
          onConfirm={handleRedactConfirm}
        />
      )}
    </div>
  )
}
