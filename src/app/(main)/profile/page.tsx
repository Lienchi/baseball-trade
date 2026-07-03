'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { ListingCard } from '@/components/listings/ListingCard'
import { compressImage, formatDate } from '@/lib/utils'
import { Camera } from 'lucide-react'
import type { Profile, Listing } from '@/types'

export default function ProfilePage() {
  const supabase = createClient()
  const router = useRouter()
  const avatarInputRef = useRef<HTMLInputElement>(null)

  const [profile, setProfile] = useState<Profile | null>(null)
  const [activeListings, setActiveListings] = useState<Listing[]>([])
  const [soldListings, setSoldListings] = useState<Listing[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [bio, setBio] = useState('')
  const [saving, setSaving] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (profileData) {
        setProfile(profileData)
        setBio(profileData.bio ?? '')
      }

      const { data: listingsData } = await supabase
        .from('listings')
        .select('*, profile:profiles(id, username, avatar_url, rating, rating_count), comment_count:comments(count)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (listingsData) {
        const normalized = listingsData.map(l => ({
          ...l,
          comment_count: Array.isArray(l.comment_count) ? (l.comment_count[0]?.count ?? 0) : 0,
        })) as Listing[]
        setActiveListings(normalized.filter(l => l.status === 'active'))
        setSoldListings(normalized.filter(l => l.status === 'sold'))
      }

      setLoading(false)
    }
    load()
  }, [supabase, router])

  const handleSaveBio = async () => {
    if (!profile) return
    setSaving(true)
    await supabase.from('profiles').update({ bio }).eq('id', profile.id)
    setProfile({ ...profile, bio })
    setEditing(false)
    setSaving(false)
  }

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !profile) return
    setUploadingAvatar(true)

    const blob = await compressImage(file, 400, 0.85)
    const path = `avatars/${profile.id}.webp`
    const { error } = await supabase.storage
      .from('images')
      .upload(path, blob, { contentType: 'image/webp', upsert: true })

    if (!error) {
      const { data: { publicUrl } } = supabase.storage.from('images').getPublicUrl(path)
      const avatarUrl = `${publicUrl}?t=${Date.now()}`
      await supabase.from('profiles').update({ avatar_url: avatarUrl }).eq('id', profile.id)
      setProfile({ ...profile, avatar_url: avatarUrl })
    }
    setUploadingAvatar(false)
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <p className="text-sm text-dugout">載入中...</p>
      </div>
    )
  }

  if (!profile) return null

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {/* 個人資訊卡 */}
      <div className="card flex items-start gap-4 p-5">
        {/* 頭像 */}
        <div className="relative flex-shrink-0">
          <button
            className="group relative h-16 w-16 overflow-hidden rounded-full"
            onClick={() => avatarInputRef.current?.click()}
            disabled={uploadingAvatar}
          >
            {profile.avatar_url ? (
              <Image
                src={profile.avatar_url}
                alt={profile.username}
                fill
                className="object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-field text-xl font-bold text-white">
                {profile.username.slice(0, 2).toUpperCase()}
              </div>
            )}
            <div className="absolute inset-0 flex items-center justify-center bg-scoreboard/50 opacity-0 transition group-hover:opacity-100">
              {uploadingAvatar ? (
                <span className="text-xs text-chalk">上傳中</span>
              ) : (
                <Camera size={18} className="text-chalk" />
              )}
            </div>
          </button>
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleAvatarChange}
          />
        </div>

        <div className="flex-1">
          <h1 className="font-display text-lg text-scoreboard">{profile.username}</h1>
          <p className="mt-0.5 flex items-center gap-1 text-sm text-dugout">
            <span className="text-gold">⭐</span>
            <span className="font-bold text-scoreboard">{profile.rating_count}</span>
            <span>顆星 · 加入於 {formatDate(profile.created_at)}</span>
          </p>

          {editing ? (
            <div className="mt-3">
              <textarea
                className="input resize-none"
                rows={2}
                placeholder="介紹一下自己..."
                value={bio}
                onChange={e => setBio(e.target.value)}
                maxLength={150}
              />
              <div className="mt-2 flex gap-2">
                <button className="btn-primary px-3 py-1.5 text-xs" onClick={handleSaveBio} disabled={saving}>
                  {saving ? '儲存中...' : '儲存'}
                </button>
                <button className="btn-secondary px-3 py-1.5 text-xs" onClick={() => setEditing(false)}>
                  取消
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-3 flex items-start justify-between gap-3">
              <p className="text-sm text-dugout">{profile.bio || '這個人很神秘，還沒留下自我介紹'}</p>
              <button className="btn-secondary flex-shrink-0 px-3 py-1.5 text-xs" onClick={() => setEditing(true)}>
                編輯
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 刊登中 */}
      <div className="mt-8">
        <div className="flex items-center justify-between border-b-2 border-scoreboard/10 pb-3">
          <h2 className="font-display text-base text-scoreboard">刊登中（{activeListings.length}）</h2>
          <Link href="/listings/new" className="btn-primary px-3 py-1.5 text-xs">
            + 刊登
          </Link>
        </div>

        {activeListings.length === 0 ? (
          <div className="mt-10 flex flex-col items-center text-center">
            <span className="text-3xl">⚾</span>
            <p className="mt-2 text-sm text-dugout">還沒有刊登過商品</p>
          </div>
        ) : (
          <div className="mt-5 grid grid-cols-2 gap-4 lg:grid-cols-3">
            {activeListings.map(listing => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </div>
        )}
      </div>

      {/* 已售出 */}
      {soldListings.length > 0 && (
        <div className="mt-10">
          <div className="border-b-2 border-scoreboard/10 pb-3">
            <h2 className="font-display text-base text-scoreboard">已售出（{soldListings.length}）</h2>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-4 lg:grid-cols-3">
            {soldListings.map(listing => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
