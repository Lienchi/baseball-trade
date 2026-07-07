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
