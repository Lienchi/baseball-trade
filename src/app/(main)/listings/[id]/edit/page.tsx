'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { compressImage } from '@/lib/utils'
import { CPBL_TEAMS } from '@/types'
import { Upload, X } from 'lucide-react'

export default function EditListingPage() {
  const supabase = createClient()
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

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
        price: String(listing.price),
        is_negotiable: listing.is_negotiable,
        deal_method: listing.deal_method,
        location: listing.location ?? '',
        team: listing.team ?? '',
        game_date: listing.game_date ?? '',
      })
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
    setSaving(true)
    setError('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const uploadedUrls: string[] = []
    for (const file of newImages) {
      const blob = await compressImage(file)
      const path = `listings/${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.webp`
      const { error: uploadError } = await supabase.storage
        .from('images')
        .upload(path, blob, { contentType: 'image/webp' })
      if (uploadError) { setError('圖片上傳失敗'); setSaving(false); return }
      const { data: { publicUrl } } = supabase.storage.from('images').getPublicUrl(path)
      uploadedUrls.push(publicUrl)
    }

    const { error: updateError } = await supabase
      .from('listings')
      .update({
        title: form.title,
        description: form.description,
        type: form.type,
        price: parseInt(form.price),
        is_negotiable: form.is_negotiable,
        deal_method: form.deal_method,
        location: form.location || null,
        team: form.team || null,
        game_date: form.game_date || null,
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
            {existingImages.map((url, i) => (
              <div key={`existing-${i}`} className="relative aspect-square">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="h-full w-full rounded-md object-cover" />
                <button
                  type="button"
                  className="absolute -right-1 -top-1 rounded-full bg-clay p-0.5 text-chalk"
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
                  className="absolute -right-1 -top-1 rounded-full bg-clay p-0.5 text-chalk"
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
