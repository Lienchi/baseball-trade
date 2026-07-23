import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'
// 一次可能要刪多張圖 + 多筆對話，放寬到 60s（免費版上限）；冪等，超時隔天續清
export const maxDuration = 60

// 對話清理（pg_cron 每日打一次，migration 20260723000000）。省 Supabase 免費版空間：
//   A) 已成交滿 3 個月 → 只刪圖（storage 物件 + messages.image_url 設 null），保留文字與評價
//   B) 未成交且最後訊息滿 3 個月 → 整段對話刪除（先刪圖檔，再 delete conversation 連帶 cascade）
// 圖檔刪除一定要走 storage API（.remove）——DB cascade 只清 row，實體檔會留在儲存後端變孤兒。
const RETENTION_DAYS = 90

// public URL → bucket 內路徑：.../object/public/images/messages/{uid}/{file} → messages/{uid}/{file}
function urlToStoragePath(url: string): string | null {
  const marker = '/object/public/images/'
  const i = url.indexOf(marker)
  return i === -1 ? null : url.slice(i + marker.length)
}

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 86400_000).toISOString()

  // 收集圖片 URL → 刪 storage 物件，回傳成功刪掉的 message id 供後續清 DB
  const removeImages = async (rows: { id: string; image_url: string | null }[]) => {
    const paths = rows
      .map(r => (r.image_url ? urlToStoragePath(r.image_url) : null))
      .filter((p): p is string => !!p)
    if (paths.length === 0) return
    // Supabase 單次 remove 上限保守分批（每批 1000）
    for (let i = 0; i < paths.length; i += 1000) {
      const { error } = await admin.storage.from('images').remove(paths.slice(i, i + 1000))
      if (error) console.error('[cleanup] storage remove failed', error.message)
    }
  }

  let expiredImages = 0
  let deletedConversations = 0

  try {
    // ─── A) 已成交滿 3 個月：只刪圖 ───
    // 雙方確認時間都早於 cutoff ⇒ 成交完成（兩者較晚那筆）也早於 cutoff
    const { data: doneConvs, error: doneErr } = await admin
      .from('conversations')
      .select('id')
      .not('buyer_confirmed_at', 'is', null)
      .not('seller_confirmed_at', 'is', null)
      .lt('buyer_confirmed_at', cutoff)
      .lt('seller_confirmed_at', cutoff)
    if (doneErr) throw doneErr

    const doneIds = (doneConvs ?? []).map(c => c.id)
    if (doneIds.length > 0) {
      const { data: imgs, error: imgErr } = await admin
        .from('messages')
        .select('id, image_url')
        .in('conversation_id', doneIds)
        .not('image_url', 'is', null)
      if (imgErr) throw imgErr

      if (imgs && imgs.length > 0) {
        await removeImages(imgs)
        // 圖檔刪了就把 image_url 清掉，前端顯示「圖片已過期」；保留訊息 row 不動對話結構
        const { error: clrErr } = await admin
          .from('messages')
          .update({ image_url: null })
          .in('id', imgs.map(m => m.id))
        if (clrErr) throw clrErr
        expiredImages = imgs.length
      }
    }

    // ─── B) 未成交且最後訊息滿 3 個月：整段刪除 ───
    // 未成交＝任一方尚未確認；閒置＝last_message_at 早於 cutoff（空對話沿用 created_at，已由預設保證有值）
    const { data: idleConvs, error: idleErr } = await admin
      .from('conversations')
      .select('id')
      .or('buyer_confirmed_at.is.null,seller_confirmed_at.is.null')
      .lt('last_message_at', cutoff)
    if (idleErr) throw idleErr

    const idleIds = (idleConvs ?? []).map(c => c.id)
    if (idleIds.length > 0) {
      // 先撈圖檔刪 storage（cascade 只清 DB row，不清實體檔）
      const { data: idleImgs, error: idleImgErr } = await admin
        .from('messages')
        .select('id, image_url')
        .in('conversation_id', idleIds)
        .not('image_url', 'is', null)
      if (idleImgErr) throw idleImgErr
      if (idleImgs && idleImgs.length > 0) await removeImages(idleImgs)

      // 刪對話 → cascade 掉 messages / participants（未成交無評價，不影響信譽）
      const { error: delErr } = await admin
        .from('conversations')
        .delete()
        .in('id', idleIds)
      if (delErr) throw delErr
      deletedConversations = idleIds.length
    }
  } catch (err) {
    console.error('[cleanup] failed', err)
    return NextResponse.json({ error: 'cleanup failed' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, expiredImages, deletedConversations })
}
