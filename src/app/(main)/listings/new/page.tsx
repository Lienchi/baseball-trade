'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { compressImage } from '@/lib/utils'
import { CPBL_TEAMS } from '@/types'
import { Upload, X } from 'lucide-react'

export default function NewListingPage() {
  const supabase = createClient()
  const router = useRouter()

  const [form, setForm] = useState({
    title: '',
    description: '',
    type: 'ticket' as 'ticket' | 'merchandise',
    price: '',
    is_negotiable: false,
    deal_method: 'both' as 'meetup' | 'mail' | 'both',
    location: '',
    team: '',
    game_date: '',
  })
  const [images, setImages] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleImageAdd = async (files: FileList) => {
    const newFiles = Array.from(files).slice(0, 5 - images.length)
    setImages(prev => [...prev, ...newFiles])
    const urls = newFiles.map(f => URL.createObjectURL(f))
    setPreviews(prev => [...prev, ...urls])
  }

  const removeImage = (i: number) => {
    setImages(prev => prev.filter((_, idx) => idx !== i))
    setPreviews(prev => prev.filter((_, idx) => idx !== i))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const imageUrls: string[] = []
    for (const file of images) {
      const blob = await compressImage(file)
      const path = `listings/${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.webp`
      const { error: uploadError } = await supabase.storage
        .from('images')
        .upload(path, blob, { contentType: 'image/webp' })
      if (uploadError) { setError('圖片上傳失敗'); setLoading(false); return }
      const { data: { publicUrl } } = supabase.storage.from('images').getPublicUrl(path)
      imageUrls.push(publicUrl)
    }

    const { data, error: insertError } = await supabase
      .from('listings')
      .insert({
        user_id: user.id,
        title: form.title,
        description: form.description,
        type: form.type,
        price: parseInt(form.price),
        is_negotiable: form.is_negotiable,
        deal_method: form.deal_method,
        location: form.location || null,
        team: form.team || null,
        game_date: form.game_date || null,
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
              onClick={() => set('type', t)}
            >
              {t === 'ticket' ? '⚾ 球票' : '🎽 周邊商品'}
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

        <div className="flex gap-3">
          <div className="flex-1">
            <label className="mb-1 block text-sm font-medium text-scoreboard">售價（NT$）*</label>
            <input className="input" type="number" min={0} value={form.price} onChange={e => set('price', e.target.value)} required />
          </div>
          <div className="flex items-end pb-2">
            <label className="flex items-center gap-2 text-sm text-scoreboard">
              <input type="checkbox" checked={form.is_negotiable} onChange={e => set('is_negotiable', e.target.checked)} />
              可議價
            </label>
          </div>
        </div>

        {form.type === 'ticket' && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-scoreboard">球隊</label>
              <select className="input" value={form.team} onChange={e => set('team', e.target.value)}>
                <option value="">選擇球隊</option>
                {CPBL_TEAMS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-scoreboard">比賽日期</label>
              <input type="date" className="input" value={form.game_date} onChange={e => set('game_date', e.target.value)} />
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-scoreboard">交易方式</label>
            <select className="input" value={form.deal_method} onChange={e => set('deal_method', e.target.value)}>
              <option value="both">面交 / 郵寄</option>
              <option value="meetup">僅限面交</option>
              <option value="mail">僅限郵寄</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-scoreboard">地點（選填）</label>
            <input className="input" placeholder="e.g. 台北市大安區" value={form.location} onChange={e => set('location', e.target.value)} />
          </div>
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
                  className="absolute -right-1 -top-1 rounded-full bg-clay p-0.5 text-chalk"
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

        <button type="submit" className="btn-primary w-full py-3" disabled={loading}>
          {loading ? '刊登中...' : '發布商品'}
        </button>
      </form>
    </div>
  )
}
