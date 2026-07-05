'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Cropper, { type Area } from 'react-easy-crop'
import { createClient } from '@/lib/supabase/client'
import { ListingCard } from '@/components/listings/ListingCard'
import { getCroppedImage, formatDate } from '@/lib/utils'
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
  const [changingPassword, setChangingPassword] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [passwordSuccess, setPasswordSuccess] = useState(false)
  const [cropFile, setCropFile] = useState<File | null>(null)
  const [cropImageUrl, setCropImageUrl] = useState<string | null>(null)
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)
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
        .select('*, profile:profiles!listings_user_id_fkey(id, username, avatar_url, rating_count), comment_count:comments(count)')
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

  const handleChangePassword = async () => {
    setPasswordError('')

    if (newPassword.length < 6) {
      setPasswordError('密碼至少需要 6 個字元')
      return
    }
    if (newPassword !== confirmNewPassword) {
      setPasswordError('兩次輸入的密碼不一致')
      return
    }

    setPasswordSaving(true)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setPasswordSaving(false)

    if (error) {
      setPasswordError('修改失敗：' + error.message)
      return
    }

    setNewPassword('')
    setConfirmNewPassword('')
    setChangingPassword(false)
    setPasswordSuccess(true)
    setTimeout(() => setPasswordSuccess(false), 3000)
  }

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setCropFile(file)
    setCropImageUrl(URL.createObjectURL(file))
    setCrop({ x: 0, y: 0 })
    setZoom(1)
    setCroppedAreaPixels(null)
  }

  const closeCropModal = () => {
    if (cropImageUrl) URL.revokeObjectURL(cropImageUrl)
    setCropFile(null)
    setCropImageUrl(null)
  }

  const onCropComplete = useCallback((_: Area, areaPixels: Area) => {
    setCroppedAreaPixels(areaPixels)
  }, [])

  const handleCropConfirm = async () => {
    if (!cropFile || !profile || !croppedAreaPixels) return
    setUploadingAvatar(true)

    try {
      const { blob, ext, contentType } = await getCroppedImage(cropFile, croppedAreaPixels, 400, 0.85)
      const path = `avatars/${profile.id}.${ext}`
      const { error } = await supabase.storage
        .from('images')
        .upload(path, blob, { contentType, upsert: true })

      if (!error) {
        const { data: { publicUrl } } = supabase.storage.from('images').getPublicUrl(path)
        const avatarUrl = `${publicUrl}?t=${Date.now()}`
        await supabase.from('profiles').update({ avatar_url: avatarUrl }).eq('id', profile.id)
        setProfile({ ...profile, avatar_url: avatarUrl })
      }
    } catch {
      // 裁切/上傳失敗（損毀檔、不支援格式）：不讓按鈕卡在上傳中
    } finally {
      setUploadingAvatar(false)
      closeCropModal()
    }
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
      {/* 頭像裁切彈窗 */}
      {cropImageUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-scoreboard/60 px-4">
          <div className="card w-full max-w-sm p-5">
            <div className="relative h-72 w-full overflow-hidden rounded-lg bg-scoreboard/5">
              <Cropper
                image={cropImageUrl}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="round"
                showGrid={false}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
              />
            </div>
            <input
              type="range"
              min={1}
              max={3}
              step={0.01}
              value={zoom}
              onChange={e => setZoom(Number(e.target.value))}
              className="mt-4 w-full"
            />
            <div className="mt-4 flex gap-2">
              <button
                className="btn-secondary flex-1"
                onClick={closeCropModal}
                disabled={uploadingAvatar}
              >
                取消
              </button>
              <button
                className="btn-primary flex-1"
                onClick={handleCropConfirm}
                disabled={uploadingAvatar || !croppedAreaPixels}
              >
                {uploadingAvatar ? '上傳中...' : '確認上傳'}
              </button>
            </div>
          </div>
        </div>
      )}

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

      {/* 帳號安全 */}
      <div id="security" className="card mt-4 scroll-mt-20 p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-base text-scoreboard">帳號安全</h2>
          {!changingPassword && (
            <button
              className="btn-secondary px-3 py-1.5 text-xs"
              onClick={() => {
                setChangingPassword(true)
                setPasswordError('')
              }}
            >
              修改密碼
            </button>
          )}
        </div>

        {passwordSuccess && !changingPassword && (
          <p className="mt-3 text-sm text-field">密碼已修改成功</p>
        )}

        {changingPassword && (
          <div className="mt-3 space-y-3">
            {passwordError && (
              <div className="rounded-md bg-clay/10 px-4 py-3 text-sm text-clay-dark">
                {passwordError}
              </div>
            )}
            <div>
              <label className="mb-1 block text-sm font-medium text-scoreboard">新密碼</label>
              <input
                type="password"
                className="input"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                minLength={6}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-scoreboard">確認新密碼</label>
              <input
                type="password"
                className="input"
                value={confirmNewPassword}
                onChange={e => setConfirmNewPassword(e.target.value)}
                minLength={6}
              />
            </div>
            <div className="flex gap-2">
              <button className="btn-primary px-3 py-1.5 text-xs" onClick={handleChangePassword} disabled={passwordSaving}>
                {passwordSaving ? '儲存中...' : '儲存'}
              </button>
              <button
                className="btn-secondary px-3 py-1.5 text-xs"
                onClick={() => {
                  setChangingPassword(false)
                  setNewPassword('')
                  setConfirmNewPassword('')
                  setPasswordError('')
                }}
              >
                取消
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 刊登中 */}
      <div className="mt-8">
        <div className="border-b-2 border-scoreboard/10 pb-3">
          <h2 className="font-display text-base text-scoreboard">刊登中（{activeListings.length}）</h2>
        </div>

        {activeListings.length === 0 ? (
          <div className="mt-10 flex flex-col items-center text-center">
            <p className="text-sm text-dugout">還沒有刊登過商品</p>
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
