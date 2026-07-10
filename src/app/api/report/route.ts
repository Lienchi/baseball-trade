import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/email'
import { isSuspendedUntil } from '@/lib/utils'
import { REPORT_REASONS } from '@/lib/report'

// 同一刊登累積達此件數時寄信通知管理員（只在剛好達標那一件寄，不重複轟炸）
const NOTIFY_THRESHOLD = 3
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'contact@benjifan.com'

export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  let listingId: unknown, reason: unknown, detail: unknown
  try {
    ({ listingId, reason, detail } = await request.json())
  } catch {
    return NextResponse.json({ error: 'bad request' }, { status: 400 })
  }
  if (typeof listingId !== 'string' || typeof reason !== 'string' || !(REPORT_REASONS as readonly string[]).includes(reason)) {
    return NextResponse.json({ error: 'bad request' }, { status: 400 })
  }
  const detailText = typeof detail === 'string' ? detail.trim().slice(0, 300) : ''
  if (reason === '其他' && !detailText) {
    return NextResponse.json({ error: 'detail required' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: reporter } = await admin
    .from('profiles')
    .select('suspended_until')
    .eq('id', user.id)
    .single()
  if (isSuspendedUntil(reporter?.suspended_until)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const { data: listing } = await admin
    .from('listings')
    .select('id, title, user_id')
    .eq('id', listingId)
    .single()
  if (!listing) return NextResponse.json({ error: 'not found' }, { status: 404 })
  if (listing.user_id === user.id) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const { error: insertError } = await admin
    .from('reports')
    .insert({ listing_id: listingId, reporter_id: user.id, reason, detail: detailText || null })
  // 同一人重複檢舉：unique 擋下，視為已受理
  if (insertError) {
    if (insertError.code === '23505') return NextResponse.json({ ok: true })
    return NextResponse.json({ error: 'insert failed' }, { status: 500 })
  }

  const { count } = await admin
    .from('reports')
    .select('id', { count: 'exact', head: true })
    .eq('listing_id', listingId)

  if (count === NOTIFY_THRESHOLD) {
    const { data: all } = await admin
      .from('reports')
      .select('reason, detail, created_at')
      .eq('listing_id', listingId)
      .order('created_at')
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://benjifan.com'
    const rows = (all ?? [])
      .map(r => `<li>${escapeHtml(r.reason)}${r.detail ? `：${escapeHtml(r.detail)}` : ''}</li>`)
      .join('')
    await sendEmail(
      ADMIN_EMAIL,
      `[檢舉] 刊登「${listing.title}」已累積 ${count} 件檢舉`,
      `<div style="font-family:sans-serif;font-size:14px;line-height:1.7;color:#1a1a1a;">
        <p>刊登 <strong>${escapeHtml(listing.title)}</strong> 已累積 ${count} 件檢舉：</p>
        <ul>${rows}</ul>
        <p style="margin:16px 0;">
          <a href="${siteUrl}/listings/${listing.id}" style="display:inline-block;background:#154C99;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:bold;">前往刊登頁處理</a>
        </p>
        <p style="color:#666;font-size:13px;">可於刊登頁使用管理員下架，或至賣家個人頁停權。</p>
      </div>`
    )
  }

  return NextResponse.json({ ok: true })
}

function escapeHtml(s: string): string {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}
