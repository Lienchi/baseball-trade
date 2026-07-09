import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/email'

// 首訊 email 通知：買家送出對話的第一則訊息後，前端 fire-and-forget 呼叫這裡。
// 所有檢查（參與者驗證、收件人開關、24h 節流）都在 server 端做，前端只給 conversationId。
export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  let conversationId: unknown
  try {
    ({ conversationId } = await request.json())
  } catch {
    return NextResponse.json({ error: 'bad request' }, { status: 400 })
  }
  if (typeof conversationId !== 'string') {
    return NextResponse.json({ error: 'bad request' }, { status: 400 })
  }

  const admin = createAdminClient()

  // 呼叫者必須是對話參與者，收件人是對話中的另一方
  const { data: participants } = await admin
    .from('conversation_participants')
    .select('user_id')
    .eq('conversation_id', conversationId)
  const ids = (participants ?? []).map(p => p.user_id)
  if (!ids.includes(user.id)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }
  const recipientId = ids.find(id => id !== user.id)
  if (!recipientId) return NextResponse.json({ sent: false })

  // 收件人關掉通知、或 24 小時內已寄過 → 跳過
  const { data: recipient } = await admin
    .from('profiles')
    .select('message_email_enabled, last_message_email_at')
    .eq('id', recipientId)
    .single()
  if (!recipient?.message_email_enabled) return NextResponse.json({ sent: false })
  if (
    recipient.last_message_email_at &&
    Date.now() - new Date(recipient.last_message_email_at).getTime() < 24 * 60 * 60 * 1000
  ) {
    return NextResponse.json({ sent: false })
  }

  const { data: conversation } = await admin
    .from('conversations')
    .select('listing_id')
    .eq('id', conversationId)
    .single()
  const { data: listing } = conversation?.listing_id
    ? await admin
        .from('listings')
        .select('title, team')
        .eq('id', conversation.listing_id)
        .single()
    : { data: null }

  const { data: authUser } = await admin.auth.admin.getUserById(recipientId)
  const email = authUser?.user?.email
  if (!email) return NextResponse.json({ sent: false })

  // 先更新節流時間戳再寄，避免同時多請求重複寄信
  await admin
    .from('profiles')
    .update({ last_message_email_at: new Date().toISOString() })
    .eq('id', recipientId)

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://benjifan.com'
  const listingInfo = listing
    ? `<p style="margin:0 0 4px;"><strong>${escapeHtml(listing.title)}</strong>${listing.team ? `（${escapeHtml(listing.team)}）` : ''}</p>`
    : ''
  const sent = await sendEmail(
    email,
    '你在 BenjiFan 有新的買家詢問',
    `<div style="font-family:sans-serif;font-size:14px;line-height:1.7;color:#1a1a1a;">
      <p>有買家對你的刊登送出了詢問：</p>
      ${listingInfo}
      <p style="margin:16px 0;">
        <a href="${siteUrl}/messages/${conversationId}" style="display:inline-block;background:#154C99;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:bold;">前往對話回覆</a>
      </p>
      <p style="color:#666;font-size:13px;">回站後也別忘了查看其他未讀對話。球票有時效性，儘早回覆能提高成交機會。</p>
      <p style="color:#999;font-size:12px;">BenjiFan 本質球迷 <a href="${siteUrl}" style="color:#154C99;">${siteUrl.replace(/^https?:\/\//, '')}</a><br>不想收到這類通知？可以到「個人資料」頁關閉新訊息 email 通知。</p>
    </div>`
  )

  return NextResponse.json({ sent })
}

function escapeHtml(s: string): string {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}
