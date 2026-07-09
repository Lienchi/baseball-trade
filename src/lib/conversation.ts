import type { SupabaseClient } from '@supabase/supabase-js'

// 找出或建立與對方在某刊登下的對話，回傳 conversation id。
// 對話模型是對稱的（conversation_participants 兩筆，無方向性），
// RPC 的 p_seller_id 實際語意是「對方的 id」，買家找賣家、賣家找留言者都走這裡。
export async function findOrCreateConversation(
  supabase: SupabaseClient,
  listingId: string,
  otherUserId: string
): Promise<{ id: string | null; error: string | null }> {
  const { data: existingId } = await supabase.rpc('get_existing_conversation', {
    p_seller_id: otherUserId,
    p_listing_id: listingId,
  })
  if (existingId) return { id: existingId, error: null }

  const { data: convId, error } = await supabase.rpc('create_conversation', {
    p_listing_id: listingId,
    p_seller_id: otherUserId,
  })
  if (convId) return { id: convId, error: null }
  return { id: null, error: error?.message ?? '建立對話失敗' }
}

// 查詢既有對話（不建立）。回傳 null 表示還沒聊過。
export async function findExistingConversation(
  supabase: SupabaseClient,
  listingId: string,
  otherUserId: string
): Promise<string | null> {
  const { data } = await supabase.rpc('get_existing_conversation', {
    p_seller_id: otherUserId,
    p_listing_id: listingId,
  })
  return data ?? null
}

// 建立對話並送出首則訊息。呼叫端應先用 findExistingConversation 確認沒有既有對話，
// 讓「送出首訊才建對話」成立，避免點了聯絡按鈕卻沒傳訊息留下空對話。
export async function startConversationWithMessage(
  supabase: SupabaseClient,
  listingId: string,
  otherUserId: string,
  senderId: string,
  content: string
): Promise<{ id: string | null; error: string | null }> {
  const { id, error } = await findOrCreateConversation(supabase, listingId, otherUserId)
  if (!id) return { id: null, error }

  const { error: msgError } = await supabase
    .from('messages')
    .insert({ conversation_id: id, sender_id: senderId, content })
  if (msgError) return { id: null, error: msgError.message }

  // 首訊 email 通知對方（fire-and-forget：通知失敗不影響傳訊）
  fetch('/api/notify/first-message', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ conversationId: id }),
    keepalive: true,
  }).catch(() => {})

  return { id, error: null }
}
