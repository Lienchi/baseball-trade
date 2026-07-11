'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Cropper, { type Area } from 'react-easy-crop'
import { createClient } from '@/lib/supabase/client'
import { ListingCard } from '@/components/listings/ListingCard'
import { ReviewList } from '@/components/ReviewList'
import { SocialLinkRow } from '@/components/SocialLinkRow'
import { Skeleton } from '@/components/ui/Skeleton'
import { getCroppedImage, formatDate, normalizeSocialHandle, isPastGameDate, isSuspendedUntil } from '@/lib/utils'
import Link from 'next/link'
import { Camera, Megaphone } from 'lucide-react'
import type { Profile, Listing } from '@/types'

export default function ProfilePage() {
  const supabase = createClient()
  const router = useRouter()
  const avatarInputRef = useRef<HTMLInputElement>(null)

  const [profile, setProfile] = useState<Profile | null>(null)
  const [activeListings, setActiveListings] = useState<Listing[]>([])
  const [soldListings, setSoldListings] = useState<Listing[]>([])
  const [inactiveListings, setInactiveListings] = useState<Listing[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [bio, setBio] = useState('')
  const [threads, setThreads] = useState('')
  const [instagram, setInstagram] = useState('')
  const [lineId, setLineId] = useState('')
  const [socialError, setSocialError] = useState('')
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
        setThreads(profileData.social_links?.threads ?? '')
        setInstagram(profileData.social_links?.instagram ?? '')
        setLineId(profileData.social_links?.line ?? '')
      }

      const { data: listingsData } = await supabase
        .from('listings')
        .select('*, profile:profiles!listings_user_id_fkey(id, username, avatar_url, rating, rating_count, deal_count), comment_count:comments(count)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (listingsData) {
        const normalized = listingsData.map(l => ({
          ...l,
          comment_count: Array.isArray(l.comment_count) ? (l.comment_count[0]?.count ?? 0) : 0,
        })) as Listing[]
        // 場次全過期但排程還沒標 expired 的，即時歸入已下架區
        const isExpiredByDate = (l: Listing) => isPastGameDate(l.last_game_date)
        setActiveListings(normalized.filter(l => l.status === 'active' && !isExpiredByDate(l)))
        setSoldListings(normalized.filter(l => l.status === 'sold'))
        setInactiveListings(normalized.filter(l =>
          l.status === 'expired' || l.status === 'removed' || (l.status === 'active' && isExpiredByDate(l))
        ))
      }

      setLoading(false)
    }
    load()
  }, [supabase, router])

  const handleSaveBio = async () => {
    if (!profile) return
    setSocialError('')

    const normalizedThreads = normalizeSocialHandle(threads, 'threads')
    const normalizedInstagram = normalizeSocialHandle(instagram, 'instagram')
    const normalizedLine = normalizeSocialHandle(lineId, 'line')
    if (normalizedThreads === null || normalizedInstagram === null || normalizedLine === null) {
      setSocialError('社群帳號只能包含英文、數字、句點與底線（LINE ID 可含連字號，不用填網址）')
      return
    }

    // 空字串代表清空該平台，不存進 jsonb
    const social_links: Record<string, string> = {}
    if (normalizedThreads) social_links.threads = normalizedThreads
    if (normalizedInstagram) social_links.instagram = normalizedInstagram
    if (normalizedLine) social_links.line = normalizedLine

    setSaving(true)
    await supabase.from('profiles').update({ bio, social_links }).eq('id', profile.id)
    setProfile({ ...profile, bio, social_links })
    setThreads(normalizedThreads)
    setInstagram(normalizedInstagram)
    setLineId(normalizedLine)
    setEditing(false)
    setSaving(false)
  }

  const handleChangePassword = async () => {
    setPasswordError('')

    if (newPassword.length < 8) {
      setPasswordError('密碼至少需要 8 個字元')
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
      // 最大顯示 96 CSS px（個人頁 h-24），3x Retina 需 288 實體 px；再大只是流量
      const { blob, ext, contentType } = await getCroppedImage(cropFile, croppedAreaPixels, 288, 0.8)
      const path = `avatars/${profile.id}.${ext}`
      const { error } = await supabase.storage
        .from('images')
        // URL 帶 ?t= 時間戳破快取，換頭像不受長快取影響
        .upload(path, blob, { contentType, upsert: true, cacheControl: '31536000' })

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
        {/* 骨架屏：對齊實際版型（個人資訊卡 + 兩張區塊卡），避免載入完成時版面跳動 */}
        <div className="card flex items-start gap-4 p-4">
          <Skeleton className="h-20 w-20 flex-shrink-0 rounded-full" />
          <div className="flex-1 space-y-2 py-1">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-4 w-40" />
          </div>
        </div>
        {[0, 1].map(i => (
          <div key={i} className="card mt-4 space-y-3 p-4">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        ))}
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

      {/* 停權公告：發文/留言/訊息/評價在 DB 層被擋，這裡讓使用者知道原因與期限 */}
      {isSuspendedUntil(profile.suspended_until) && (
        <div className="mb-4 rounded-md border-2 border-clay/30 bg-clay/5 px-4 py-3 text-sm text-clay">
          <p className="font-bold">
            帳號停權中（{profile.suspended_until === 'infinity' ? '無限期' : `至 ${formatDate(profile.suspended_until!)}`}）
          </p>
          {profile.suspended_reason && <p className="mt-1">原因：{profile.suspended_reason}</p>}
          <p className="mt-1">停權期間無法刊登、留言、發送訊息與評價。如有疑問請聯繫 contact@benjifan.com</p>
        </div>
      )}

      {/* 個人資訊卡 */}
      <div className="card flex items-start gap-4 p-4">
        {/* 頭像 */}
        <div className="relative flex-shrink-0">
          <button
            className="group relative h-24 w-24 overflow-hidden rounded-full"
            onClick={() => avatarInputRef.current?.click()}
            disabled={uploadingAvatar}
          >
            {profile.avatar_url ? (
              <Image
                src={profile.avatar_url}
                alt={profile.username}
                fill
                unoptimized
                className="object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-field text-2xl font-bold text-white">
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
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-dugout">
            <span>成交 <span className="font-bold text-scoreboard">{profile.deal_count ?? 0}</span> 次</span>
            <span className="flex items-center gap-0.5">
              <span className="text-gold">⭐</span>
              {(profile.rating_count ?? 0) > 0
                ? `${Number(profile.rating).toFixed(1)}（${profile.rating_count} 則評價）`
                : '尚無評價'}
            </span>
            <span>· 加入於 {formatDate(profile.created_at)}</span>
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
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <input
                  className="input"
                  placeholder="Threads 帳號（不含 @）"
                  value={threads}
                  onChange={e => setThreads(e.target.value)}
                  maxLength={31}
                />
                <input
                  className="input"
                  placeholder="Instagram 帳號（不含 @）"
                  value={instagram}
                  onChange={e => setInstagram(e.target.value)}
                  maxLength={31}
                />
                <input
                  className="input"
                  placeholder="LINE ID"
                  value={lineId}
                  onChange={e => setLineId(e.target.value)}
                  maxLength={20}
                />
              </div>
              {socialError && <p className="mt-1 text-xs text-clay-dark">{socialError}</p>}
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
              <div>
                <p className="text-sm text-dugout">{profile.bio || '這個人很神秘，還沒留下自我介紹'}</p>
                <SocialLinkRow socialLinks={profile.social_links} />
              </div>
              <button className="btn-secondary flex-shrink-0 px-3 py-1.5 text-xs" onClick={() => setEditing(true)}>
                編輯
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 社群帳號提醒：任一平台有填就不提醒 */}
      {!editing && !profile.social_links?.threads && !profile.social_links?.instagram && !profile.social_links?.line && (
        <div className="mt-4 flex items-center justify-between gap-3 rounded-md border-2 border-gold/30 bg-gold/5 px-4 py-3">
          <p className="text-sm text-scoreboard">
            還沒填社群帳號——讓買家看到你的社群，更容易建立信任、談成交易
          </p>
          <button
            className="btn-secondary flex-shrink-0 px-3 py-1.5 text-xs"
            onClick={() => setEditing(true)}
          >
            去填寫
          </button>
        </div>
      )}

      {/* 帳號安全 */}
      <div id="security" className="card mt-4 scroll-mt-20 p-4">
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
                minLength={8}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-scoreboard">確認新密碼</label>
              <input
                type="password"
                className="input"
                value={confirmNewPassword}
                onChange={e => setConfirmNewPassword(e.target.value)}
                minLength={8}
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

      {/* 通知設定 */}
      <div className="card mt-4 p-4">
        <h2 className="font-display text-base text-scoreboard">通知設定</h2>
        <label className="mt-3 flex cursor-pointer items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-scoreboard">新訊息 Email 通知</p>
            <p className="mt-0.5 text-xs text-dugout">有買家首次詢問你的刊登時寄信通知</p>
          </div>
          <input
            type="checkbox"
            className="h-5 w-5 flex-shrink-0 accent-field"
            checked={profile.message_email_enabled ?? true}
            onChange={async e => {
              const enabled = e.target.checked
              setProfile({ ...profile, message_email_enabled: enabled })
              await supabase.from('profiles').update({ message_email_enabled: enabled }).eq('id', profile.id)
            }}
          />
        </label>
      </div>

      {/* 站務管理：僅管理員看得到 */}
      {profile.is_admin && (
        <div className="card mt-4 p-4">
          <h2 className="font-display text-base text-scoreboard">站務管理</h2>
          <Link
            href="/admin/announcements"
            className="mt-3 flex items-center gap-2 text-sm font-medium text-clay hover:underline"
          >
            <Megaphone size={16} /> 置頂公告管理
          </Link>
        </div>
      )}

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

      {/* 已下架（過期或管理員下架）：只有本人看得到，附原因 */}
      {inactiveListings.length > 0 && (
        <div className="mt-10">
          <div className="border-b-2 border-scoreboard/10 pb-3">
            <h2 className="font-display text-base text-scoreboard">已下架（{inactiveListings.length}）</h2>
          </div>
          <div className="mt-5 space-y-3">
            {inactiveListings.map(listing => (
              <div key={listing.id} className="card flex items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <a href={`/listings/${listing.id}`} className="block truncate text-sm font-semibold text-scoreboard hover:underline">
                    {listing.title}
                  </a>
                  <p className="mt-1 text-xs text-dugout">
                    {listing.status === 'removed'
                      ? `管理員下架${listing.removed_reason ? `：${listing.removed_reason}` : ''}`
                      : '場次已結束，自動下架'}
                  </p>
                </div>
                <span className="flex-shrink-0 rounded-full bg-dugout/10 px-2.5 py-1 text-xs font-bold text-dugout">
                  {listing.status === 'removed' ? '已下架' : '已過期'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 收到的評價 */}
      <div className="mt-10">
        <div className="border-b-2 border-scoreboard/10 pb-3">
          <h2 className="font-display text-base text-scoreboard">收到的評價（{profile.rating_count ?? 0}）</h2>
        </div>
        <ReviewList revieweeId={profile.id} />
      </div>
    </div>
  )
}
