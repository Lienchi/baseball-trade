import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/email'

export const dynamic = 'force-dynamic'

// 未讀私訊提醒：pg_cron 每 15 分呼叫一次（migration 20260719000000）。
// 候選條件在 get_unread_reminder_candidates：未讀非系統訊息超過 N 分鐘，
// 且該對話 24 小時內沒寄過提醒（conversations.unread_email_at）。
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const minutes = Number(process.env.UNREAD_REMINDER_MINUTES ?? '30')
  const admin = createAdminClient()

  const { data: candidates, error } = await admin.rpc('get_unread_reminder_candidates', {
    p_minutes: minutes,
  })
  if (error) {
    console.error('[unread-reminders] candidates query failed', error)
    return NextResponse.json({ error: 'query failed' }, { status: 500 })
  }

  let sent = 0
  let skipped = 0
  for (const c of candidates ?? []) {
    const { data: profile } = await admin
      .from('profiles')
      .select('message_email_enabled')
      .eq('id', c.recipient_id)
      .single()
    if (!profile?.message_email_enabled) {
      skipped++
      continue
    }

    const { data: authUser } = await admin.auth.admin.getUserById(c.recipient_id)
    const email = authUser?.user?.email
    if (!email) {
      skipped++
      continue
    }

    const { data: listing } = c.listing_id
      ? await admin.from('listings').select('title, team').eq('id', c.listing_id).single()
      : { data: null }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://benjifan.com'
    const listingInfo = listing
      ? `<p style="margin:0 0 4px;"><strong>${escapeHtml(listing.title)}</strong>${listing.team ? `（${escapeHtml(listing.team)}）` : ''}</p>`
      : ''
    const ok = await sendEmail(
      email,
      `你在 BenjiFan 有 ${c.unread_count} 則未讀私訊`,
      `<div style="font-family:sans-serif;font-size:14px;line-height:1.7;color:#1a1a1a;">
        <p>以下對話有 ${c.unread_count} 則訊息還沒讀，對方正在等你回覆：</p>
        ${listingInfo}
        <p style="margin:16px 0;">
          <a href="${siteUrl}/messages/${c.conversation_id}" style="display:inline-block;background:#154C99;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:bold;">前往對話回覆</a>
        </p>
        <p style="color:#666;font-size:13px;">球票有時效性，儘早回覆能提高成交機會。</p>
        <p style="color:#999;font-size:12px;">BenjiFan 本質球迷 <a href="${siteUrl}" style="color:#154C99;">${siteUrl.replace(/^https?:\/\//, '')}</a><br>不想收到這類通知？可以到「個人資料」頁關閉新訊息 email 通知。</p>
      </div>`
    )

    if (ok) {
      await admin
        .from('conversations')
        .update({ unread_email_at: new Date().toISOString() })
        .eq('id', c.conversation_id)
      sent++
    } else {
      skipped++
    }
  }

  return NextResponse.json({ candidates: candidates?.length ?? 0, sent, skipped })
}

function escapeHtml(s: string): string {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}
