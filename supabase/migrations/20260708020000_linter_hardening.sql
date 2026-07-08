-- Supabase linter 安全強化（2026-07-08）
-- ① SECURITY DEFINER 函式釘死 search_path，防 schema 劫持
ALTER FUNCTION public.increment_view_count(listing_id uuid) SET search_path = public;
ALTER FUNCTION public.update_profile_rating() SET search_path = public;
ALTER FUNCTION public.create_conversation(p_listing_id uuid, p_seller_id uuid) SET search_path = public;
ALTER FUNCTION public.is_conversation_participant(conv_id uuid) SET search_path = public;
ALTER FUNCTION public.get_existing_conversation(p_seller_id uuid, p_listing_id uuid) SET search_path = public;
ALTER FUNCTION public.get_my_conversation_ids() SET search_path = public;

-- ② trigger 函式關閉 REST API 呼叫（trigger 觸發不受影響）
REVOKE EXECUTE ON FUNCTION public.enforce_listing_limit() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_mutual_confirmation() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_profile_rating() FROM PUBLIC, anon, authenticated;

-- ③ 需登入的 RPC 收掉 anon；increment_view_count 刻意保留 anon（訪客也計瀏覽數）
REVOKE EXECUTE ON FUNCTION public.confirm_deal(p_conversation_id uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.submit_review(p_conversation_id uuid, p_rating integer, p_comment text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.create_conversation(p_listing_id uuid, p_seller_id uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_existing_conversation(p_seller_id uuid, p_listing_id uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_my_conversations(p_limit integer, p_offset integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_my_conversation_ids() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_conversation_participant(conv_id uuid) FROM PUBLIC, anon;

-- ④ public bucket 用 public URL 即可存取，不需 SELECT policy（它只多開了列檔案能力）
DROP POLICY "avatars_select" ON storage.objects;

-- 另：Dashboard → Authentication → Password 開啟 leaked password protection（非 SQL）
